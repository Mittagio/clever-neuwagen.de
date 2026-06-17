import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublishedDealerConditions, useDraftDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import {
  parseDealerAiInput,
  applyDealerAiFields,
  suggestActionForPaymentType,
} from '../services/dealerAiParser.js';
import { buildDealerAiTextFromWishes } from '../services/dealerAiFromWishes.js';
import { resolveDealerAiVehicleSuggestions } from '../services/dealerAiVehicleSuggestions.js';
import { pipelineToLeadStatus } from '../services/dealerAiLeadCrm.js';
import { mergeChipIds } from '../services/sales/conversationVoiceParser.js';
import { executeDealerAiAction, formatDealerAiVehicleCard } from '../services/dealerAiActions.js';
import {
  extractCarryCustomerFromLead,
  hasKnownCustomerContact,
} from '../services/dealerAiCustomer.js';
import DealerAiStartScreen from '../components/dealer-ai/DealerAiStartScreen.jsx';
import DealerAiCleverBeratung from '../components/dealer-ai/DealerAiCleverBeratung.jsx';
import DealerAiModelFlow from '../components/dealer-ai/DealerAiModelFlow.jsx';
import DealerAiAnalysisCard from '../components/dealer-ai/DealerAiAnalysisCard.jsx';
import DealerAiSuggestedModels from '../components/dealer-ai/DealerAiSuggestedModels.jsx';
import DealerAiReviewBar from '../components/dealer-ai/DealerAiReviewBar.jsx';
import DealerAiCustomerCapture from '../components/dealer-ai/DealerAiCustomerCapture.jsx';
import DealerAiLeadFollowUp from '../components/dealer-ai/DealerAiLeadFollowUp.jsx';
import CustomerOfferEditView from '../components/dealer-ai/CustomerOfferEditView.jsx';
import DealerAiResultPanel from '../components/dealer-ai/DealerAiResultPanel.jsx';
import {
  attachPdfToOffer,
  createOnlineLinkForOffer,
  createVehicleOfferFromCard,
  getVehicleOffer,
  markOfferSent,
  mergeVehicleOffersPatch,
  recordOfferOpened,
  VEHICLE_OFFER_HISTORY,
  VEHICLE_OFFER_STATUS,
} from '../services/vehicleOffer.js';
import { formatVehicleCardTitle } from '../services/customerAkte.js';
import { phoneTelHref } from '../services/dealerAiLeadCrm.js';
import DealerAppLegalMenu from '../components/dealer/DealerAppLegalMenu.jsx';
import './DealerAIPage.css';

export default function DealerAIPage() {
  const location = useLocation();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addInventoryItem, publishChanges } = useDraftDealerConditions();
  const { addLead, leads, updateLead, addHistory } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [parsed, setParsed] = useState(null);
  const [selectedModelIds, setSelectedModelIds] = useState([]);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('input');
  const [startView, setStartView] = useState('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isFreshLead, setIsFreshLead] = useState(false);
  const [isReturningWish, setIsReturningWish] = useState(false);
  const [carryCustomer, setCarryCustomer] = useState(null);
  const [toast, setToast] = useState('');
  const [offerEditCard, setOfferEditCard] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const enrichWithSuggestions = useCallback((nextParsed, chipIds = selectedChipIds) => {
    if (!nextParsed?.ok) return nextParsed;
    return {
      ...nextParsed,
      suggestedModels: resolveDealerAiVehicleSuggestions(nextParsed.fields, conditions, chipIds),
    };
  }, [conditions, selectedChipIds]);

  const buildCombinedText = useCallback((extra = {}) => {
    const extraChips = extra.chipIds ?? [];
    const allChipIds = [...new Set([...selectedChipIds, ...extraChips])];
    const textParts = [];
    if (extra.modelName) textParts.push(`Kia ${extra.modelName}`);
    if (voiceTranscript?.trim()) textParts.push(voiceTranscript.trim());
    if (input?.trim() && input.trim() !== voiceTranscript?.trim()) {
      textParts.push(input.trim());
    }
    return buildDealerAiTextFromWishes({
      chipIds: allChipIds,
      transcript: textParts.join('. '),
    });
  }, [selectedChipIds, voiceTranscript, input]);

  function runAnalysis(extra = {}) {
    const combined = buildCombinedText(extra);
    setIsAnalyzing(true);
    setResult(null);
    const next = parseDealerAiInput(combined);
    setIsAnalyzing(false);

    if (!next.ok) {
      showToast(next.error);
      return;
    }

    const extraChips = extra.chipIds ?? [];
    if (extraChips.length) {
      setSelectedChipIds((prev) => [...new Set([...prev, ...extraChips])]);
    }
    if (extra.modelName && !input.trim()) {
      setInput(`Kia ${extra.modelName}`);
    }

    setParsed(enrichWithSuggestions(next, [...selectedChipIds, ...extraChips]));
    setSelectedModelIds([]);
    setStartView('home');
    setPhase('review');
  }

  function handleVoiceParsed(parsedVoice) {
    if (parsedVoice?.transcript) {
      setVoiceTranscript((prev) => {
        const next = prev ? `${prev} ${parsedVoice.transcript}` : parsedVoice.transcript;
        return next.trim();
      });
      if (!input.trim()) {
        setInput((prev) => prev || parsedVoice.transcript);
      }
    }
    if (parsedVoice?.chipIds?.length) {
      setSelectedChipIds((prev) => mergeChipIds(prev, parsedVoice.chipIds));
    }
  }

  function resetWishInput() {
    setInput('');
    setSelectedChipIds([]);
    setVoiceTranscript('');
    setParsed(null);
    setSelectedModelIds([]);
    setResult(null);
    setStartView('home');
  }

  function handleEdit() {
    setPhase('input');
    setStartView('home');
    setParsed(null);
    setSelectedModelIds([]);
    setResult(null);
    inputRef.current?.focus();
  }

  function handleDiscard() {
    resetWishInput();
    setCarryCustomer(null);
    setIsFreshLead(false);
    setIsReturningWish(false);
    setOfferEditCard(null);
    setPhase('input');
  }

  function handleStartNewWish(sourceLead) {
    const carry = extractCarryCustomerFromLead(sourceLead);
    resetWishInput();
    setCarryCustomer(carry);
    setIsReturningWish(Boolean(carry));
    setIsFreshLead(false);
    setPhase('input');
  }

  function handleFieldsChange(patch) {
    setParsed((prev) => enrichWithSuggestions(applyDealerAiFields(prev, patch)));
  }

  function handleToggleReserveModel(model) {
    setSelectedModelIds((prev) => {
      const isSelected = prev.includes(model.id);
      const next = isSelected ? prev.filter((id) => id !== model.id) : [...prev, model.id];
      if (!isSelected && next.length === 1) {
        const vehicle = model.primaryMatch?.vehicle;
        setParsed((p) => enrichWithSuggestions(applyDealerAiFields(p, {
          model: vehicle?.model ?? model.name.replace(/^Kia\s+/i, ''),
          brand: vehicle?.brand ?? 'Kia',
          modelId: model.modelKey ?? model.id,
          trimLabel: vehicle?.trim ?? p?.fields?.trimLabel,
          trimId: vehicle?.trimId ?? p?.fields?.trimId,
        })));
      }
      return next;
    });
  }

  useEffect(() => {
    const wishText = location.state?.wishText;
    if (!wishText) return;
    setInput(wishText);
    const next = parseDealerAiInput(wishText);
    if (next.ok) {
      setParsed(enrichWithSuggestions(next));
      setSelectedModelIds([]);
      setPhase('review');
    }
  }, [location.state?.wishText, enrichWithSuggestions]);

  useEffect(() => {
    const leadId = location.state?.leadId;
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    setResult({ type: 'lead', leadId });
    setIsFreshLead(Boolean(location.state?.fresh));
    setPhase('followup');
    if (lead.notes) {
      const next = parseDealerAiInput(lead.notes);
      if (next.ok) setParsed(enrichWithSuggestions(next));
    }
  }, [location.state?.leadId, leads, enrichWithSuggestions]);

  useEffect(() => {
    if (!location.state?.focusText || phase !== 'input') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [location.state, phase]);

  function runAction(actionId) {
    if (!parsed?.ok) return;
    setIsExecuting(true);

    try {
      const actionResult = executeDealerAiAction(actionId, parsed, {
        conditions,
        addOffer,
        getExistingCodes,
        leads,
        addLead,
        updateLead,
        linkLead,
        addInventoryItem,
        publishChanges,
        selectedModelIds,
        carryCustomer,
      });

      setResult(actionResult);
      if (actionResult.type === 'lead') {
        setIsReturningWish(Boolean(actionResult.isReturningWish ?? carryCustomer));
        setPhase('capture');
      } else if (actionResult.type === 'offer' && actionResult.leadId) {
        setPhase('followup');
        setIsFreshLead(false);
        showToast('Angebot vorbereitet');
      } else {
        setPhase('done');
        showToast(actionResult.message);
      }
    } catch (err) {
      showToast(err.message ?? 'Aktion fehlgeschlagen');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleCreateLead() {
    runAction('create_sales_opportunity');
  }

  function handlePrepareOffer(reservedModel) {
    if (!parsed?.ok) return;
    if (reservedModel) {
      const full = parsed.suggestedModels?.find((m) => m.id === reservedModel.id);
      const vehicle = full?.primaryMatch?.vehicle;
      if (vehicle) {
        setParsed((prev) => enrichWithSuggestions(applyDealerAiFields(prev, {
          model: vehicle.model ?? reservedModel.name?.replace(/^Kia\s+/i, ''),
          brand: vehicle.brand ?? 'Kia',
          modelId: reservedModel.modelKey ?? reservedModel.id,
          trimLabel: vehicle.trim ?? reservedModel.trimLabel ?? prev?.fields?.trimLabel,
          trimId: vehicle.trimId ?? prev?.fields?.trimId,
        })));
      } else {
        setParsed((prev) => enrichWithSuggestions(applyDealerAiFields(prev, {
          model: reservedModel.name?.replace(/^Kia\s+/i, '') ?? prev?.fields?.model,
          brand: 'Kia',
          modelId: reservedModel.modelKey ?? reservedModel.id,
          trimLabel: reservedModel.trimLabel ?? prev?.fields?.trimLabel,
        })));
      }
    }
    const actionId = suggestActionForPaymentType(parsed.fields.paymentType ?? 'unknown');
    if (actionId === 'create_sales_opportunity') {
      runAction('create_offer');
      return;
    }
    runAction(actionId);
  }

  function handleReturnToReview() {
    const ids = activeLead?.crm?.reservedModels?.map((m) => m.id) ?? selectedModelIds;
    setSelectedModelIds(ids);
    setPhase('review');
  }

  const activeLead = result?.leadId
    ? leads.find((l) => l.id === result.leadId) ?? null
    : null;

  function handleLeadSave(patch, meta = {}) {
    if (!result?.leadId) return;
    setIsSavingLead(true);
    updateLead(result.leadId, patch);
    if (!meta.silent && meta.historyText) {
      addHistory(result.leadId, meta.historyText, meta.historyType ?? 'note');
    }
    if (meta.addFollowupHistory !== false && patch.crm?.nextStepLabel) {
      addHistory(
        result.leadId,
        `Nachfassen geplant: ${patch.crm.nextStepLabel}`,
        'followup',
      );
    }
    setIsSavingLead(false);
    if (!meta.silent) showToast('Gespeichert');
  }

  function handleLeadHistory(text, type = 'note', options = {}) {
    if (!result?.leadId) return;
    addHistory(result.leadId, text, type);
    if (options.pipelineStatusId) {
      const leadStatus = pipelineToLeadStatus(options.pipelineStatusId);
      updateLead(result.leadId, {
        status: leadStatus,
        crm: {
          ...(activeLead?.crm ?? {}),
          pipelineStatusId: options.pipelineStatusId,
        },
      });
    }
    showToast('Eintrag in Historie gespeichert');
  }

  function handleCaptureSave(patch, meta = {}) {
    if (!result?.leadId) return;
    const current = activeLead;
    updateLead(result.leadId, {
      ...(patch.customerId ? { customerId: patch.customerId } : {}),
      contact: {
        ...(current?.contact ?? {}),
        ...patch.contact,
      },
      notes: patch.notes ?? current?.notes ?? '',
    });
    if (!meta.silent && meta.historyText) {
      addHistory(result.leadId, meta.historyText, 'note');
    }
  }

  function handleAdoptCustomer(adoption = {}) {
    if (!result?.leadId) return;
    const current = activeLead;
    if (adoption.forceNew) {
      updateLead(result.leadId, {
        customerId: adoption.customerId,
      });
      return;
    }
    const profile = adoption.profile;
    if (!profile) return;
    updateLead(result.leadId, {
      customerId: profile.customerId,
      contact: {
        ...(current?.contact ?? {}),
        name: profile.contact.name,
        phone: profile.contact.phone ?? '',
        email: profile.contact.email ?? '',
      },
      ...(profile.kundenhelfer
        ? { crm: { ...(current?.crm ?? {}), kundenhelfer: profile.kundenhelfer } }
        : {}),
    });
  }

  function handleOpenCustomerLead(leadId) {
    const target = leads.find((l) => l.id === leadId);
    if (!target) return;
    setResult({ type: 'lead', leadId });
    setPhase('followup');
    setIsFreshLead(false);
    setIsReturningWish(false);
    if (target.notes) {
      const next = parseDealerAiInput(target.notes);
      if (next.ok) setParsed(enrichWithSuggestions(next));
    }
  }

  function handleCaptureComplete() {
    setCarryCustomer(null);
    setPhase('followup');
    setIsFreshLead(true);
  }

  function handleEnterLeadDetail() {
    setIsFreshLead(false);
  }

  function handleOpenOfferEdit(card) {
    setOfferEditCard(card);
    setPhase('offer-edit');
  }

  function handleBackFromOffer() {
    setOfferEditCard(null);
    setPhase('followup');
  }

  function persistVehicleOffer(cardId, nextOffer, historyMeta = null) {
    if (!result?.leadId || !cardId) return;
    const vehicleOffers = mergeVehicleOffersPatch(activeLead ?? {}, cardId, nextOffer);
    updateLead(result.leadId, {
      crm: {
        ...(activeLead?.crm ?? {}),
        vehicleOffers,
      },
    });
    if (historyMeta?.text) {
      addHistory(result.leadId, historyMeta.text, historyMeta.type ?? 'note');
    }
  }

  async function handleOfferUploadPdf(file) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    const next = await attachPdfToOffer(base, file);
    persistVehicleOffer(offerEditCard.id, next, {
      text: VEHICLE_OFFER_HISTORY.pdf_uploaded,
      type: 'offer_pdf',
    });
    showToast('Angebot hinterlegt');
  }

  function handleOfferCreateLink() {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    const title = formatVehicleCardTitle(offerEditCard);
    const next = createOnlineLinkForOffer(base, {
      modelName: title,
      customerName: activeLead?.contact?.name ?? '',
    });
    persistVehicleOffer(offerEditCard.id, next, {
      text: VEHICLE_OFFER_HISTORY.link_created,
      type: 'offer_link',
    });
    showToast('Link bereit');
  }

  function handleOfferDeletePdf() {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    const next = {
      ...base,
      status: VEHICLE_OFFER_STATUS.DRAFT,
      pdf: null,
      onlineLink: null,
      sentVia: null,
      sentAt: null,
    };
    persistVehicleOffer(offerEditCard.id, next);
    showToast('PDF entfernt');
  }

  function handleOfferMarkSent(via) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    if (!base.onlineLink?.url) return;
    const next = markOfferSent(base, via);
    const historyMap = {
      email: { text: VEHICLE_OFFER_HISTORY.sent_email, type: 'offer_sent_email' },
      whatsapp: { text: VEHICLE_OFFER_HISTORY.sent_whatsapp, type: 'offer_sent_whatsapp' },
      copy: { text: 'Link kopiert – bereit zum Teilen', type: 'offer_sent' },
    };
    const meta = historyMap[via] ?? null;
    persistVehicleOffer(offerEditCard.id, next, meta);
    if (via !== 'copy') showToast('Angebot gesendet');
  }

  function handleOfferStatusChange(statusId) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    let next = { ...base, status: statusId };
    if (statusId === VEHICLE_OFFER_STATUS.OPENED) {
      next = recordOfferOpened(base);
    }
    const historyMap = {
      [VEHICLE_OFFER_STATUS.ACCEPTED]: { text: VEHICLE_OFFER_HISTORY.accepted, type: 'offer_accepted' },
      [VEHICLE_OFFER_STATUS.REJECTED]: { text: VEHICLE_OFFER_HISTORY.rejected, type: 'offer_rejected' },
      [VEHICLE_OFFER_STATUS.OPENED]: { text: VEHICLE_OFFER_HISTORY.opened, type: 'offer_opened' },
    };
    persistVehicleOffer(offerEditCard.id, next, historyMap[statusId] ?? null);
    showToast('Status aktualisiert');
  }

  function handleOfferSave() {
    if (!offerEditCard) return;
    const base = getVehicleOffer(activeLead ?? {}, offerEditCard);
    persistVehicleOffer(offerEditCard.id, base);
    showToast('Gespeichert');
  }

  function handleUnterlagenSave(unterlagen, historyText, historyType = 'unterlagen') {
    if (!result?.leadId) return;
    updateLead(result.leadId, {
      crm: {
        ...(activeLead?.crm ?? {}),
        cleverUnterlagen: unterlagen,
      },
    });
    if (historyText) {
      addHistory(result.leadId, historyText, historyType);
    }
  }

  const activeOfferEdit = offerEditCard
    ? getVehicleOffer(activeLead ?? {}, offerEditCard)
    : null;

  const pageKicker = 'Digitaler Verkaufsassistent';
  const pageTitle = phase === 'followup' || phase === 'capture' || phase === 'offer-edit'
    ? ''
    : phase === 'review'
      ? 'Kundenwunsch'
      : phase === 'done' && result?.type !== 'lead'
        ? 'Ich habe erkannt'
        : 'Was sucht Ihr Kunde?';
  const pageTagline = phase === 'followup' || phase === 'capture' || phase === 'offer-edit'
    ? ''
    : phase === 'review'
      ? `${Math.round((parsed?.confidence ?? 0) * 100)} % sicher · bitte kurz prüfen`
      : phase === 'input'
        ? ''
        : 'Bitte kurz prüfen.';

  const showMainHero = phase !== 'followup'
    && phase !== 'capture'
    && phase !== 'offer-edit'
    && !(phase === 'input' && startView !== 'home');

  const vehicleCard = parsed?.ok && result
    ? formatDealerAiVehicleCard(parsed.fields, conditions)
    : null;

  const captureKnownCustomer = activeLead
    ? hasKnownCustomerContact(activeLead.contact)
    : Boolean(carryCustomer);

  return (
    <div className="dealer-ai-page">
      <main className={`dealer-ai-main${phase === 'review' ? ' dealer-ai-main--review' : ''}${phase === 'followup' || phase === 'offer-edit' ? ' dealer-ai-main--akte' : ''}`}>
        {showMainHero && (
          <div className={`dealer-ai-hero${phase === 'review' ? ' dealer-ai-hero--review' : ''}`}>
            {phase !== 'review' && (
              <p className="dealer-ai-kicker">{pageKicker}</p>
            )}
            <h1 className="dealer-ai-title">{pageTitle}</h1>
            {pageTagline && <p className="dealer-ai-tagline">{pageTagline}</p>}
          </div>
        )}

        {phase === 'input' && startView === 'home' && (
          <DealerAiStartScreen
            text={input}
            onTextChange={setInput}
            onVoiceParsed={handleVoiceParsed}
            onEvaluate={() => runAnalysis()}
            onStartAdvice={() => setStartView('advice')}
            onStartModel={() => setStartView('model')}
            isAnalyzing={isAnalyzing}
            inputRef={inputRef}
            carryCustomer={carryCustomer}
          />
        )}

        {phase === 'input' && startView === 'advice' && (
          <DealerAiCleverBeratung
            onBack={() => setStartView('home')}
            onEvaluate={(chipIds) => runAnalysis({ chipIds })}
            isAnalyzing={isAnalyzing}
          />
        )}

        {phase === 'input' && startView === 'model' && (
          <DealerAiModelFlow
            onBack={() => setStartView('home')}
            onEvaluate={({ model, chipIds }) => runAnalysis({ modelName: model.name, chipIds })}
            isAnalyzing={isAnalyzing}
          />
        )}

        {phase === 'review' && parsed?.ok && (
          <>
            <DealerAiAnalysisCard
              parsed={parsed}
              onFieldsChange={handleFieldsChange}
            />
            <DealerAiSuggestedModels
              models={parsed.suggestedModels}
              selectedModelIds={selectedModelIds}
              onToggleReserve={handleToggleReserveModel}
            />
            <DealerAiReviewBar
              reservedCount={selectedModelIds.length}
              onCreateLead={handleCreateLead}
              onEdit={handleEdit}
              isExecuting={isExecuting}
            />
          </>
        )}

        {phase === 'capture' && result?.type === 'lead' && parsed?.ok && (
          <DealerAiCustomerCapture
            parsed={parsed}
            lead={activeLead}
            leads={leads}
            knownCustomer={captureKnownCustomer}
            onSave={handleCaptureSave}
            onComplete={handleCaptureComplete}
            onAdoptCustomer={handleAdoptCustomer}
            onOpenLead={handleOpenCustomerLead}
          />
        )}

        {phase === 'followup' && result?.type === 'lead' && (
          <DealerAiLeadFollowUp
            result={result}
            parsed={parsed}
            lead={activeLead}
            leads={leads}
            isFresh={isFreshLead}
            isReturningWish={isReturningWish}
            onEnterDetail={handleEnterLeadDetail}
            onNewWish={handleDiscard}
            onStartNewWish={handleStartNewWish}
            onSave={handleLeadSave}
            onPrepareOffer={handlePrepareOffer}
            onOpenOfferEdit={handleOpenOfferEdit}
            onReturnToReview={handleReturnToReview}
            onDiscard={handleDiscard}
            onAddHistory={handleLeadHistory}
            isSaving={isSavingLead}
          />
        )}

        {phase === 'offer-edit' && result?.type === 'lead' && offerEditCard && (
          <CustomerOfferEditView
            card={offerEditCard}
            customerName={activeLead?.contact?.name ?? ''}
            phone={activeLead?.contact?.phone ?? ''}
            email={activeLead?.contact?.email ?? ''}
            referenceCode={activeLead?.referenceCode ?? activeLead?.offerCode ?? null}
            deliveryNote={activeLead?.deliveryTime ?? activeLead?.wish?.desiredDeliveryDate ?? ''}
            offer={activeOfferEdit ?? createVehicleOfferFromCard(offerEditCard)}
            history={activeLead?.history ?? []}
            lead={activeLead}
            telHref={phoneTelHref(activeLead?.contact?.phone ?? '')}
            onBack={handleBackFromOffer}
            onSave={handleOfferSave}
            onSaveUnterlagen={handleUnterlagenSave}
            onUploadPdf={handleOfferUploadPdf}
            onCreateLink={handleOfferCreateLink}
            onDeletePdf={handleOfferDeletePdf}
            onMarkSent={handleOfferMarkSent}
            onStatusChange={handleOfferStatusChange}
            isSaving={isSavingLead}
          />
        )}

        {phase === 'done' && result && result.type !== 'lead' && (
          <>
            <DealerAiResultPanel result={result} vehicleCard={vehicleCard} />
            <button type="button" className="dai-btn dai-btn--primary" onClick={handleDiscard}>
              Neuen Kundenwunsch erfassen
            </button>
          </>
        )}
      </main>

      {phase !== 'followup' && phase !== 'offer-edit' && (
        <DealerAppLegalMenu compact className="dealer-ai-legal" />
      )}

      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
