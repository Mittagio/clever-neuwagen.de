import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePublishedDealerConditions, useDraftDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import {
  parseDealerAiInput,
  applyDealerAiFields,
  suggestActionForPaymentType,
  PAYMENT_TYPE_LABELS,
} from '../services/dealerAiParser.js';
import { buildDealerAiTextFromWishes } from '../services/dealerAiFromWishes.js';
import { resolveDealerAiVehicleSuggestions } from '../services/dealerAiVehicleSuggestions.js';
import { pipelineToLeadStatus, sanitizeReservedModels } from '../services/dealerAiLeadCrm.js';
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
import DealerAiOfferVariantsStep from '../components/dealer-ai/DealerAiOfferVariantsStep.jsx';
import DealerAiOfferPreview from '../components/dealer-ai/DealerAiOfferPreview.jsx';
import MagicOfferEntry from '../components/dealer-ai/MagicOfferEntry.jsx';
import MagicOfferReview from '../components/dealer-ai/MagicOfferReview.jsx';
import CustomerAddVehicleDuplicatePrompt from '../components/dealer-ai/CustomerAddVehicleDuplicatePrompt.jsx';
import DealerAiCustomerCapture from '../components/dealer-ai/DealerAiCustomerCapture.jsx';
import DealerAiLeadFollowUp from '../components/dealer-ai/DealerAiLeadFollowUp.jsx';
import CustomerOfferEditView from '../components/dealer-ai/CustomerOfferEditView.jsx';
import CustomerOfferProposalView from '../components/dealer-ai/CustomerOfferProposalView.jsx';
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
import { formatVehicleCardTitle, buildWishConditionChips } from '../services/customerAkte.js';
import {
  applyCustomerContextToFields,
  mergeConfigureCustomerContext,
} from '../services/dealerAiCustomerContext.js';
import {
  buildConfigureDraft,
  buildSelectedModelFieldPatch,
  fieldsFromConfigureDraft,
  hasRecognizedModelKey,
  resolvePrimarySuggestedModel,
} from '../services/dealerAiVehicleConfigureFlow.js';
import { buildVehicleConfiguration } from '../services/configuration/vehicleConfigurationModel.js';
import {
  buildAddVehicleContextFromLead,
  getContextBannerLabel,
  getReviewBarButtonLabel,
  isCustomerRecordAddVehicleContext,
} from '../services/customerAddVehicleFlow.js';
import { buildParsedFromLead, buildKundenaktePath } from '../services/leadAkteEntry.js';
import { recordRecentCustomerOpen } from '../services/crm/customerSearchService.js';
import {
  buildOfferDraft,
  executeSaveOfferDraft,
  offerDraftToParserFields,
} from '../services/dealerAiOfferCreate.js';
import {
  applyMagicOfferCorrection,
  magicPreparationToConfigurePatch,
  overlayMagicOntoOfferDraft,
  prepareMagicOffer,
} from '../services/dealer/magicOfferService.js';
import { extractMagicOfferPdf } from '../services/dealer/magicOfferPdfExtract.js';
import { phoneTelHref } from '../services/dealerAiLeadCrm.js';
import {
  buildCleverConsultationOfferPrefill,
  buildLeadPatchFromCleverPrefill,
} from '../services/dealer/cleverConsultationOfferPrefill.js';
import {
  enrichOfferEditCardFromLead,
  buildOfferEditPendingFields,
  buildConfigureDraftFromStoredConfiguration,
  buildWishFieldsFromLead,
  resolveEffectivePaymentType,
} from '../services/dealer/offerEditWishMerge.js';
import {
  buildOfferCalculatorNavigateState,
  openBoardOfferEntry,
  shouldOpenOfferProposalView,
} from '../services/dealer/openOfferCalculator.js';
import {
  shouldForceConfigureFlow,
} from '../services/dealer/customerAddProposalFlow.js';
import {
  createOfferSelectionGroupFromWish,
  sanitizeOfferSelectionGroups,
} from '../services/sales/offerSelectionGroup.js';
import DealerAiRecognitionAnimation from '../components/dealer-ai/DealerAiRecognitionAnimation.jsx';
import {
  applyRecognitionInsightToParsed,
  buildCustomerRecognitionInsight,
} from '../services/dealerAiRecognitionInsight.js';
import { applyDirectCustomerAkteFromRecognition } from '../services/dealerAiDirectCustomerAkte.js';
import {
  buildPasteInquiryPreview,
  classifyPastedInquiry,
  extractStockVehicleInquiry,
  INQUIRY_TYPES,
} from '../services/inquiry/pasteInquiryClassifier.js';
import {
  applyStockVehicleInquiry,
  buildStockVehicleCalculatorNavigateState,
  buildStockVehicleConfigureDraft,
  buildStockVehicleVehicleConfiguration,
  openStockVehicleListing,
} from '../services/inquiry/stockVehicleInquiryFlow.js';
import PasteInquiryPreview from '../components/dealer-ai/PasteInquiryPreview.jsx';
import { buildSmartOfferVariants } from '../services/dealer/smartOfferVariants.js';
import DealerAppLegalMenu from '../components/dealer/DealerAppLegalMenu.jsx';
import ShowroomModeCapture from '../components/showroom/ShowroomModeCapture.jsx';
import { saveShowroomQuickCapture } from '../services/showroom/showroomQuickCaptureService.js';
import '../components/showroom/showroom-mode.css';
import './DealerAIPage.css';

export default function DealerAIPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addInventoryItem, publishChanges } = useDraftDealerConditions();
  const { addLead, leads, updateLead, addHistory } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const inputRef = useRef(null);
  const addVehicleBootstrapKeyRef = useRef(null);
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
  const [offerProposalCard, setOfferProposalCard] = useState(null);
  const [offerEditFromProposal, setOfferEditFromProposal] = useState(false);
  const [cleverOfferTransfer, setCleverOfferTransfer] = useState(null);
  const [offerPendingFields, setOfferPendingFields] = useState([]);
  const [configureDraft, setConfigureDraft] = useState(null);
  const [isSavingShowroom, setIsSavingShowroom] = useState(false);
  const [vehicleConfiguration, setVehicleConfiguration] = useState(null);
  const [configureOfferDraft, setConfigureOfferDraft] = useState(null);
  const [smartOfferVariants, setSmartOfferVariants] = useState([]);
  const [offerPreviewSaved, setOfferPreviewSaved] = useState(false);
  const [offerPreviewSaveResult, setOfferPreviewSaveResult] = useState(null);
  const [magicOfferPreparation, setMagicOfferPreparation] = useState(null);
  const [magicOfferWorking, setMagicOfferWorking] = useState(false);
  const [magicOfferSeedText, setMagicOfferSeedText] = useState('');
  const [recognitionInsight, setRecognitionInsight] = useState(null);
  const [sourceText, setSourceText] = useState('');
  const [pasteInquiryPreview, setPasteInquiryPreview] = useState(null);
  const [pasteInquiryExtraction, setPasteInquiryExtraction] = useState(null);
  const [pasteInquiryClassification, setPasteInquiryClassification] = useState(null);
  const [pasteAppliedLeadId, setPasteAppliedLeadId] = useState(null);

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
    const wish = addVehicleContext?.wishFields ?? {};
    const paymentType = resolveEffectivePaymentType(
      draft.paymentType,
      addVehicleContext?.paymentType,
      wish.paymentType,
    );
    const isCash = paymentType === 'cash';
    draft = {
      ...draft,
      paymentType,
      termMonths: isCash ? draft.termMonths : (draft.termMonths ?? wish.termMonths),
      mileagePerYear: isCash ? draft.mileagePerYear : (draft.mileagePerYear ?? wish.mileagePerYear),
      downPayment: isCash ? draft.downPayment : (draft.downPayment ?? wish.downPayment),
      desiredRate: isCash ? null : (draft.desiredRate ?? wish.desiredRate),
      desiredPrice: isCash
        ? (draft.desiredPrice ?? wish.desiredPrice)
        : (draft.desiredPrice ?? wish.desiredPrice),
    };
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
    setSmartOfferVariants([]);
    if (primaryModel?.id) {
      setSelectedModelIds([primaryModel.id]);
    }
    return draft;
  }, [conditions, addVehicleContext?.paymentType, addVehicleContext?.wishFields]);

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
    setSourceText(combined);

    const classification = classifyPastedInquiry(combined);
    const isStockCandidate = classification.type === INQUIRY_TYPES.STOCK_VEHICLE_REQUEST
      || (classification.uncertain && classification.signals?.length > 0);

    if (isStockCandidate) {
      const extraction = extractStockVehicleInquiry(combined);
      const preview = buildPasteInquiryPreview(classification, extraction);
      setPasteInquiryClassification(classification);
      setPasteInquiryExtraction(extraction);
      setPasteInquiryPreview(preview);
      setPasteAppliedLeadId(null);
      setIsAnalyzing(false);
      setPhase('paste-inquiry');
      return;
    }

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

    const chipIds = [...selectedChipIds, ...extraChips];
    const enriched = enrichWithSuggestions(next, chipIds);
    setParsed(enriched);
    setRecognitionInsight(buildCustomerRecognitionInsight(combined, enriched));
    setStartView('home');
    setPhase('recognition-animate');
  }

  function continueNormalAnalysis(combined) {
    const next = parseDealerAiInput(combined);
    if (!next.ok) {
      showToast(next.error);
      return;
    }
    const enriched = enrichWithSuggestions(next);
    setParsed(enriched);
    setRecognitionInsight(buildCustomerRecognitionInsight(combined, enriched));
    setStartView('home');
    setPhase('recognition-animate');
  }

  function handleApplyStockInquiry({ openAkte = false } = {}) {
    if (!pasteInquiryPreview?.stockVehicle || !pasteInquiryExtraction) return null;
    setIsExecuting(true);
    try {
      const applied = applyStockVehicleInquiry({
        extraction: pasteInquiryExtraction,
        stockVehicle: pasteInquiryPreview.stockVehicle,
        classification: pasteInquiryClassification,
      }, {
        addLead,
        updateLead,
        leads,
        conditions,
        getExistingCodes,
      });
      setPasteAppliedLeadId(applied.leadId);
      setResult({
        type: 'lead',
        leadId: applied.leadId,
        leadName: applied.lead.contact?.name,
      });
      showToast(applied.message);
      if (openAkte) {
        navigate(buildKundenaktePath(applied.leadId));
      }
      return applied;
    } catch (err) {
      showToast(err.message ?? 'Bestandsfahrzeug-Anfrage konnte nicht übernommen werden.');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }

  function handlePasteApplyCustomer() {
    const combined = sourceText || input;
    setPasteInquiryPreview(null);
    setPasteInquiryExtraction(null);
    setPasteInquiryClassification(null);
    setPhase('input');
    continueNormalAnalysis(combined);
  }

  function handlePasteManualEdit() {
    setPasteInquiryPreview(null);
    setPhase('input');
    if (sourceText && !input.trim()) {
      setInput(sourceText);
    }
  }

  function handlePastePrepareAnswer() {
    let applied = null;
    if (!pasteAppliedLeadId) {
      applied = handleApplyStockInquiry();
      if (!applied?.leadId) return;
    }
    const leadId = pasteAppliedLeadId ?? applied.leadId;
    navigate(`${buildKundenaktePath(leadId)}?sheet=antworten&intentId=answer_stock_vehicle_request`);
  }

  function handlePasteCreateOffer() {
    let applied = null;
    if (!pasteAppliedLeadId) {
      applied = handleApplyStockInquiry();
      if (!applied?.leadId) return;
    }
    const leadId = pasteAppliedLeadId ?? applied.leadId;
    const lead = leads.find((entry) => entry.id === leadId) ?? applied?.lead;
    const stock = pasteInquiryPreview?.stockVehicle;
    const navState = buildStockVehicleCalculatorNavigateState(lead, stock, {
      returnPath: buildKundenaktePath(leadId),
    });
    if (!navState) return;
    navigate('/verkaufsassistent', { state: navState });
  }

  function handlePasteOpenListing() {
    openStockVehicleListing(pasteInquiryPreview?.stockVehicle);
  }

  function handleRecognitionAnimationComplete() {
    handleApplyDirectCustomerAkte();
  }

  function handleApplyDirectCustomerAkte() {
    if (!parsed?.ok || !recognitionInsight) return;

    const merged = applyRecognitionInsightToParsed(parsed, recognitionInsight);
    const enriched = enrichWithSuggestions(merged);
    setParsed(enriched);
    setIsExecuting(true);

    try {
      const actionResult = applyDirectCustomerAkteFromRecognition(enriched, recognitionInsight, {
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
        result,
      });

      setResult(actionResult);
      setIsReturningWish(Boolean(actionResult.isReturningWish ?? carryCustomer));
      setPhase('followup');
      setIsFreshLead(true);
      showToast(actionResult.message ?? 'Kundenakte vorbereitet.');
    } catch (err) {
      showToast(err.message ?? 'Kundenakte konnte nicht vorbereitet werden');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleModelConfigure({ model, parsed: modelParsed }) {
    const text = `Kia ${model.name}`;
    setInput(text);
    setSelectedModelIds(model?.id ? [model.id] : []);
    const enriched = enrichWithSuggestions(modelParsed);
    setParsed(enriched);
    setSourceText(text);
    setRecognitionInsight(buildCustomerRecognitionInsight(text, enriched));
    setStartView('home');
    setPhase('recognition-animate');
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
    setRecognitionInsight(null);
    setSourceText('');
  }

  function clearAddVehicleFlow() {
    setAddVehicleContext(null);
    setDuplicatePrompt(null);
    setMagicOfferPreparation(null);
    setMagicOfferSeedText('');
    addVehicleBootstrapKeyRef.current = null;
  }

  function handleConfigureDraftChange(nextDraft) {
    setConfigureDraft(nextDraft);
    setParsed((prev) => enrichWithSuggestions(
      applyDealerAiFields(prev, fieldsFromConfigureDraft(nextDraft, prev?.fields)),
    ));
  }

  function handleConfigureContinueToConditions() {
    if (!configureDraft) return;
    const variants = buildSmartOfferVariants(configureDraft, conditions, parsed?.fields ?? {});
    setSmartOfferVariants(variants);
    setVehicleConfiguration(buildVehicleConfiguration(configureDraft));
    setPhase('offer-variants');
  }

  function handleOfferVariantsBack() {
    setSmartOfferVariants([]);
    setPhase('configure');
  }

  function handleOfferVariantsChange(nextVariants) {
    setSmartOfferVariants(nextVariants);
  }

  function handleOpenFullConditions() {
    if (!configureDraft) return;
    setVehicleConfiguration(buildVehicleConfiguration(configureDraft));
    setPhase('conditions');
  }

  function resolveMagicOfferContext() {
    return {
      modelKey: configureDraft?.modelKey
        ?? parsed?.fields?.modelId
        ?? addVehicleContext?.focusModelKey
        ?? null,
      trimId: configureDraft?.trimId ?? parsed?.fields?.trimId ?? null,
    };
  }

  function handleMagicOfferPrepare(text, extra = {}) {
    setMagicOfferWorking(true);
    try {
      const ctx = resolveMagicOfferContext();
      const preparation = prepareMagicOffer(text, {
        ...ctx,
        fromPdf: Boolean(extra.fromPdf),
        originalPdf: extra.originalPdf ?? magicOfferPreparation?.originalPdf ?? null,
        previousPreparation: extra.previousPreparation ?? magicOfferPreparation,
      });
      setMagicOfferPreparation(preparation);
      setMagicOfferSeedText(text);
      setPhase('magic-offer-review');
    } catch (err) {
      showToast(err?.message ?? 'Angebot konnte nicht vorbereitet werden');
    } finally {
      setMagicOfferWorking(false);
    }
  }

  async function handleMagicOfferUploadPdf(file) {
    if (!file) return;
    setMagicOfferWorking(true);
    try {
      const extracted = await extractMagicOfferPdf(file);
      const originalPdf = {
        fileName: extracted.fileName,
        sizeBytes: extracted.sizeBytes,
        dataUrl: extracted.dataUrl,
        uploadedAt: new Date().toISOString(),
      };

      if (extracted.ok && extracted.text) {
        const preparation = prepareMagicOffer(extracted.text, {
          ...resolveMagicOfferContext(),
          fromPdf: true,
          originalPdf,
        });
        if (preparation.canCreateOffer) {
          setMagicOfferPreparation(preparation);
          setMagicOfferSeedText(extracted.text.slice(0, 500));
          setPhase('magic-offer-review');
          showToast('Angebot aus PDF erkannt – bitte prüfen');
          return;
        }
        setMagicOfferPreparation({
          ...preparation,
          originalPdf,
          fromPdf: true,
          promptMessage: preparation.promptMessage
            ?? 'PDF gelesen. Rate oder Konditionen bitte kurz bestätigen oder ergänzen.',
        });
        setMagicOfferSeedText(extracted.text.slice(0, 500));
        setPhase('magic-offer-review');
        return;
      }

      setMagicOfferPreparation({
        ok: false,
        mode: 'pdf_describe',
        canCreateOffer: false,
        fromPdf: true,
        originalPdf,
        headline: 'PDF übernommen',
        subline: extracted.fileName,
        promptMessage: 'PDF ist hinterlegt. Tippen oder sprechen Sie die gerechnete Rate bzw. Konditionen – Clever übernimmt sie.',
        intent: { rawText: '', commercialInput: {}, vehicleRequest: {} },
        grounded: magicOfferPreparation?.grounded ?? null,
        decision: { action: 'ask_rate', reason: 'pdf_needs_describe' },
        calculation: null,
        positionLines: [],
        suggestions: [],
      });
      setMagicOfferSeedText('');
      setPhase('magic-offer-review');
      showToast('PDF gespeichert – bitte Rate ergänzen');
    } catch (err) {
      showToast(err?.message ?? 'PDF konnte nicht gelesen werden');
    } finally {
      setMagicOfferWorking(false);
    }
  }

  function handleMagicOfferManual() {
    if (!configureDraft) {
      const draft = bootstrapConfigureState(parsed);
      if (draft) {
        setVehicleConfiguration(buildVehicleConfiguration(draft));
      }
    } else {
      setVehicleConfiguration(buildVehicleConfiguration(configureDraft));
    }
    setSmartOfferVariants([]);
    setPhase('conditions');
  }

  function handleMagicOfferCorrection(text) {
    if (!magicOfferPreparation) {
      handleMagicOfferPrepare(text);
      return;
    }
    setMagicOfferWorking(true);
    try {
      const next = applyMagicOfferCorrection(magicOfferPreparation, text, {
        ...resolveMagicOfferContext(),
        fromPdf: Boolean(magicOfferPreparation.fromPdf),
        originalPdf: magicOfferPreparation.originalPdf ?? null,
      });
      setMagicOfferPreparation({
        ...next,
        originalPdf: magicOfferPreparation.originalPdf ?? next.originalPdf ?? null,
        fromPdf: magicOfferPreparation.fromPdf || next.fromPdf,
      });
    } finally {
      setMagicOfferWorking(false);
    }
  }

  function handleMagicOfferChooseType(offerType) {
    const label = offerType === 'purchase'
      ? 'Kauf'
      : offerType === 'financing'
        ? 'Finanzierung'
        : 'Leasing';
    const baseText = magicOfferPreparation?.intent?.rawText
      || magicOfferSeedText
      || '';
    handleMagicOfferPrepare(`${label}. ${baseText}`.trim(), {
      previousPreparation: magicOfferPreparation,
      fromPdf: magicOfferPreparation?.fromPdf,
      originalPdf: magicOfferPreparation?.originalPdf,
    });
  }

  function handleMagicOfferCreate() {
    if (!parsed?.ok || !magicOfferPreparation?.canCreateOffer) return;
    const patch = magicPreparationToConfigurePatch(magicOfferPreparation);
    if (!patch?.modelKey && !configureDraft?.modelKey) {
      showToast('Fahrzeug konnte nicht zugeordnet werden');
      return;
    }

    const nextDraft = {
      ...(configureDraft ?? buildConfigureDraft(parsed, conditions)),
      ...patch,
      paymentType: patch.paymentType === 'unknown'
        ? (configureDraft?.paymentType ?? 'cash')
        : patch.paymentType,
    };
    setConfigureDraft(nextDraft);
    const vehicleConfig = buildVehicleConfiguration(nextDraft);
    setVehicleConfiguration(vehicleConfig);

    const mergedFields = fieldsFromConfigureDraft(nextDraft, parsed.fields);
    const updatedParsed = enrichWithSuggestions(applyDealerAiFields(parsed, mergedFields));
    setParsed(updatedParsed);

    const contextLead = addVehicleContext?.opportunityId
      ? leads.find((l) => l.id === addVehicleContext.opportunityId)
      : null;

    let offerDraft = buildOfferDraft({
      configureDraft: nextDraft,
      vehicleConfiguration: vehicleConfig,
      parsed: updatedParsed,
      conditions,
      carryCustomer,
      addVehicleContext,
      lead: contextLead,
    });
    offerDraft = overlayMagicOntoOfferDraft(offerDraft, magicOfferPreparation);

    setConfigureOfferDraft(offerDraft);
    setOfferPreviewSaved(false);
    setOfferPreviewSaveResult(null);
    setPhase('offer-preview');
  }

  function handleMagicOfferBackToEntry() {
    setPhase('magic-offer-entry');
  }

  function handleMagicOfferBackToAkte() {
    if (addVehicleContext?.returnPath) {
      navigate(addVehicleContext.returnPath);
      clearAddVehicleFlow();
      return;
    }
    setMagicOfferPreparation(null);
    setPhase('followup');
  }

  function handleSelectSmartVariant(variant) {
    if (!parsed?.ok || !variant?.draft) return;

    const nextDraft = variant.draft;
    setConfigureDraft(nextDraft);
    const mergedFields = fieldsFromConfigureDraft(nextDraft, parsed.fields);
    const updatedParsed = enrichWithSuggestions(applyDealerAiFields(parsed, mergedFields));
    setParsed(updatedParsed);

    const vehicleConfig = buildVehicleConfiguration(nextDraft);
    setVehicleConfiguration(vehicleConfig);

    const contextLead = addVehicleContext?.opportunityId
      ? leads.find((l) => l.id === addVehicleContext.opportunityId)
      : null;

    const offerDraft = buildOfferDraft({
      configureDraft: nextDraft,
      vehicleConfiguration: vehicleConfig,
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

  function handleConditionsBack() {
    if (addVehicleContext?.returnPath) {
      navigate(addVehicleContext.returnPath);
      clearAddVehicleFlow();
      return;
    }
    if (configureDraft) {
      const variants = buildSmartOfferVariants(configureDraft, conditions, parsed?.fields ?? {});
      setSmartOfferVariants(variants);
    }
    setPhase('offer-variants');
  }

  function handleConditionsEditConfiguration() {
    // Fahrzeug bearbeiten → Konfigurator, nicht zurück zur Akte
    if (addVehicleContext?.skipConfigure) {
      setAddVehicleContext((prev) => (prev ? { ...prev, skipConfigure: false, openConditions: false } : prev));
    }
    setPhase('configure');
  }

  function handleConditionsSave() {
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

    setIsExecuting(true);
    try {
      const saveResult = executeSaveOfferDraft(offerDraft, {
        parsed: updatedParsed,
        conditions,
        leads,
        addLead,
        updateLead,
        getExistingCodes,
        selectedModelIds,
        addVehicleContext,
      });

      if (saveResult.activityText && saveResult.leadId) {
        addHistory(saveResult.leadId, saveResult.activityText, 'offer');
      }

      if (addVehicleContext?.returnPath) {
        navigate(addVehicleContext.returnPath, {
          state: { toast: saveResult.message ?? 'Angebot gespeichert' },
        });
        clearAddVehicleFlow();
        setConfigureDraft(null);
        setVehicleConfiguration(null);
        setConfigureOfferDraft(null);
        return;
      }

      setOfferPreviewSaveResult(saveResult);
      setOfferPreviewSaved(true);
      handleOfferPreviewFinishFromSave(saveResult);
      showToast(saveResult.message ?? 'Angebot gespeichert');
    } catch (err) {
      showToast(err.message ?? 'Angebot konnte nicht gespeichert werden');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleOfferPreviewFinishFromSave(saveResult) {
    if (!saveResult) return;
    setResult({ type: 'lead', leadId: saveResult.leadId, customerId: saveResult.customerId });
    setOfferEditCard(saveResult.card);
    setConfigureOfferDraft(null);
    setConfigureDraft(null);
    setVehicleConfiguration(null);
    setOfferPreviewSaved(false);
    setOfferPreviewSaveResult(null);
    setPhase('followup');
    setIsFreshLead(saveResult.mode !== 'attached_to_opportunity');
    setIsReturningWish(Boolean(saveResult.customerId && carryCustomer));
    clearAddVehicleFlow();
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
    if (magicOfferPreparation) {
      setPhase('magic-offer-review');
      return;
    }
    setPhase(smartOfferVariants.length ? 'offer-variants' : 'conditions');
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
        addVehicleContext,
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

      if (
        addVehicleContext?.proposalIntent === 'create_selection_group'
        && saveResult.leadId
        && saveResult.offerDraft
      ) {
        const targetLead = leads.find((l) => l.id === saveResult.leadId);
        const wishFields = offerDraftToParserFields(saveResult.offerDraft);
        const group = createOfferSelectionGroupFromWish({ lead: targetLead, wishFields });
        if (group && targetLead) {
          const existing = sanitizeOfferSelectionGroups(targetLead.crm?.offerSelectionGroups ?? []);
          const hasModel = existing.some((entry) => entry.modelKey === group.modelKey);
          if (!hasModel) {
            updateLead(saveResult.leadId, {
              crm: {
                ...targetLead.crm,
                offerSelectionGroups: [...existing, group],
              },
            });
            addHistory(
              saveResult.leadId,
              `Clever Auswahl vorbereitet: ${group.modelLabel}`,
              'note',
            );
          }
        }
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

  function handleStartNewWish(sourceLead, options = {}) {
    const navState = buildOfferCalculatorNavigateState(sourceLead, null, {
      returnPath: sourceLead?.id ? buildKundenaktePath(sourceLead.id) : undefined,
      proposalIntent: options.proposalIntent,
      paymentType: options.paymentType,
    });
    if (!navState) return;
    navigate('/verkaufsassistent', { state: navState, replace: true });
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
    const view = searchParams.get('view');
    if (view === 'advice' || view === 'model' || view === 'showroom') {
      setStartView(view);
      setPhase('input');
    }
  }, [searchParams]);

  const showroomLeadId = searchParams.get('leadId') ?? location.state?.showroomLeadId ?? null;
  const showroomLead = useMemo(
    () => (showroomLeadId ? leads.find((item) => item.id === showroomLeadId) ?? null : null),
    [showroomLeadId, leads],
  );
  const showroomInitialCapture = location.state?.pendingCapture
    ?? showroomLead?.crm?.pendingShowroomCapture
    ?? null;

  function handleShowroomBack() {
    if (showroomLeadId) {
      navigate(`/backend/kundenakte/${encodeURIComponent(showroomLeadId)}`);
      return;
    }
    setStartView('home');
    navigate('/verkaufsassistent', { replace: true });
  }

  const handleShowroomSave = useCallback((capture) => {
    setIsSavingShowroom(true);
    try {
      const saveResult = saveShowroomQuickCapture({
        capture,
        existingLead: showroomLead,
        dealerConditions: conditions,
        getExistingCodes,
        leads,
      });

      if (!saveResult.ok) {
        showToast(saveResult.message ?? 'Speichern fehlgeschlagen.');
        return;
      }

      const targetLeadId = saveResult.leadId;

      if (saveResult.isNew && saveResult.lead) {
        addLead(saveResult.lead);
        for (const entry of saveResult.lead.history ?? []) {
          addHistory(targetLeadId, entry.text, entry.type ?? 'system');
        }
      } else if (saveResult.leadPatch) {
        updateLead(targetLeadId, saveResult.leadPatch);
        for (const entry of saveResult.leadPatch.history ?? []) {
          addHistory(targetLeadId, entry.text, entry.type ?? 'note');
        }
      }

      recordRecentCustomerOpen(saveResult.isNew ? saveResult.lead : showroomLead);
      navigate(`/backend/kundenakte/${encodeURIComponent(targetLeadId)}`, {
        state: { fresh: saveResult.isNew, showroomSaved: true },
      });
    } finally {
      setIsSavingShowroom(false);
    }
  }, [
    addHistory,
    addLead,
    conditions,
    getExistingCodes,
    leads,
    navigate,
    showroomLead,
    showToast,
    updateLead,
  ]);

  useEffect(() => {
    const ctx = location.state?.addVehicleContext;
    if (!ctx?.customerId) return;
    const lead = ctx.opportunityId
      ? leads.find((l) => l.id === ctx.opportunityId)
      : null;
    if (!lead) return;

    const bootstrapKey = [
      ctx.customerId,
      ctx.opportunityId ?? '',
      ctx.vehicleCardId ?? '',
      ctx.stockVehicle && ctx.skipConfigure && ctx.openConditions
        ? 'conditions'
        : ctx.openConditions
          ? 'magic-offer-entry'
          : 'configure',
    ].join('::');
    if (addVehicleBootstrapKeyRef.current === bootstrapKey) return;
    addVehicleBootstrapKeyRef.current = bootstrapKey;

    const carry = extractCarryCustomerFromLead(lead);
    setAddVehicleContext(ctx);
    setCarryCustomer(carry);
    setIsReturningWish(true);
    setIsFreshLead(false);
    setMagicOfferPreparation(null);
    setMagicOfferSeedText('');

    let nextParsed = enrichWithSuggestions(buildParsedFromLead(lead));
    const storedConfig = (lead.crm?.vehicleConfigurations ?? []).find((entry) => entry?.modelKey);
    if (storedConfig?.modelKey && !hasRecognizedModelKey(nextParsed)) {
      nextParsed = enrichWithSuggestions(applyDealerAiFields(nextParsed, {
        modelId: storedConfig.modelKey,
        model: storedConfig.model ?? lead.vehicle?.model,
        trimLabel: storedConfig.trimLabel ?? lead.vehicle?.trim,
      }));
    } else if (ctx.focusModelKey && !hasRecognizedModelKey(nextParsed)) {
      nextParsed = enrichWithSuggestions(applyDealerAiFields(nextParsed, {
        modelId: ctx.focusModelKey,
      }));
    }
    setParsed(nextParsed);
    setStartView('home');

    if (ctx.stockVehicle && ctx.skipConfigure && ctx.openConditions) {
      const draft = buildStockVehicleConfigureDraft(ctx.stockVehicle, lead, conditions);
      const vehicleConfiguration = buildStockVehicleVehicleConfiguration(ctx.stockVehicle);
      setConfigureDraft(draft);
      setVehicleConfiguration(vehicleConfiguration);
      setSmartOfferVariants([]);
      setPhase('conditions');
      return;
    }

    if (
      shouldForceConfigureFlow(ctx)
      && (hasRecognizedModelKey(nextParsed) || nextParsed.fields?.model?.trim())
    ) {
      let draft = bootstrapConfigureState(nextParsed);
      const cardConfig = ctx.vehicleCardId
        ? (lead.crm?.vehicleConfigurations ?? []).find((entry) => entry.id === ctx.vehicleCardId)
        : null;
      if (cardConfig) {
        const storedDraft = buildConfigureDraftFromStoredConfiguration(
          cardConfig,
          ctx.wishFields ?? {},
        );
        if (storedDraft) {
          draft = {
            ...storedDraft,
            ...draft,
            paymentType: resolveEffectivePaymentType(draft.paymentType, storedDraft.paymentType),
          };
          setConfigureDraft(draft);
        }
      }
      if (ctx.openConditions && draft) {
        setVehicleConfiguration(buildVehicleConfiguration(draft));
        setSmartOfferVariants([]);
        setPhase('magic-offer-entry');
      } else {
        setPhase('configure');
      }
    } else {
      setPhase('input');
    }
  }, [location.state?.addVehicleContext, location.state?.pasteText, leads, enrichWithSuggestions, bootstrapConfigureState, conditions]);

  useEffect(() => {
    const pasteText = location.state?.pasteText;
    if (!pasteText?.trim()) return;
    setInput(pasteText);
    setPhase('input');
    setStartView('home');
    inputRef.current?.focus();
  }, [location.state?.pasteText]);

  useEffect(() => {
    const wishText = location.state?.wishText;
    if (!wishText) return;
    setInput(wishText);
    const next = parseDealerAiInput(wishText);
    if (!next.ok) return;
    const enriched = enrichWithSuggestions(next);
    setParsed(enriched);
    setSourceText(wishText);
    setRecognitionInsight(buildCustomerRecognitionInsight(wishText, enriched));
    setStartView('home');
    setPhase('recognition-animate');
  }, [location.state?.wishText, enrichWithSuggestions]);

  useEffect(() => {
    const leadId = location.state?.leadId;
    if (!leadId) return;
    if (searchParams.get('view') === 'showroom') return;
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
  }, [location.state?.leadId, leads, enrichWithSuggestions, searchParams]);

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
    if (
      isCustomerRecordAddVehicleContext(addVehicleContext)
      && shouldForceConfigureFlow(addVehicleContext)
    ) {
      showToast('Bitte Fahrzeug konfigurieren – so werden Konditionen und Rate berechnet.');
      if (parsed?.ok && hasRecognizedModelKey(parsed)) {
        handleOpenConfigureFromReview();
      } else {
        setStartView('model');
      }
      return;
    }
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

  function handlePrepareOfferFromClever() {
    if (!result?.leadId) return;
    const lead = leads.find((l) => l.id === result.leadId);
    if (!lead) return;
    const prefill = buildCleverConsultationOfferPrefill(lead);
    if (!prefill) {
      handlePrepareOffer();
      return;
    }

    const leadPatch = buildLeadPatchFromCleverPrefill(prefill, lead);
    updateLead(result.leadId, leadPatch);
    addHistory(result.leadId, 'Angebot aus Clever-Beratung vorbereitet', 'note');

    if (parsed?.ok) {
      setParsed(enrichWithSuggestions(applyDealerAiFields(parsed, prefill.parsedFieldPatches)));
    }

    setCleverOfferTransfer(prefill.cleverTransfer);
    setOfferPendingFields(prefill.pendingFields);
    openProposalConditionsFlow(enrichOfferEditCardFromLead(prefill.card, lead));
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
    const ids = sanitizeReservedModels(activeLead?.crm?.reservedModels).map((m) => m.id) ?? selectedModelIds;
    setSelectedModelIds(ids);
    setPhase('review');
  }

  const activeLead = result?.leadId
    ? leads.find((l) => l.id === result.leadId) ?? null
    : null;

  const conditionsWishChips = useMemo(() => {
    const contextLead = addVehicleContext?.opportunityId
      ? leads.find((l) => l.id === addVehicleContext.opportunityId)
      : activeLead;
    const wish = addVehicleContext?.wishFields ?? buildWishFieldsFromLead(contextLead);
    return buildWishConditionChips(wish);
  }, [addVehicleContext, activeLead, leads]);

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
    addHistory(result.leadId, text, type, options);
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

  function handleCaptureComplete() {
    setCarryCustomer(null);
    setPhase('followup');
    setIsFreshLead(true);
  }

  function handleEnterLeadDetail() {
    setIsFreshLead(false);
  }

  function handleOpenOfferProposal(card) {
    openBoardOfferEntry(card, activeLead, {
      onOpenProposal: (targetCard) => {
        setOfferProposalCard(targetCard);
        setPhase('offer-proposal');
      },
      onOpenCalculator: (targetCard) => handleOpenOfferEdit(targetCard),
    });
  }

  function handleBackFromProposal() {
    setOfferProposalCard(null);
    setPhase('followup');
  }

  function openProposalConditionsFlow(card) {
    const enriched = enrichOfferEditCardFromLead(card, activeLead);
    const vehicleCardId = enriched.configurationId ?? enriched.id ?? null;
    if (activeLead) {
      setAddVehicleContext((prev) => ({
        ...(prev ?? buildAddVehicleContextFromLead(activeLead)),
        vehicleCardId,
        openConditions: true,
        proposalIntent: 'vehicle',
        wishFields: buildWishFieldsFromLead(activeLead),
      }));
    }
    let base = parsed?.ok
      ? parsed
      : enrichWithSuggestions(buildParsedFromLead(activeLead ?? {}));
    if (enriched?.modelKey) {
      base = applyDealerAiFields(base, {
        modelId: enriched.modelKey,
        model: enriched.modelName?.replace(/^Kia\s+/i, '') ?? base.fields?.model,
        trimLabel: enriched.trimLabel ?? base.fields?.trimLabel,
        paymentType: resolveEffectivePaymentType(
          enriched.paymentType,
          activeLead?.paymentType,
          base.fields?.paymentType,
        ),
        termMonths: enriched.termMonths ?? activeLead?.wish?.termMonths ?? base.fields?.termMonths,
        mileagePerYear: enriched.mileagePerYear ?? activeLead?.wish?.mileagePerYear ?? base.fields?.mileagePerYear,
        desiredRate: enriched.wishBudgetRate
          ?? enriched.calculatedRate
          ?? activeLead?.desiredRate
          ?? base.fields?.desiredRate,
        downPayment: enriched.downPayment ?? activeLead?.wish?.downPayment ?? base.fields?.downPayment,
        desiredPrice: enriched.wishBudgetPrice
          ?? enriched.calculatedPrice
          ?? activeLead?.wish?.desiredPrice
          ?? base.fields?.desiredPrice,
      });
    }
    const nextParsed = enrichWithSuggestions(base);
    setParsed(nextParsed);
    setOfferEditCard(null);
    setOfferEditFromProposal(false);
    setOfferPendingFields([]);
    let draft = bootstrapConfigureState(nextParsed);
    const storedConfig = vehicleCardId
      ? (activeLead?.crm?.vehicleConfigurations ?? []).find((entry) => entry.id === vehicleCardId)
      : null;
    if (storedConfig) {
      const storedDraft = buildConfigureDraftFromStoredConfiguration(
        storedConfig,
        buildWishFieldsFromLead(activeLead),
      );
      if (storedDraft) {
        draft = {
          ...storedDraft,
          ...draft,
          paymentType: resolveEffectivePaymentType(draft.paymentType, storedDraft.paymentType),
        };
        setConfigureDraft(draft);
      }
    }
    if (draft) {
      setVehicleConfiguration(buildVehicleConfiguration(draft));
      setSmartOfferVariants([]);
      setMagicOfferPreparation(null);
      setMagicOfferSeedText('');
      setPhase('magic-offer-entry');
      return;
    }
    setPhase('configure');
  }

  function handleOpenOfferEdit(card) {
    const enriched = enrichOfferEditCardFromLead(card, activeLead);
    openProposalConditionsFlow(enriched);
  }

  useEffect(() => {
    if (phase !== 'offer-proposal' || !offerProposalCard || !activeLead) return;
    if (shouldOpenOfferProposalView(offerProposalCard, activeLead)) return;
    setOfferProposalCard(null);
    setPhase('followup');
    openProposalConditionsFlow(offerProposalCard);
  }, [phase, offerProposalCard, activeLead]);

  function handleEditOfferConditions(card) {
    openProposalConditionsFlow(card);
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
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(activeLead ?? {}, card);
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
    const base = getVehicleOffer(activeLead ?? {}, card);
    const title = formatVehicleCardTitle(card);
    const next = createOnlineLinkForOffer(base, {
      modelName: title,
      customerName: activeLead?.contact?.name ?? '',
      leadId: result.leadId,
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
    const base = getVehicleOffer(activeLead ?? {}, card);
    const next = {
      ...base,
      status: VEHICLE_OFFER_STATUS.DRAFT,
      pdf: null,
      onlineLink: null,
      sentVia: null,
      sentAt: null,
    };
    persistVehicleOffer(card.id, next);
    showToast('PDF entfernt');
  }

  function handleOfferMarkSent(via) {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(activeLead ?? {}, card);
    if (!base.onlineLink?.url) return;
    const next = markOfferSent(base, via);
    const historyMap = {
      email: { text: VEHICLE_OFFER_HISTORY.sent_email, type: 'offer_sent_email' },
      whatsapp: { text: VEHICLE_OFFER_HISTORY.sent_whatsapp, type: 'offer_sent_whatsapp' },
      copy: { text: 'Link kopiert – bereit zum Teilen', type: 'offer_sent' },
    };
    const meta = historyMap[via] ?? null;
    persistVehicleOffer(card.id, next, meta);
    if (via !== 'copy') showToast('Angebot gesendet');
  }

  function handleOfferStatusChange(statusId) {
    const card = resolveOfferActionCard();
    if (!card) return;
    const base = getVehicleOffer(activeLead ?? {}, card);
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
    const base = getVehicleOffer(activeLead ?? {}, card);
    persistVehicleOffer(card.id, base);
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

  const activeOfferProposal = offerProposalCard
    ? getVehicleOffer(activeLead ?? {}, offerProposalCard)
    : null;

  function resolveOfferActionCard() {
    return offerEditCard ?? offerProposalCard;
  }

  const pageKicker = 'Digitaler Verkaufsassistent';
  const pageTitle = phase === 'followup' || phase === 'capture' || phase === 'offer-edit' || phase === 'offer-proposal' || phase === 'offer-preview'
    || phase === 'magic-offer-entry' || phase === 'magic-offer-review'
    ? ''
    : phase === 'configure' || phase === 'conditions' || phase === 'offer-variants'
      ? ''
    : phase === 'review'
      ? 'Clever hat erkannt'
      : phase === 'recognition-animate'
        ? 'Clever analysiert …'
      : phase === 'done' && result?.type !== 'lead'
        ? 'Ich habe erkannt'
        : phase === 'input' && startView === 'advice'
          ? 'Clever Beratung'
          : phase === 'input' && startView === 'showroom'
            ? 'Showroom Modus'
            : phase === 'input' && startView === 'model'
              ? 'Modell wählen'
              : phase === 'input' && startView === 'home'
                ? ''
                : 'Was sucht Ihr Kunde?';
  const pageTagline = phase === 'followup' || phase === 'capture' || phase === 'offer-edit' || phase === 'offer-proposal' || phase === 'offer-preview'
    || phase === 'magic-offer-entry' || phase === 'magic-offer-review'
    ? ''
    : phase === 'configure' || phase === 'conditions' || phase === 'offer-variants'
      ? ''
    : phase === 'review'
      ? 'Bitte kurz bestätigen, bevor es weitergeht.'
      : phase === 'recognition-animate'
        ? 'Kundenwunsch wird sortiert …'
      : phase === 'input' && startView === 'home'
        ? ''
      : phase === 'input'
        ? ''
        : 'Bitte kurz prüfen.';

  const showMainHero = phase !== 'followup'
    && phase !== 'capture'
    && phase !== 'offer-edit'
    && phase !== 'offer-proposal'
    && phase !== 'offer-preview'
    && phase !== 'configure'
    && phase !== 'conditions'
    && phase !== 'offer-variants'
    && phase !== 'magic-offer-entry'
    && phase !== 'magic-offer-review'
    && phase !== 'recognition-animate'
    && phase !== 'paste-inquiry'
    && !(phase === 'input' && startView === 'home');

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
    if (shouldForceConfigureFlow(addVehicleContext)) {
      showToast('Bitte Modell wählen, dann Fahrzeug konfigurieren.');
      setStartView('model');
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
      <main className={`dealer-ai-main${phase === 'review' ? ' dealer-ai-main--review' : ''}${phase === 'configure' || phase === 'conditions' || phase === 'offer-variants' || phase === 'offer-preview' || phase === 'offer-edit' || phase === 'offer-proposal' || phase === 'magic-offer-entry' || phase === 'magic-offer-review' ? ' dealer-ai-main--configure' : ''}${phase === 'followup' ? ' dealer-ai-main--akte' : ''}`}>
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
            onStartShowroom={() => setStartView('showroom')}
            onStartModel={() => setStartView('model')}
            isAnalyzing={isAnalyzing}
            inputRef={inputRef}
            carryCustomer={carryCustomer}
          />
        )}

        {phase === 'paste-inquiry' && pasteInquiryPreview && (
          <PasteInquiryPreview
            preview={pasteInquiryPreview}
            onApplyStock={() => {
              if (pasteAppliedLeadId) {
                navigate(buildKundenaktePath(pasteAppliedLeadId));
                return;
              }
              handleApplyStockInquiry();
            }}
            onApplyCustomer={handlePasteApplyCustomer}
            onManualEdit={handlePasteManualEdit}
            onOpenAkte={() => {
              if (pasteAppliedLeadId) {
                navigate(buildKundenaktePath(pasteAppliedLeadId));
                return;
              }
              handleApplyStockInquiry({ openAkte: true });
            }}
            onPrepareAnswer={handlePastePrepareAnswer}
            onCreateOffer={handlePasteCreateOffer}
            onOpenListing={handlePasteOpenListing}
            isExecuting={isExecuting}
            appliedLeadId={pasteAppliedLeadId}
          />
        )}

        {phase === 'input' && startView === 'advice' && (
          <DealerAiCleverBeratung
            onBack={() => setStartView('home')}
            onEvaluate={(chipIds) => runAnalysis({ chipIds })}
            isAnalyzing={isAnalyzing}
          />
        )}

        {phase === 'input' && startView === 'showroom' && (
          <ShowroomModeCapture
            initialCapture={showroomInitialCapture}
            existingLead={showroomLead}
            onSave={handleShowroomSave}
            onBack={handleShowroomBack}
            saving={isSavingShowroom}
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

        {phase === 'recognition-animate' && recognitionInsight && (
          <DealerAiRecognitionAnimation
            insight={recognitionInsight}
            onComplete={handleRecognitionAnimationComplete}
          />
        )}

        {contextBannerLabel && (phase === 'review' || (phase === 'input' && startView === 'home')) && (
          <p className="dai-add-vehicle-context" role="status">
            {contextBannerLabel}
          </p>
        )}

        {phase === 'magic-offer-entry' && (
          <MagicOfferEntry
            modelLabel={[
              configureDraft?.brand ?? 'Kia',
              configureDraft?.model ?? parsed?.fields?.model ?? 'Fahrzeug',
              configureDraft?.trimLabel,
            ].filter(Boolean).join(' ')}
            wishLine={(() => {
              const wish = addVehicleContext?.wishFields ?? {};
              const parts = [];
              const pt = wish.paymentType ?? configureDraft?.paymentType ?? parsed?.fields?.paymentType;
              if (pt && pt !== 'unknown') {
                parts.push(PAYMENT_TYPE_LABELS[pt] ?? pt);
              }
              if (wish.mileagePerYear ?? configureDraft?.mileagePerYear) {
                parts.push(`${Number(wish.mileagePerYear ?? configureDraft.mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
              }
              if (wish.termMonths ?? configureDraft?.termMonths) {
                parts.push(`${wish.termMonths ?? configureDraft.termMonths} Monate`);
              }
              return parts.length ? parts.join(' · ') : null;
            })()}
            initialText={magicOfferSeedText}
            isWorking={magicOfferWorking}
            onPrepare={handleMagicOfferPrepare}
            onUploadPdf={handleMagicOfferUploadPdf}
            onManual={handleMagicOfferManual}
            onBack={handleMagicOfferBackToAkte}
          />
        )}

        {phase === 'magic-offer-review' && magicOfferPreparation && (
          <MagicOfferReview
            preparation={magicOfferPreparation}
            isWorking={magicOfferWorking || isExecuting}
            onCreateOffer={handleMagicOfferCreate}
            onCorrection={handleMagicOfferCorrection}
            onChooseOfferType={handleMagicOfferChooseType}
            onChangeDetails={handleMagicOfferManual}
            onBack={handleMagicOfferBackToEntry}
            onOpenPriceList={() => {
              const modelKey = configureDraft?.modelKey
                ?? magicOfferPreparation?.grounded?.modelKey
                ?? parsed?.fields?.modelId;
              if (!modelKey) {
                showToast('Preisliste: Modell nicht erkannt');
                return;
              }
              import('../services/consultation/priceListBrowsingService.js')
                .then(({ resolveVerifiedPriceListDocument }) => {
                  const doc = resolveVerifiedPriceListDocument(modelKey);
                  if (doc?.sourceUrl || doc?.downloadUrl) {
                    window.open(doc.sourceUrl ?? doc.downloadUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  showToast('Keine verifizierte Preisliste für dieses Modell');
                })
                .catch(() => showToast('Preisliste konnte nicht geöffnet werden'));
            }}
          />
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

        {phase === 'offer-variants' && parsed?.ok && configureDraft && smartOfferVariants.length > 0 && (
          <DealerAiOfferVariantsStep
            variants={smartOfferVariants}
            draft={configureDraft}
            conditions={conditions}
            onVariantsChange={handleOfferVariantsChange}
            onSelectVariant={handleSelectSmartVariant}
            onOpenConditions={handleOpenFullConditions}
            onBack={handleOfferVariantsBack}
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
            onSave={handleConditionsSave}
            onBack={handleConditionsBack}
            onEditConfiguration={handleConditionsEditConfiguration}
            backLabel={addVehicleContext?.returnPath ? '← Zur Kundenakte' : '← Zur Konfiguration'}
            wishChips={conditionsWishChips}
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
            onPrepareOfferFromClever={handlePrepareOfferFromClever}
            onOpenOfferProposal={handleOpenOfferProposal}
            onOpenInbox={(currentLead) => navigate(`/backend/clever-eingang?leadId=${encodeURIComponent(currentLead.id)}`)}
            onOpenOfferEdit={handleOpenOfferEdit}
            onReturnToReview={handleReturnToReview}
            onDiscard={handleDiscard}
            onAddHistory={handleLeadHistory}
            isSaving={isSavingLead}
          />
        )}

        {phase === 'offer-proposal' && result?.type === 'lead' && offerProposalCard
          && shouldOpenOfferProposalView(offerProposalCard, activeLead) && (
          <CustomerOfferProposalView
            card={offerProposalCard}
            customerName={activeLead?.contact?.name ?? ''}
            phone={activeLead?.contact?.phone ?? ''}
            email={activeLead?.contact?.email ?? ''}
            offer={activeOfferProposal ?? createVehicleOfferFromCard(offerProposalCard)}
            lead={activeLead}
            onBack={handleBackFromProposal}
            onEditOffer={(card) => handleOpenOfferEdit(card, { fromProposal: true })}
            onMarkSent={handleOfferMarkSent}
            onStatusChange={handleOfferStatusChange}
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
            lead={activeLead}
            cleverTransfer={cleverOfferTransfer ?? activeLead?.crm?.cleverOfferTransfer ?? null}
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

        {phase === 'done' && result && result.type !== 'lead' && (
          <>
            <DealerAiResultPanel result={result} vehicleCard={vehicleCard} />
            <button type="button" className="dai-btn dai-btn--primary" onClick={handleDiscard}>
              Neuen Kundenwunsch erfassen
            </button>
          </>
        )}
      </main>

      {phase !== 'followup' && phase !== 'offer-edit' && phase !== 'offer-proposal' && phase !== 'offer-preview' && phase !== 'configure' && phase !== 'conditions' && phase !== 'offer-variants' && phase !== 'recognition-animate' && !(phase === 'input' && startView === 'home') && (
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
