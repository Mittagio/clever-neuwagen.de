import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import DealerAiVehicleConfigure from '../components/dealer-ai/DealerAiVehicleConfigure.jsx';
import DealerAiConditionsStep from '../components/dealer-ai/DealerAiConditionsStep.jsx';
import DealerAiOfferPreview from '../components/dealer-ai/DealerAiOfferPreview.jsx';
import CustomerAddVehicleDuplicatePrompt from '../components/dealer-ai/CustomerAddVehicleDuplicatePrompt.jsx';
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
import {
  applyCustomerContextToFields,
  mergeConfigureCustomerContext,
} from '../services/dealerAiCustomerContext.js';
import {
  buildConfigureDraft,
  buildSelectedModelFieldPatch,
  fieldsFromConfigureDraft,
  hasRecognizedModelKey,
  resolvePhaseAfterAnalysis,
  resolvePrimarySuggestedModel,
} from '../services/dealerAiVehicleConfigureFlow.js';
import { buildVehicleConfiguration } from '../services/configuration/vehicleConfigurationModel.js';
import {
  buildAddVehicleContextFromLead,
  getContextBannerLabel,
  getReviewBarButtonLabel,
  isCustomerRecordAddVehicleContext,
} from '../services/customerAddVehicleFlow.js';
import { buildParsedFromLead } from '../services/leadAkteEntry.js';
import { recordRecentCustomerOpen } from '../services/crm/customerSearchService.js';
import {
  buildOfferDraft,
  executeSaveOfferDraft,
  offerDraftToParserFields,
} from '../services/dealerAiOfferCreate.js';
import { phoneTelHref } from '../services/dealerAiLeadCrm.js';
import DealerAppLegalMenu from '../components/dealer/DealerAppLegalMenu.jsx';
import './DealerAIPage.css';

export default function DealerAIPage() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [addVehicleContext, setAddVehicleContext] = useState(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [toast, setToast] = useState('');
  const [offerEditCard, setOfferEditCard] = useState(null);
  const [configureDraft, setConfigureDraft] = useState(null);
  const [vehicleConfiguration, setVehicleConfiguration] = useState(null);
  const [configureOfferDraft, setConfigureOfferDraft] = useState(null);
  const [offerPreviewSaved, setOfferPreviewSaved] = useState(false);
  const [offerPreviewSaveResult, setOfferPreviewSaveResult] = useState(null);

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

  const bootstrapConfigureState = useCallback((nextParsed) => {
    const primaryModel = resolvePrimarySuggestedModel(nextParsed);
    let draft = buildConfigureDraft(nextParsed, conditions, primaryModel);
    const crmCustomer = mergeConfigureCustomerContext({ parsedFields: nextParsed.fields });
    if (crmCustomer.hasContact || draft.customer?.mailNote) {
      draft = {
        ...draft,
        customer: {
          ...draft.customer,
          name: crmCustomer.name ?? draft.customer?.name,
          firstName: crmCustomer.firstName ?? draft.customer?.firstName,
          lastName: crmCustomer.lastName ?? draft.customer?.lastName,
          salutation: crmCustomer.salutation ?? draft.customer?.salutation,
          phone: crmCustomer.phone ?? draft.customer?.phone,
          email: crmCustomer.email ?? draft.customer?.email,
          mailNote: draft.customer?.mailNote ?? crmCustomer.mailNote ?? null,
          interestedPartyName: draft.customer?.interestedPartyName ?? null,
        },
      };
    }
    setConfigureDraft(draft);
    setVehicleConfiguration(null);
    setConfigureOfferDraft(null);
    if (primaryModel?.id) {
      setSelectedModelIds([primaryModel.id]);
    }
  }, [conditions]);

  const applyParsedWithPhase = useCallback((nextParsed, chipIds = selectedChipIds) => {
    const enriched = enrichWithSuggestions(nextParsed, chipIds);
    setParsed(enriched);
    const nextPhase = resolvePhaseAfterAnalysis(enriched);
    if (nextPhase === 'configure') {
      bootstrapConfigureState(enriched);
    } else {
      setConfigureDraft(null);
      setVehicleConfiguration(null);
      setConfigureOfferDraft(null);
      setSelectedModelIds([]);
    }
    setStartView('home');
    setPhase(nextPhase);
  }, [bootstrapConfigureState, enrichWithSuggestions, selectedChipIds]);

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

    applyParsedWithPhase(next, [...selectedChipIds, ...extraChips]);
  }

  function handleModelConfigure({ model, parsed: modelParsed }) {
    setInput(`Kia ${model.name}`);
    setSelectedModelIds(model?.id ? [model.id] : []);
    applyParsedWithPhase(modelParsed, []);
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
    setDuplicatePrompt(null);
    setConfigureDraft(null);
    setVehicleConfiguration(null);
    setConfigureOfferDraft(null);
  }

  function clearAddVehicleFlow() {
    setAddVehicleContext(null);
    setDuplicatePrompt(null);
  }

  function handleConfigureDraftChange(nextDraft) {
    setConfigureDraft(nextDraft);
    setParsed((prev) => enrichWithSuggestions(
      applyDealerAiFields(prev, fieldsFromConfigureDraft(nextDraft, prev?.fields)),
    ));
  }

  function handleConfigureContinueToConditions() {
    setVehicleConfiguration(buildVehicleConfiguration(configureDraft));
    setPhase('conditions');
  }

  function handleConditionsBack() {
    setPhase('configure');
  }

  function handleConditionsToPreview() {
    if (!parsed?.ok || !configureDraft || !vehicleConfiguration) return;

    const mergedFields = fieldsFromConfigureDraft(configureDraft, parsed.fields);
    const updatedParsed = enrichWithSuggestions(applyDealerAiFields(parsed, mergedFields));
    setParsed(updatedParsed);

    const contextLead = addVehicleContext?.opportunityId
      ? leads.find((l) => l.id === addVehicleContext.opportunityId)
      : null;

    const offerDraft = buildOfferDraft({
      configureDraft,
      vehicleConfiguration,
      parsed: updatedParsed,
      conditions,
      carryCustomer,
      addVehicleContext,
      lead: contextLead,
    });

    setConfigureOfferDraft(offerDraft);
    setOfferPreviewSaved(false);
    setOfferPreviewSaveResult(null);
    setPhase('offer-preview');
  }

  function handleOfferPreviewBack() {
    setConfigureOfferDraft(null);
    setOfferPreviewSaved(false);
    setOfferPreviewSaveResult(null);
    setPhase('conditions');
  }

  function handleOfferPreviewPreparePdf() {
    showToast('PDF / Kundenlink – Vorbereitung folgt in Kürze');
  }

  function handleOfferPreviewSave() {
    if (!configureOfferDraft || offerPreviewSaved) return false;

    setIsExecuting(true);

    try {
      const saveResult = executeSaveOfferDraft(configureOfferDraft, {
        parsed,
        conditions,
        leads,
        addLead,
        updateLead,
        getExistingCodes,
        selectedModelIds,
      });

      setOfferPreviewSaved(true);
      setOfferPreviewSaveResult(saveResult);
      showToast(saveResult.message);

      if (saveResult.offerDraft) {
        setParsed((prev) => enrichWithSuggestions(
          applyDealerAiFields(prev, offerDraftToParserFields(saveResult.offerDraft)),
        ));
      }

      if (saveResult.activityText && saveResult.leadId) {
        addHistory(saveResult.leadId, saveResult.activityText, 'offer');
      }

      return true;
    } catch (err) {
      showToast(err.message ?? 'Angebot konnte nicht gespeichert werden');
      return false;
    } finally {
      setIsExecuting(false);
    }
  }

  function handleOfferPreviewFinish() {
    const saveResult = offerPreviewSaveResult;
    if (!saveResult) return;

    setResult({ type: 'lead', leadId: saveResult.leadId, customerId: saveResult.customerId });
    setOfferEditCard(saveResult.card);
    setConfigureOfferDraft(null);
    setConfigureDraft(null);
    setVehicleConfiguration(null);
    setOfferPreviewSaved(false);
    setOfferPreviewSaveResult(null);

    if (saveResult.needsCapture) {
      setPhase('capture');
      setIsFreshLead(true);
      setIsReturningWish(Boolean(carryCustomer));
    } else {
      setPhase('followup');
      setIsFreshLead(saveResult.mode !== 'attached_to_opportunity');
      setIsReturningWish(Boolean(saveResult.customerId && carryCustomer));
      clearAddVehicleFlow();
    }
  }

  function handleConfigureBack() {
    if (addVehicleContext?.returnPath) {
      navigate(addVehicleContext.returnPath);
      return;
    }
    setPhase('input');
    setStartView('home');
  }

  function handleSwitchToSearch() {
    setPhase('review');
    setConfigureDraft(null);
    setVehicleConfiguration(null);
    setConfigureOfferDraft(null);
  }

  function handleEdit() {
    setPhase('input');
    setStartView('home');
    setParsed(null);
    setSelectedModelIds([]);
    setConfigureDraft(null);
    setVehicleConfiguration(null);
    setConfigureOfferDraft(null);
    setResult(null);
    inputRef.current?.focus();
  }

  function handleDiscard() {
    resetWishInput();
    setCarryCustomer(null);
    clearAddVehicleFlow();
    setIsFreshLead(false);
    setIsReturningWish(false);
    setOfferEditCard(null);
    setPhase('input');
  }

  function handleStartNewWish(sourceLead) {
    const ctx = buildAddVehicleContextFromLead(sourceLead);
    const carry = extractCarryCustomerFromLead(sourceLead);
    resetWishInput();
    setAddVehicleContext(ctx);
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
    const ctx = location.state?.addVehicleContext;
    if (!ctx?.customerId) return;
    const lead = ctx.opportunityId
      ? leads.find((l) => l.id === ctx.opportunityId)
      : null;
    const carry = lead
      ? extractCarryCustomerFromLead(lead)
      : {
          customerId: ctx.customerId,
          contact: { name: ctx.customerName ?? '', phone: '', email: '' },
        };
    setAddVehicleContext(ctx);
    setCarryCustomer(carry);
    setIsReturningWish(true);
    setIsFreshLead(false);
  }, [location.state?.addVehicleContext, leads]);

  useEffect(() => {
    const wishText = location.state?.wishText;
    if (!wishText) return;
    setInput(wishText);
    const next = parseDealerAiInput(wishText);
    if (next.ok) {
      applyParsedWithPhase(next);
    }
  }, [location.state?.wishText, applyParsedWithPhase]);

  useEffect(() => {
    const leadId = location.state?.leadId;
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    recordRecentCustomerOpen(lead);
    setResult({ type: 'lead', leadId });
    setIsFreshLead(Boolean(location.state?.fresh));
    setPhase('followup');
    if (lead.notes) {
      const next = parseDealerAiInput(lead.notes);
      if (next.ok) setParsed(enrichWithSuggestions(next));
      else setParsed(enrichWithSuggestions(buildParsedFromLead(lead)));
    } else {
      setParsed(enrichWithSuggestions(buildParsedFromLead(lead)));
    }
  }, [location.state?.leadId, leads, enrichWithSuggestions]);

  useEffect(() => {
    if (!location.state?.focusText || phase !== 'input') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [location.state, phase]);

  function runAction(actionId, extraDeps = {}) {
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
        addVehicleContext,
        ...extraDeps,
      });

      return actionResult;
    } catch (err) {
      showToast(err.message ?? 'Aktion fehlgeschlagen');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }

  function finishAddVehicleAction(actionResult) {
    if (!actionResult) return;
    if (actionResult.type === 'duplicate') {
      setDuplicatePrompt(actionResult);
      return;
    }
    if (actionResult.type !== 'vehicle_added') return;

    const targetPath = actionResult.returnPath
      ?? (actionResult.leadId ? `/backend/kundenakte/${encodeURIComponent(actionResult.leadId)}` : null);

    if (actionResult.configs?.length) {
      for (const config of actionResult.configs) {
        const label = [config.brand, config.model, config.trimLabel].filter(Boolean).join(' ');
        addHistory(
          actionResult.leadId,
          label ? `Fahrzeugwunsch hinzugefügt: ${label}` : 'Fahrzeugwunsch hinzugefügt',
          'system',
        );
      }
    }

    showToast(actionResult.message);
    clearAddVehicleFlow();
    resetWishInput();
    setCarryCustomer(null);
    setIsReturningWish(false);

    if (targetPath) {
      navigate(targetPath, {
        state: {
          vehicleAdded: true,
          toast: actionResult.message,
          highlightConfigurationId: actionResult.configs?.[0]?.id ?? null,
        },
      });
      return;
    }

    setResult({ type: 'lead', leadId: actionResult.leadId });
    setPhase('followup');
  }

  function applyActionResult(actionResult) {
    if (!actionResult) return;
    setResult(actionResult);
    if (actionResult.type === 'lead') {
      setIsReturningWish(Boolean(actionResult.isReturningWish ?? carryCustomer));
      setPhase('capture');
    } else if (actionResult.type === 'offer' && actionResult.leadId) {
      setPhase('followup');
      setIsFreshLead(false);
      showToast('Angebot vorbereitet');
    } else if (actionResult.type === 'vehicle_added') {
      finishAddVehicleAction(actionResult);
    } else {
      setPhase('done');
      showToast(actionResult.message);
    }
  }

  function runActionAndApply(actionId, extraDeps = {}) {
    const actionResult = runAction(actionId, extraDeps);
    applyActionResult(actionResult);
  }

  function handleCreateLead(forceDuplicate = false) {
    if (isCustomerRecordAddVehicleContext(addVehicleContext)) {
      runActionAndApply('add_vehicle_to_customer_record', { forceDuplicate });
      return;
    }
    runActionAndApply('create_sales_opportunity');
  }

  function handleDuplicateAddAnyway() {
    runActionAndApply('add_vehicle_to_customer_record', { forceDuplicate: true });
    setDuplicatePrompt(null);
  }

  function handleDuplicateEditExisting() {
    const leadId = duplicatePrompt?.leadId ?? addVehicleContext?.opportunityId;
    setDuplicatePrompt(null);
    clearAddVehicleFlow();
    resetWishInput();
    if (leadId) {
      navigate(`/backend/kundenakte/${encodeURIComponent(leadId)}`, {
        state: {
          highlightConfigurationId: duplicatePrompt?.duplicate?.id ?? null,
          editVehicleWish: true,
        },
      });
    }
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
      runActionAndApply('create_offer');
      return;
    }
    runActionAndApply(actionId);
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
    if (!options.silent) showToast('Eintrag in Historie gespeichert');
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
    recordRecentCustomerOpen(target);
    setResult({ type: 'lead', leadId });
    setPhase('followup');
    setIsFreshLead(false);
    setIsReturningWish(false);
    if (target.notes) {
      const next = parseDealerAiInput(target.notes);
      if (next.ok) setParsed(enrichWithSuggestions(next));
      else setParsed(enrichWithSuggestions(buildParsedFromLead(target)));
    } else {
      setParsed(enrichWithSuggestions(buildParsedFromLead(target)));
    }
  }

  function handleStartNewWishWithQuery(query) {
    const q = String(query ?? '').trim();
    if (!q) return;
    setInput(q);
    setStartView('home');
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 50);
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
  const pageTitle = phase === 'followup' || phase === 'capture' || phase === 'offer-edit' || phase === 'offer-preview'
    ? ''
    : phase === 'configure' || phase === 'conditions'
      ? ''
    : phase === 'review'
      ? 'Kundenwunsch'
      : phase === 'done' && result?.type !== 'lead'
        ? 'Ich habe erkannt'
        : 'Was sucht Ihr Kunde?';
  const pageTagline = phase === 'followup' || phase === 'capture' || phase === 'offer-edit' || phase === 'offer-preview'
    ? ''
    : phase === 'configure' || phase === 'conditions'
      ? ''
    : phase === 'review'
      ? `${Math.round((parsed?.confidence ?? 0) * 100)} % sicher · bitte kurz prüfen`
      : phase === 'input' && startView === 'home'
        ? 'Kundenakte finden oder neuen Wunsch erfassen.'
      : phase === 'input'
        ? ''
        : 'Bitte kurz prüfen.';

  const showMainHero = phase !== 'followup'
    && phase !== 'capture'
    && phase !== 'offer-edit'
    && phase !== 'offer-preview'
    && phase !== 'configure'
    && phase !== 'conditions'
    && !(phase === 'input' && startView !== 'home');

  const vehicleCard = parsed?.ok && result
    ? formatDealerAiVehicleCard(parsed.fields, conditions)
    : null;

  const captureKnownCustomer = activeLead
    ? hasKnownCustomerContact(activeLead.contact)
    : Boolean(carryCustomer);

  const contextBannerLabel = getContextBannerLabel(addVehicleContext);
  const reviewCreateLabel = getReviewBarButtonLabel(addVehicleContext);

  const reviewCanConfigure = useMemo(() => {
    if (!parsed?.ok) return false;
    if (selectedModelIds.length === 1) {
      const model = parsed.suggestedModels?.find((m) => m.id === selectedModelIds[0]);
      return Boolean(model?.modelKey ?? model?.id);
    }
    return hasRecognizedModelKey(parsed);
  }, [parsed, selectedModelIds]);

  const reviewPrimaryLabel = reviewCanConfigure
    ? 'Fahrzeug konfigurieren'
    : reviewCreateLabel;

  function handleOpenConfigureFromReview() {
    if (!parsed?.ok) return;
    let base = parsed;
    if (selectedModelIds.length === 1) {
      const model = parsed.suggestedModels?.find((m) => m.id === selectedModelIds[0]);
      if (model) {
        base = applyDealerAiFields(parsed, buildSelectedModelFieldPatch(model, parsed.fields));
      }
    }
    const enriched = enrichWithSuggestions(base);
    bootstrapConfigureState(enriched);
    setParsed(enriched);
    setPhase('configure');
  }

  function handleReviewPrimaryAction() {
    if (reviewCanConfigure) {
      handleOpenConfigureFromReview();
      return;
    }
    handleCreateLead();
  }

  const configureCustomerContact = mergeConfigureCustomerContext({
    parsedFields: parsed?.fields,
    carryCustomer,
    addVehicleContext,
    lead: activeLead,
  });

  return (
    <div className="dealer-ai-page">
      <main className={`dealer-ai-main${phase === 'review' ? ' dealer-ai-main--review' : ''}${phase === 'configure' || phase === 'conditions' || phase === 'offer-preview' || phase === 'offer-edit' ? ' dealer-ai-main--configure' : ''}${phase === 'followup' ? ' dealer-ai-main--akte' : ''}`}>
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
            leads={leads}
            onOpenCustomerRecord={handleOpenCustomerLead}
            onStartNewWishWithQuery={handleStartNewWishWithQuery}
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
            onConfigureModel={handleModelConfigure}
            onError={showToast}
            isAnalyzing={isAnalyzing}
          />
        )}

        {contextBannerLabel && (phase === 'review' || (phase === 'input' && startView === 'home')) && (
          <p className="dai-add-vehicle-context" role="status">
            {contextBannerLabel}
          </p>
        )}

        {phase === 'configure' && parsed?.ok && configureDraft && (
          <DealerAiVehicleConfigure
            draft={configureDraft}
            customerContact={configureCustomerContact}
            contextBanner={contextBannerLabel}
            onDraftChange={handleConfigureDraftChange}
            onContinueToConditions={handleConfigureContinueToConditions}
            onBack={handleConfigureBack}
            onSwitchToSearch={configureDraft?.modelKey ? undefined : handleSwitchToSearch}
            isExecuting={isExecuting}
          />
        )}

        {phase === 'conditions' && parsed?.ok && configureDraft && vehicleConfiguration && (
          <DealerAiConditionsStep
            draft={configureDraft}
            vehicleConfiguration={vehicleConfiguration}
            conditions={conditions}
            onDraftChange={handleConfigureDraftChange}
            onContinue={handleConditionsToPreview}
            onBack={handleConditionsBack}
            isExecuting={isExecuting}
          />
        )}

        {phase === 'offer-preview' && configureOfferDraft && (
          <DealerAiOfferPreview
            offerDraft={configureOfferDraft}
            onBack={handleOfferPreviewBack}
            onSave={handleOfferPreviewSave}
            onPreparePdfLink={handleOfferPreviewPreparePdf}
            onFinish={handleOfferPreviewFinish}
            isSaved={offerPreviewSaved}
            isSaving={isExecuting}
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
              onCreateLead={handleReviewPrimaryAction}
              onEdit={handleEdit}
              isExecuting={isExecuting}
              createLabel={reviewPrimaryLabel}
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

      {phase !== 'followup' && phase !== 'offer-edit' && phase !== 'offer-preview' && phase !== 'configure' && phase !== 'conditions' && (
        <DealerAppLegalMenu compact className="dealer-ai-legal" />
      )}

      {duplicatePrompt && (
        <CustomerAddVehicleDuplicatePrompt
          duplicate={duplicatePrompt.duplicate}
          onAddAnyway={handleDuplicateAddAnyway}
          onEditExisting={handleDuplicateEditExisting}
          onCancel={() => setDuplicatePrompt(null)}
          isExecuting={isExecuting}
        />
      )}

      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
