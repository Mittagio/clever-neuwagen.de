import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import {
  applyDealerAiFields,
  suggestActionForPaymentType,
} from '../../services/dealerAiParser.js';
import { resolveDealerAiVehicleSuggestions } from '../../services/dealerAiVehicleSuggestions.js';
import { pipelineToLeadStatus } from '../../services/dealerAiLeadCrm.js';
import { executeDealerAiAction } from '../../services/dealerAiActions.js';
import DealerAiLeadFollowUp from '../../components/dealer-ai/DealerAiLeadFollowUp.jsx';
import CustomerOfferEditView from '../../components/dealer-ai/CustomerOfferEditView.jsx';
import CustomerOfferProposalView from '../../components/dealer-ai/CustomerOfferProposalView.jsx';
import { buildKundenaktePath, buildParsedFromLead } from '../../services/leadAkteEntry.js';
import { recordRecentCustomerOpen } from '../../services/crm/customerSearchService.js';
import { buildAddVehicleContextFromLead } from '../../services/customerAddVehicleFlow.js';
import { buildAddProposalNavigateContext } from '../../services/dealer/customerAddProposalFlow.js';
import {
  enrichOfferEditCardFromLead,
  buildOfferEditPendingFields,
  cardNeedsConditionsConfigure,
} from '../../services/dealer/offerEditWishMerge.js';
import { setActiveSalesChanceId } from '../../services/sales/activeSalesChanceStore.js';
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
} from '../../services/vehicleOffer.js';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import { phoneTelHref } from '../../services/dealerAiLeadCrm.js';
import {
  buildCleverConsultationOfferPrefill,
  buildLeadPatchFromCleverPrefill,
} from '../../services/dealer/cleverConsultationOfferPrefill.js';
import '../DealerAIPage.css';
import './BackendLeadAktePage.css';

export default function BackendLeadAktePage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { leads, updateLead, addHistory } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const lead = leads.find((l) => l.id === leadId) ?? null;
  const [parsed, setParsed] = useState(null);
  const [phase, setPhase] = useState('followup');
  const [offerEditCard, setOfferEditCard] = useState(null);
  const [offerProposalCard, setOfferProposalCard] = useState(null);
  const [offerEditFromProposal, setOfferEditFromProposal] = useState(false);
  const [cleverOfferTransfer, setCleverOfferTransfer] = useState(null);
  const [offerPendingFields, setOfferPendingFields] = useState([]);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [toast, setToast] = useState('');

  const initialSheet = searchParams.get('sheet') === 'question_answer'
    ? 'question_answer'
    : (searchParams.get('sheet') === 'antworten' ? 'antworten' : (searchParams.get('sheet') || null));

  const initialAntwortenIntent = searchParams.get('intentId') || null;
  const initialInboxItemId = searchParams.get('inboxItemId') || null;
  const initialThreadId = searchParams.get('threadId') || null;
  const initialMessageId = searchParams.get('messageId') || null;
  const initialAntwortenOfferId = searchParams.get('offerId') || null;

  const initialQuestionContext = useMemo(() => {
    if (searchParams.get('sheet') !== 'question_answer') return null;
    const offerId = searchParams.get('offerId');
    const questionId = searchParams.get('questionId');
    if (!offerId || !questionId) return null;
    return {
      offerId,
      questionId,
      inboxItemId: searchParams.get('inboxItemId') || null,
    };
  }, [searchParams]);

  const [questionAnswerContext, setQuestionAnswerContext] = useState(initialQuestionContext);

  useEffect(() => {
    setQuestionAnswerContext(initialQuestionContext);
  }, [initialQuestionContext]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  function navigateToAddVehicle(sourceLead = lead, options = {}) {
    if (!sourceLead) return;
    const returnPath = buildKundenaktePath(sourceLead.id);
    const addVehicleContext = (options.proposalIntent || options.paymentType || options.openConditions)
      ? buildAddProposalNavigateContext(sourceLead, { returnPath, ...options })
      : buildAddVehicleContextFromLead(sourceLead, { returnPath });
    if (options.openConditions) {
      addVehicleContext.openConditions = true;
    }
    if (options.focusModelKey) {
      addVehicleContext.focusModelKey = options.focusModelKey;
    }
    navigate('/verkaufsassistent', { state: { addVehicleContext } });
  }

  function navigateToConfigureConditions(sourceLead = lead, card = null) {
    if (!sourceLead) return;
    const enriched = card ? enrichOfferEditCardFromLead(card, sourceLead) : null;
    navigateToAddVehicle(sourceLead, {
      proposalIntent: 'vehicle',
      paymentType: enriched?.paymentType && enriched.paymentType !== 'unknown'
        ? enriched.paymentType
        : (sourceLead.paymentType !== 'unknown' ? sourceLead.paymentType : null),
      openConditions: true,
      focusModelKey: enriched?.modelKey ?? card?.modelKey ?? null,
    });
  }

  useEffect(() => {
    const msg = location.state?.toast;
    if (!msg) return;
    showToast(msg);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.toast, location.pathname, navigate, showToast]);

  const enrichWithSuggestions = useCallback((nextParsed) => {
    if (!nextParsed?.ok) return nextParsed;
    return {
      ...nextParsed,
      suggestedModels: resolveDealerAiVehicleSuggestions(nextParsed.fields, conditions, []),
    };
  }, [conditions]);

  useEffect(() => {
    if (!lead) {
      setParsed(null);
      return;
    }
    setActiveSalesChanceId(lead.id);
    recordRecentCustomerOpen(lead);
    setParsed(buildParsedFromLead(lead, enrichWithSuggestions));
  }, [lead, enrichWithSuggestions]);

  function handleLeadSave(patch, meta = {}) {
    if (!leadId) return;
    setIsSavingLead(true);
    updateLead(leadId, patch);
    if (!meta.silent && meta.historyText) {
      addHistory(leadId, meta.historyText, meta.historyType ?? 'note');
    }
    if (meta.addFollowupHistory !== false && patch.crm?.nextStepLabel) {
      addHistory(leadId, `Nachfassen geplant: ${patch.crm.nextStepLabel}`, 'followup');
    }
    setIsSavingLead(false);
    if (!meta.silent) showToast('Gespeichert');
  }

  function handleLeadHistory(text, type = 'note', options = {}) {
    if (!leadId) return;
    addHistory(leadId, text, type, options);
    if (options.pipelineStatusId) {
      updateLead(leadId, {
        status: pipelineToLeadStatus(options.pipelineStatusId),
        crm: {
          ...(lead?.crm ?? {}),
          pipelineStatusId: options.pipelineStatusId,
        },
      });
    }
    if (!options.silent) showToast('Eintrag in Historie gespeichert');
  }

  function handlePrepareOfferFromClever() {
    if (!leadId || !lead) return;
    const prefill = buildCleverConsultationOfferPrefill(lead);
    if (!prefill) {
      handlePrepareOffer();
      return;
    }

    const leadPatch = buildLeadPatchFromCleverPrefill(prefill, lead);
    updateLead(leadId, leadPatch);
    addHistory(leadId, 'Angebot aus Clever-Beratung vorbereitet', 'note');

    if (parsed?.ok) {
      setParsed(enrichWithSuggestions(applyDealerAiFields(parsed, prefill.parsedFieldPatches)));
    }

    setCleverOfferTransfer(prefill.cleverTransfer);
    setOfferPendingFields(prefill.pendingFields);
    setOfferEditCard(prefill.card);
    setPhase('offer-edit');
  }

  function handlePrepareOffer(reservedModel) {
    if (!parsed?.ok || !leadId) return;
    let nextParsed = parsed;
    if (reservedModel) {
      nextParsed = enrichWithSuggestions(applyDealerAiFields(parsed, {
        model: reservedModel.name?.replace(/^Kia\s+/i, '') ?? parsed.fields?.model,
        brand: 'Kia',
        modelId: reservedModel.modelKey ?? reservedModel.id,
        trimLabel: reservedModel.trimLabel ?? parsed.fields?.trimLabel,
      }));
      setParsed(nextParsed);
    }
    const actionId = suggestActionForPaymentType(nextParsed.fields.paymentType ?? 'unknown');
    try {
      executeDealerAiAction(actionId === 'create_sales_opportunity' ? 'create_offer' : actionId, nextParsed, {
        conditions,
        addOffer,
        getExistingCodes,
        leads,
        addLead: () => {},
        updateLead,
        linkLead,
        selectedModelIds: [],
        carryCustomer: null,
      });
      showToast('Angebot vorbereitet');
    } catch (err) {
      showToast(err.message ?? 'Angebot konnte nicht erstellt werden');
    }
  }

  function handleOpenQuestionAnswer({ offerId, questionId, inboxItemId = null }) {
    setQuestionAnswerContext({ offerId, questionId, inboxItemId });
    setOfferProposalCard(null);
    setPhase('followup');
  }

  function handleQuestionAnswerContextConsumed() {
    setQuestionAnswerContext(null);
    if (searchParams.get('sheet')) {
      navigate(buildKundenaktePath(leadId), { replace: true });
    }
  }

  function handleBack() {
    navigate('/backend/neue-anfragen');
  }

  function handleOpenOfferProposal(card) {
    setOfferProposalCard(card);
    setPhase('offer-proposal');
  }

  function handleBackFromProposal() {
    setOfferProposalCard(null);
    setPhase('followup');
  }

  function handleOpenOfferEdit(card, { fromProposal = false } = {}) {
    const enriched = enrichOfferEditCardFromLead(card, lead);
    if (cardNeedsConditionsConfigure(enriched)) {
      navigateToConfigureConditions(lead, enriched);
      return;
    }
    setOfferEditCard(enriched);
    setOfferEditFromProposal(fromProposal);
    setCleverOfferTransfer(lead?.crm?.cleverOfferTransfer ?? null);
    setOfferPendingFields(buildOfferEditPendingFields(enriched, {
      deliveryNote: lead?.deliveryTime ?? lead?.wish?.desiredDeliveryDate ?? '',
    }));
    setPhase('offer-edit');
  }

  function handleEditOfferConditions(card) {
    navigateToConfigureConditions(lead, card);
  }

  function handleBackFromOffer() {
    setOfferEditCard(null);
    setCleverOfferTransfer(null);
    setOfferPendingFields([]);
    if (offerEditFromProposal && offerProposalCard) {
      setOfferEditFromProposal(false);
      setPhase('offer-proposal');
      return;
    }
    setOfferEditFromProposal(false);
    setPhase('followup');
  }

  function resolveOfferActionCard() {
    return offerEditCard ?? offerProposalCard;
  }

  function persistVehicleOffer(cardId, nextOffer, historyMeta = null) {
    if (!leadId || !cardId) return;
    const vehicleOffers = mergeVehicleOffersPatch(lead ?? {}, cardId, nextOffer);
    updateLead(leadId, {
      crm: {
        ...(lead?.crm ?? {}),
        vehicleOffers,
      },
    });
    if (historyMeta?.text) {
      addHistory(leadId, historyMeta.text, historyMeta.type ?? 'note');
    }
  }

  async function handleOfferUploadPdf(file) {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(lead ?? {}, card);
    const next = await attachPdfToOffer(base, file);
    persistVehicleOffer(card.id, next, {
      text: VEHICLE_OFFER_HISTORY.pdf_uploaded,
      type: 'offer_pdf',
    });
    showToast('Angebot hinterlegt');
  }

  function handleOfferCreateLink() {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(lead ?? {}, card);
    const title = formatVehicleCardTitle(card);
    const next = createOnlineLinkForOffer(base, {
      modelName: title,
      customerName: lead?.contact?.name ?? '',
      leadId: lead?.id,
      vehicleCardId: card.id,
    });
    persistVehicleOffer(card.id, next, {
      text: VEHICLE_OFFER_HISTORY.link_created,
      type: 'offer_link',
    });
    showToast('Link bereit');
  }

  function handleOfferDeletePdf() {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(lead ?? {}, card);
    persistVehicleOffer(card.id, {
      ...base,
      status: VEHICLE_OFFER_STATUS.DRAFT,
      pdf: null,
      onlineLink: null,
      sentVia: null,
      sentAt: null,
    });
    showToast('PDF entfernt');
  }

  function handleOfferMarkSent(via) {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(lead ?? {}, card);
    if (!base.onlineLink?.url) return;
    const next = markOfferSent(base, via);
    const historyMap = {
      email: { text: VEHICLE_OFFER_HISTORY.sent_email, type: 'offer_sent_email' },
      whatsapp: { text: VEHICLE_OFFER_HISTORY.sent_whatsapp, type: 'offer_sent_whatsapp' },
      copy: { text: 'Link kopiert – bereit zum Teilen', type: 'offer_sent' },
    };
    persistVehicleOffer(card.id, next, historyMap[via] ?? null);
    if (via !== 'copy') showToast('Angebot gesendet');
  }

  function handleOfferStatusChange(statusId) {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(lead ?? {}, card);
    let next = { ...base, status: statusId };
    if (statusId === VEHICLE_OFFER_STATUS.OPENED) {
      next = recordOfferOpened(base);
    }
    const historyMap = {
      [VEHICLE_OFFER_STATUS.ACCEPTED]: { text: VEHICLE_OFFER_HISTORY.accepted, type: 'offer_accepted' },
      [VEHICLE_OFFER_STATUS.REJECTED]: { text: VEHICLE_OFFER_HISTORY.rejected, type: 'offer_rejected' },
      [VEHICLE_OFFER_STATUS.OPENED]: { text: VEHICLE_OFFER_HISTORY.opened, type: 'offer_opened' },
    };
    persistVehicleOffer(card.id, next, historyMap[statusId] ?? null);
    showToast('Status aktualisiert');
  }

  function handleOfferSave() {
    const card = resolveOfferActionCard();
    if (!card) return;
    persistVehicleOffer(card.id, getVehicleOffer(lead ?? {}, card));
    showToast('Gespeichert');
  }

  function handleUnterlagenSave(unterlagen, historyText, historyType = 'unterlagen') {
    if (!leadId) return;
    updateLead(leadId, {
      crm: {
        ...(lead?.crm ?? {}),
        cleverUnterlagen: unterlagen,
      },
    });
    if (historyText) {
      addHistory(leadId, historyText, historyType);
    }
  }

  const activeOfferEdit = offerEditCard
    ? getVehicleOffer(lead ?? {}, offerEditCard)
    : null;

  const activeOfferProposal = offerProposalCard
    ? getVehicleOffer(lead ?? {}, offerProposalCard)
    : null;

  if (!lead) {
    return (
      <div className="backend-lead-akte backend-lead-akte--empty">
        <p>Verkaufschance nicht gefunden.</p>
        <Link to="/backend/neue-anfragen">Zurück zu neuen Anfragen</Link>
      </div>
    );
  }

  return (
    <div className="backend-lead-akte dealer-ai-page">
      <main className={`dealer-ai-main${phase === 'offer-edit' || phase === 'offer-proposal' ? ' dealer-ai-main--configure' : ' dealer-ai-main--akte'}`}>
        {phase === 'followup' && parsed && (
          <DealerAiLeadFollowUp
            result={{ type: 'lead', leadId }}
            parsed={parsed}
            lead={lead}
            leads={leads}
            isFresh={false}
            onEnterDetail={() => navigate(`/backend/verkaufschancen?leadId=${encodeURIComponent(leadId)}`)}
            onNewWish={() => navigateToAddVehicle(lead)}
            onStartNewWish={(currentLead, options) => navigateToAddVehicle(currentLead ?? lead, options)}
            onSave={handleLeadSave}
            onPrepareOffer={handlePrepareOffer}
            onPrepareOfferFromClever={handlePrepareOfferFromClever}
            onOpenOfferProposal={handleOpenOfferProposal}
            onOpenInbox={(currentLead) => navigate(`/backend/clever-eingang?leadId=${encodeURIComponent(currentLead.id)}`)}
            onOpenOfferEdit={handleOpenOfferEdit}
            onReturnToReview={() => navigate('/verkaufsassistent')}
            onDiscard={handleBack}
            onAddHistory={handleLeadHistory}
            isSaving={isSavingLead}
            initialSheet={initialSheet === 'question_answer' ? 'question_answer' : initialSheet}
            initialAntwortenIntent={initialAntwortenIntent}
            initialInboxItemId={initialInboxItemId}
            initialThreadId={initialThreadId}
            initialMessageId={initialMessageId}
            initialAntwortenOfferId={initialAntwortenOfferId}
            initialQuestionContext={questionAnswerContext}
            onOpenOfferQuestionAnswer={handleOpenQuestionAnswer}
            onQuestionAnswerContextConsumed={handleQuestionAnswerContextConsumed}
          />
        )}

        {phase === 'offer-proposal' && offerProposalCard && (
          <CustomerOfferProposalView
            card={offerProposalCard}
            customerName={lead?.contact?.name ?? ''}
            phone={lead?.contact?.phone ?? ''}
            email={lead?.contact?.email ?? ''}
            offer={activeOfferProposal ?? createVehicleOfferFromCard(offerProposalCard)}
            lead={lead}
            onBack={handleBackFromProposal}
            onEditOffer={(card) => handleOpenOfferEdit(card, { fromProposal: true })}
            onMarkSent={handleOfferMarkSent}
            onStatusChange={handleOfferStatusChange}
            onAnswerQuestion={(question) => handleOpenQuestionAnswer({
              offerId: offerProposalCard.id,
              questionId: question.id,
            })}
          />
        )}

        {phase === 'offer-edit' && offerEditCard && (
          <CustomerOfferEditView
            card={offerEditCard}
            customerName={lead?.contact?.name ?? ''}
            phone={lead?.contact?.phone ?? ''}
            email={lead?.contact?.email ?? ''}
            referenceCode={lead?.referenceCode ?? lead?.offerCode ?? null}
            deliveryNote={lead?.deliveryTime ?? lead?.wish?.desiredDeliveryDate ?? ''}
            offer={activeOfferEdit ?? createVehicleOfferFromCard(offerEditCard)}
            lead={lead}
            cleverTransfer={cleverOfferTransfer ?? lead?.crm?.cleverOfferTransfer ?? null}
            pendingFields={offerPendingFields}
            backLabel={offerEditFromProposal ? '← Zum Vorschlag' : '← Zur Kundenakte'}
            onBack={handleBackFromOffer}
            onSave={handleOfferSave}
            onUploadPdf={handleOfferUploadPdf}
            onCreateLink={handleOfferCreateLink}
            onDeletePdf={handleOfferDeletePdf}
            onMarkSent={handleOfferMarkSent}
            onStatusChange={handleOfferStatusChange}
            onEditConditions={handleEditOfferConditions}
            isSaving={isSavingLead}
          />
        )}
      </main>
      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
