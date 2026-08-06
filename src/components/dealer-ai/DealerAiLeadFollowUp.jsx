import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatReservedModelBadge,
  formatReservedModelName,
  sanitizeReservedModels,
  CALL_OUTCOME_CHIPS,
  computeFollowUpAt,
  FOLLOW_UP_CHIPS,
  formatHistoryWhen,
  getDefaultFollowUpChipId,
  getLeadStatusBadgeLabel,
  OFFER_STATUS_LABELS,
  phoneTelHref,
  pipelineToLeadStatus,
  toDatetimeLocalValue,
} from '../../services/dealerAiLeadCrm.js';
import {
  DEALER_AI_DELIVERY_DATE_OPTIONS,
  DEALER_AI_PAYMENT_OPTIONS,
  PAYMENT_TYPE_LABELS,
  buildSalesDoneVehicleLine,
} from '../../services/dealerAiParser.js';
import { getBudgetFieldLabel } from '../../services/dealerAiBudget.js';
import {
  getOfferMicroFeedback,
  polishHistoryText,
} from '../../services/cleverSalesCoach.js';
import { getRelatedLeadsByCustomer } from '../../services/dealerAiCustomer.js';
import {
  buildVehicleOpportunityCards,
  buildSchnellaufnahmeChips,
  computeAkteCleverStaerke,
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  hasVehicleOffer,
} from '../../services/customerAkte.js';
import { saveSellerKnowledgeAnswerFromLead } from '../../services/admin/cleverKnowledgeAnswerService.js';
import CustomerSpecialQuestionAnswerSheet from './CustomerSpecialQuestionAnswerSheet.jsx';
import CustomerOfferQuestionAnswerSheet, {
  resolveOfferQuestionVehicleLabel,
} from './CustomerOfferQuestionAnswerSheet.jsx';
import CustomerSelfDisclosureReviewSheet from './CustomerSelfDisclosureReviewSheet.jsx';
import { applyCustomerOfferQuestionAnswer } from '../../services/dealer/customerOfferQuestionAnswerService.js';
import { getCustomerOfferInteraction } from '../../services/customerOfferInteraction.js';
import { markInboxDoneForQuestion, markInboxItemDone } from '../../services/crm/cleverInboxService.js';
import CustomerAkteShowroomCapture, { applyShowroomCaptureToLead } from './CustomerAkteShowroomCapture.jsx';
import {
  buildCleverActionRecommendation,
  cleverActionToHint,
  CLEVER_ACTION_IDS,
  formatCleverActionFollowedHistoryText,
} from '../../services/crm/cleverActionEngine.js';
import { computeUnterlagenSummary, countUnterlagenOpenTasks } from '../../services/cleverUnterlagen.js';
import { buildSelfDisclosureCardModel } from '../../services/crm/customerPortalSelfDisclosureService.js';
import {
  addressFromLead,
  addressToStorageFields,
  buildAddressCacheKey,
  isAddressComplete,
  normalizeAddressResult,
} from '../../services/location/customerAddressModel.js';
import { getDealerLocation } from '../../services/location/dealerLocationService.js';
import {
  calculateCustomerDistance,
  formatDistanceSummary,
  getCachedDistanceInfo,
  shouldRecalculateDistance,
} from '../../services/location/customerDistanceService.js';
import { buildDealerToCustomerRouteUrl } from '../../services/location/mapsRouteService.js';
import { buildComposerReplySeed } from '../../services/crm/composerReplySeed.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import {
  buildBoardItems,
  cloneSelectionGroupVariant,
  resolveOfferSelectionGroups,
  resolveSelectionGroupVariant,
  sanitizeOfferSelectionGroups,
} from '../../services/sales/offerSelectionGroup.js';
import { updateSelectionGroupVariant } from '../../services/sales/offerVariantConfigurator.js';
import {
  buildWishConditionsFromSources,
  syncOfferSelectionGroupsWithWish,
} from '../../services/sales/wishConditionsSync.js';
import {
  attachPdfToSelectionVariant,
  buildVariantOfferSummaryLine,
  removePdfFromSelectionVariant,
} from '../../services/sales/selectionVariantOffer.js';
import {
  markPortfolioSent,
  prepareCustomerOfferPortfolio,
  validatePortfolioEnVkvForSend,
} from '../../services/crm/customerOfferPortfolioService.js';
import { applyPortfolioMailDelivery } from '../../services/mail/mailFlowService.js';
import {
  prepareCustomerPortalAccess,
  markCustomerPortalAccessSent,
  recordCustomerPortalAccessLinkCopied,
} from '../../services/crm/customerPortalAccessService.js';
import {
  buildCleverQuestionActivity,
  buildDocumentOpenedActivity,
  buildFavoriteActivity,
  buildVariantViewedActivity,
  detectCleverInsights,
  extractLexiconQuestionAnswer,
  getActivityDashboard,
  mergeInsightActivities,
} from '../../services/customerActivityTimeline.js';
import {
  buildCustomerMessageHistoryEntries,
  sendCleverChannelMessage,
} from '../../services/crm/customerMessageService.js';
import CleverKundenhelferSheet from './CleverKundenhelferSheet.jsx';
import CustomerAkteCompactHeader from './CustomerAkteCompactHeader.jsx';
import CustomerAkteKundenbild from './CustomerAkteKundenbild.jsx';
import CustomerAkteSnapshotChipEditor from './CustomerAkteSnapshotChipEditor.jsx';
import { AKTE_TABS } from './customerAkteTabs.js';
import CustomerAkteMoreSheet from './CustomerAkteMoreSheet.jsx';
import WorkspaceShell from '../layout/WorkspaceShell.jsx';
import {
  buildCustomerSnapshotModel,
  SNAPSHOT_MINI_EDITOR,
  SNAPSHOT_RATE_MODES,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import { COMPOSER_INTENT_CONSTRAINT } from '../../services/cleverSeller/composerIntentChips.js';
import {
  getNeedProfileFromLead,
  mergeNeedProfileIntoLead,
} from '../../services/consultation/needProfileService.js';
import CleverMoment from '../layout/CleverMoment.jsx';
import CustomerAkteKundenhelfer from './CustomerAkteKundenhelfer.jsx';
import CustomerAkteRequestedStockVehicle from './CustomerAkteRequestedStockVehicle.jsx';
import CustomerAkteWishConditionsSheet from './CustomerAkteWishConditionsSheet.jsx';
import CustomerAkteEquipmentWishes from './CustomerAkteEquipmentWishes.jsx';
import CustomerAkteCleverGespraech from './CustomerAkteCleverGespraech.jsx';
import CustomerAkteSharedWorkspace from './CustomerAkteSharedWorkspace.jsx';
import CustomerAkteOfferWorkspacePanel from './CustomerAkteOfferWorkspacePanel.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import CustomerAkteOfferRail from './CustomerAkteOfferRail.jsx';
import CustomerAkteCleverNotepad from './CustomerAkteCleverNotepad.jsx';
import CustomerAkteGoldenMomentCard from './CustomerAkteGoldenMomentCard.jsx';
import CustomerAkteVehicleTracks from './CustomerAkteVehicleTracks.jsx';
import CustomerAkteScenarioOfferSlots from './CustomerAkteScenarioOfferSlots.jsx';
import CustomerAkteFileNav from './CustomerAkteFileNav.jsx';
import CustomerAkteActivityTimeline from './CustomerAkteActivityTimeline.jsx';
import { sendSellerWorkspacePackage, appendOfferCardsToThread } from '../../services/crm/sharedWorkspaceService.js';
import { sendBothScenarioOffers } from '../../services/crm/dualScenarioSend.js';
import { buildCleverBeratungAkteView } from '../../services/dealer/cleverConsultationAkte.js';
import { buildCustomerUnderstanding } from '../../services/dealer/customerUnderstanding.js';
import { buildSellerCleverMoment } from '../../services/dealer/sellerAssistantOrchestrator.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
  patchVehicleTrackOnLead,
} from '../../services/crm/vehicleTrack.js';
import { buildGoldenMomentView } from '../../services/journey/goldenMoment.js';
import {
  appointmentTypeLabel,
  formatAppointmentWhen,
  listLeadAppointments,
} from '../../services/dealer/sellerAppointmentAssistFlow.js';
import { appendSellerInsightToLead, appendSellerInsightsFromTexts } from '../../services/dealer/sellerInsights.js';
import {
  buildKundenhelferDisplayNotes,
  buildKundenhelferSavePatch,
  collectNewKundenhelferChips,
} from '../../services/dealer/kundenhelferSavePayload.js';
import { addCustomKundenhelferChip } from '../../services/cleverKundenhelfer.js';
import CleverEmpfiehltCard from './CleverEmpfiehltCard.jsx';
import { evaluateJourney } from '../../services/journey/journeyEngine.js';
import {
  applyJourneyReminder,
  evaluateJourneyReminder,
  formatReminderDisplay,
} from '../../services/journey/journeyReminderService.js';
import { buildCleverMessageSuggestion } from '../../services/communication/cleverMessageSuggestionService.js';
import { copyToClipboard } from '../../logic/templateService.js';
import CustomerAkteBoard from './CustomerAkteBoard.jsx';
import CustomerAktePortalSendCta from './CustomerAktePortalSendCta.jsx';
import CustomerAkteAddProposalSheet, {
  CustomerAkteLeaseFinanceSheet,
} from './CustomerAkteAddProposalSheet.jsx';
import {
  PROPOSAL_INTENTS,
  resolveProposalPaymentType,
} from '../../services/dealer/customerAddProposalFlow.js';
import {
  duplicateVehicleConfiguration,
  filterSendableVehicleCards,
  resolveBoardOfferPrimaryAction,
} from '../../services/dealer/boardOfferModel.js';
import { openBoardOfferEntry } from '../../services/dealer/openOfferCalculator.js';
import {
  WORKING_CONTEXT_KINDS,
  buildDocumentWorkingContextItem,
  buildOfferWorkingContextItem,
  findOfferWorkingContext,
  listAttachableAkteDocuments,
  listOfferWorkingContexts,
  removeWorkingContextItem,
  toggleOfferWorkingContext,
  upsertWorkingContextItem,
} from '../../services/crm/composerWorkingContext.js';
import {
  resolveOfferReferenceFromText,
  trackToComposerCard,
} from '../../services/crm/resolveOfferReference.js';
import { searchAkteByQuery } from '../../services/crm/composerAkteSearch.js';
import {
  buildStockVehicleCalculatorNavigateState,
  getPrimaryRequestedStockVehicle,
  openStockVehicleListing,
} from '../../services/inquiry/stockVehicleInquiryFlow.js';
import CustomerAkteCleverAuswahlSheet from './CustomerAkteCleverAuswahlSheet.jsx';
import CustomerAktePortfolioShareSheet from './CustomerAktePortfolioShareSheet.jsx';
import OfferVariantConfigurator from './OfferVariantConfigurator.jsx';
import SelectionVariantOfferView from './SelectionVariantOfferView.jsx';
import CustomerAddressSheet from './CustomerAddressSheet.jsx';
import CleverUnterlagenSheet from './CleverUnterlagenSheet.jsx';
import CleverLexikon from '../backend/CleverLexikon.jsx';
import { useCleverInboxOptional } from '../../context/CleverInboxContext.jsx';
import { INBOX_EVENT_TYPES } from '../../services/crm/cleverInboxService.js';
import { copyOfferLink } from '../../services/vehicleOffer.js';
import { normalizeConversationNotes } from '../../services/kundenhelferConversationNotes.js';
import { sanitizeKundenhelferChipCategories } from '../../services/kundenwissenCategories.js';
import { createEmptyTradeIn, getTradeIn, patchTradeIn } from '../../services/customerAkteTradeIn.js';
import { buildLexiconAkteChip } from '../../services/lexicon/cleverLexiconSearchService.js';
import DealerAppLegalMenu from '../dealer/DealerAppLegalMenu.jsx';
import VehicleImage from '../shared/VehicleImage.jsx';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import './CustomerAkte.css';

const SHEETS = {
  customer: 'customer',
  address: 'address',
  wish: 'wish',
  wishConditions: 'wish_conditions',
  next: 'next',
  offer: 'offer',
  models: 'models',
  outcome: 'outcome',
  history: 'history',
  kundenhelfer: 'kundenhelfer',
  unterlagen: 'unterlagen',
  antworten: 'antworten',
  vehicle: 'vehicle',
  cleverAuswahl: 'clever_auswahl',
  more: 'more',
  lexikon: 'lexikon',
  specialQuestionAnswer: 'special_question_answer',
  questionAnswer: 'question_answer',
  selfDisclosureReview: 'self_disclosure_review',
  portfolioShare: 'portfolio_share',
  addProposal: 'add_proposal',
  leaseFinancePick: 'lease_finance_pick',
  boardOffers: 'board_offers',
  attachOffer: 'attach_offer',
  attachDocument: 'attach_document',
  akteSearch: 'akte_search',
};

function Field({ label, id, type = 'text', value, onChange, placeholder, inputMode }) {
  return (
    <label className="dai-lead-field" htmlFor={id}>
      <span className="dai-lead-field__label">{label}</span>
      {type === 'textarea' ? (
        <textarea
          id={id}
          className="dai-lead-field__input dai-lead-field__input--area"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          className="dai-lead-field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function SheetFooter({ onCancel, onSave, saving, saveLabel = 'Speichern' }) {
  return (
    <div className="dai-sheet-actions">
      {onCancel && (
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onCancel}>
          Abbrechen
        </button>
      )}
      <button type="button" className="dai-btn dai-btn--primary" onClick={onSave} disabled={saving}>
        {saving ? 'Speichern …' : saveLabel}
      </button>
    </div>
  );
}

function ReservedModelDetailCard({
  model,
  index,
  onOffer,
  onRemove,
  disabled = false,
}) {
  if (!model) return null;
  const badge = formatReservedModelBadge(model, index);
  const hint = model.priceHint ?? model.reason ?? null;

  return (
    <article className="dai-reserved-model">
      <div className="dai-reserved-model__visual">
        <VehicleImage
          brand="Kia"
          model={model.modelKey ?? model.id}
          bodyType={model.bodyType ?? 'suv'}
          variant="card"
          className="dai-reserved-model__image-wrap"
          imageClassName="dai-reserved-model__image"
        />
      </div>
      <div className="dai-reserved-model__body">
        <div className="dai-reserved-model__head">
          <div>
            <h3 className="dai-reserved-model__name">{formatReservedModelName(model.name)}</h3>
            {model.trimLabel && (
              <p className="dai-reserved-model__trim">{model.trimLabel}</p>
            )}
          </div>
          <span className="dai-reserved-model__badge">{badge}</span>
        </div>
        {hint && <p className="dai-reserved-model__hint">{hint}</p>}
        <div className="dai-reserved-model__actions">
          <button
            type="button"
            className="dai-btn dai-btn--secondary dai-reserved-model__btn"
            onClick={() => onOffer?.(model)}
            disabled={disabled}
          >
            Angebot erstellen
          </button>
          <button
            type="button"
            className="dai-btn dai-btn--ghost dai-reserved-model__btn"
            onClick={() => onRemove?.(model)}
            disabled={disabled}
          >
            Entfernen
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DealerAiLeadFollowUp({
  result,
  parsed,
  lead,
  leads = [],
  isFresh = false,
  onEnterDetail,
  onNewWish,
  onStartNewWish,
  onSave,
  onPrepareOffer,
  onPrepareOfferFromClever,
  onOpenOfferProposal,
  onOpenOfferEdit,
  onOpenInbox,
  onReturnToReview,
  onDiscard,
  onAddHistory,
  initialSheet = null,
  initialAntwortenIntent = null,
  initialComposerFocus = false,
  initialInboxItemId = null,
  initialThreadId = null,
  initialMessageId = null,
  initialAntwortenOfferId = null,
  initialQuestionContext = null,
  onOpenOfferQuestionAnswer,
  onQuestionAnswerContextConsumed,
  isSaving = false,
}) {
  const navigate = useNavigate();
  const inbox = useCleverInboxOptional();
  const inboxOpenCount = useMemo(
    () => (lead?.id ? (inbox?.countForCustomer(lead.id) ?? 0) : 0),
    [inbox, lead?.id, inbox?.version],
  );
  const portalCustomerMessageItem = useMemo(() => {
    if (!lead?.id || !inbox?.listForCustomer) return null;
    return inbox.listForCustomer(lead.id).find(
      (item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
    ) ?? null;
  }, [inbox, lead?.id, inbox?.version]);
  const fields = parsed?.fields ?? {};
  const crm = lead?.crm ?? {};

  const [akteTab, setAkteTab] = useState(AKTE_TABS.clever);
  const [cleverMode, setCleverMode] = useState(true);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [composerSeedDraft, setComposerSeedDraft] = useState('');
  const [composerSeedToken, setComposerSeedToken] = useState(0);
  const [composerSeedAutoRun, setComposerSeedAutoRun] = useState(false);
  const [composerIntentFocusToken, setComposerIntentFocusToken] = useState(0);
  const [composerIntentFocusConstraint, setComposerIntentFocusConstraint] = useState(null);
  const [snapshotHighlightLabels, setSnapshotHighlightLabels] = useState([]);
  const [snapshotChipEditor, setSnapshotChipEditor] = useState(null);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [kundenbildExpanded, setKundenbildExpanded] = useState(false);
  const [kundeDetailsOpen, setKundeDetailsOpen] = useState(false);
  const [angeboteFilter, setAngeboteFilter] = useState('all');
  const [activeSheet, setActiveSheet] = useState(
    initialSheet === SHEETS.questionAnswer
      ? SHEETS.questionAnswer
      : (initialSheet === SHEETS.antworten ? null : initialSheet),
  );
  const [inboxItemIdForAntworten, setInboxItemIdForAntworten] = useState(initialInboxItemId ?? null);
  const [inboxItemIdForSelfDisclosure, setInboxItemIdForSelfDisclosure] = useState(
    initialSheet === SHEETS.selfDisclosureReview ? initialInboxItemId : null,
  );
  const [questionContext, setQuestionContext] = useState(initialQuestionContext);
  const composerDeepLinkDoneRef = useRef(false);
  const focusOfferAttachedRef = useRef(false);
  const specialAnswerPendingSendRef = useRef(false);

  const composerReplyContext = useMemo(() => {
    const portal = portalCustomerMessageItem;
    return {
      threadId: initialThreadId
        ?? portal?.metadata?.threadId
        ?? null,
      relatedOfferId: questionContext?.offerId
        ?? initialAntwortenOfferId
        ?? portal?.offerId
        ?? portal?.metadata?.offerId
        ?? null,
      relatedQuestionId: questionContext?.questionId
        ?? portal?.metadata?.questionId
        ?? null,
    };
  }, [
    initialThreadId,
    initialAntwortenOfferId,
    questionContext?.offerId,
    questionContext?.questionId,
    portalCustomerMessageItem,
  ]);

  useEffect(() => {
    if (!initialSheet) return;
    if (initialSheet === SHEETS.questionAnswer) {
      setActiveSheet(SHEETS.questionAnswer);
      return;
    }
    // Legacy sheet=antworten → Composer (kein CleverAntworten-Sheet mehr)
    if (initialSheet === SHEETS.antworten) {
      setActiveSheet(null);
      return;
    }
    setActiveSheet(initialSheet);
  }, [initialSheet]);

  useEffect(() => {
    if (initialInboxItemId) {
      setInboxItemIdForAntworten(initialInboxItemId);
      if (initialSheet === SHEETS.selfDisclosureReview) {
        setInboxItemIdForSelfDisclosure(initialInboxItemId);
      }
    }
  }, [initialInboxItemId, initialSheet]);

  useEffect(() => {
    if (initialQuestionContext?.offerId && initialQuestionContext?.questionId) {
      setQuestionContext(initialQuestionContext);
      setActiveSheet(SHEETS.questionAnswer);
    }
  }, [initialQuestionContext]);
  const [selectedVehicleCard, setSelectedVehicleCard] = useState(null);
  const [offerWorkspaceCard, setOfferWorkspaceCard] = useState(null);
  const [workingContextItems, setWorkingContextItems] = useState([]);
  const cleverComposerCtx = useCleverComposerOptional();
  const globalHandoffConsumedRef = useRef(null);

  // Handoff vom Global Composer (Working Context + Message-Edit)
  useEffect(() => {
    const items = cleverComposerCtx?.attachedWorkingObjects;
    if (!Array.isArray(items) || !items.length) return;
    const fingerprint = items.map((i) => i.id || i.label || i.messageDraft || '').join('|');
    if (globalHandoffConsumedRef.current === fingerprint) return;
    globalHandoffConsumedRef.current = fingerprint;
    setWorkingContextItems((prev) => {
      let next = prev;
      for (const item of items) {
        next = upsertWorkingContextItem(next, item);
      }
      return next;
    });
  }, [cleverComposerCtx?.attachedWorkingObjects]);

  const [freshTrackId, setFreshTrackId] = useState(null);
  const [akteSearchQuery, setAkteSearchQuery] = useState('');
  const [feedFocusMessageId, setFeedFocusMessageId] = useState(null);
  const [feedFocusToken, setFeedFocusToken] = useState(0);
  const [selectedSelectionGroup, setSelectedSelectionGroup] = useState(null);
  const [variantConfigureContext, setVariantConfigureContext] = useState(null);
  const [variantOfferContext, setVariantOfferContext] = useState(null);
  const [portfolioShare, setPortfolioShare] = useState(null);
  const [toast, setToast] = useState('');
  const [showCardAnimation, setShowCardAnimation] = useState(isFresh);
  const [reservedModels, setReservedModels] = useState(
    () => sanitizeReservedModels(crm.reservedModels),
  );
  const [offerSelectionGroups, setOfferSelectionGroups] = useState(
    () => sanitizeOfferSelectionGroups(crm.offerSelectionGroups),
  );

  useEffect(() => {
    if (isFresh) {
      setShowCardAnimation(true);
      const timer = setTimeout(() => setShowCardAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isFresh]);

  useEffect(() => {
    setReservedModels(sanitizeReservedModels(lead?.crm?.reservedModels));
  }, [lead?.crm?.reservedModels]);

  useEffect(() => {
    if (lead?.crm?.offerSelectionGroups?.length) {
      setOfferSelectionGroups(sanitizeOfferSelectionGroups(lead.crm.offerSelectionGroups));
    }
  }, [lead?.crm?.offerSelectionGroups]);

  useEffect(() => {
    if (!freshTrackId) return undefined;
    const timer = setTimeout(() => setFreshTrackId(null), 12000);
    return () => clearTimeout(timer);
  }, [freshTrackId]);

  const [name, setName] = useState(lead?.contact?.name?.replace('Kunde (offen)', '') ?? fields.customerName ?? '');
  const [phone, setPhone] = useState(lead?.contact?.phone ?? '');
  const [email, setEmail] = useState(lead?.contact?.email ?? '');

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previous = document.title;
    const titleName = String(name ?? '').trim() || 'Kunde noch offen';
    document.title = `${titleName} · Clever`;
    return () => {
      document.title = previous;
    };
  }, [name]);
  const [customerAddress, setCustomerAddress] = useState(() => addressFromLead(lead));
  const [distanceInfo, setDistanceInfo] = useState(() => lead?.crm?.distanceInfo ?? null);
  const [note, setNote] = useState(lead?.notes ?? parsed?.shortForm ?? '');

  const [wishModel, setWishModel] = useState(lead?.vehicle?.model ?? fields.model ?? '');
  const [wishTrim, setWishTrim] = useState(lead?.vehicle?.trim ?? fields.trimLabel ?? '');
  const [wishPaymentType, setWishPaymentType] = useState(lead?.paymentType ?? fields.paymentType ?? 'unknown');
  const [wishDesiredPrice, setWishDesiredPrice] = useState(
    lead?.wish?.desiredPrice ?? fields.desiredPrice ?? '',
  );
  const [wishDesiredRate, setWishDesiredRate] = useState(
    lead?.desiredRate ?? fields.desiredRate ?? '',
  );
  const [wishTermMonths, setWishTermMonths] = useState(lead?.wish?.termMonths ?? fields.termMonths ?? '');
  const [wishMileage, setWishMileage] = useState(lead?.wish?.mileagePerYear ?? fields.mileagePerYear ?? '');
  const [wishDownPayment, setWishDownPayment] = useState(
    lead?.wish?.downPayment ?? fields.downPayment ?? '',
  );
  const [wishDelivery, setWishDelivery] = useState(
    lead?.deliveryTime ?? fields.desiredDeliveryDate ?? fields.deliveryTime ?? '',
  );
  const [wishEquipment, setWishEquipment] = useState(
    lead?.wish?.equipment ?? fields.trimLabel ?? '',
  );

  const [nextStepId, setNextStepId] = useState(crm.nextStepId ?? getDefaultFollowUpChipId());
  const [followUpAt, setFollowUpAt] = useState(
    crm.followUpAt ?? computeFollowUpAt(getDefaultFollowUpChipId()),
  );
  const [followUpSource, setFollowUpSource] = useState(crm.followUpSource ?? null);
  const [pipelineStatusId, setPipelineStatusId] = useState(crm.pipelineStatusId ?? 'neu');
  const [outcomeId, setOutcomeId] = useState(crm.lastOutcomeId ?? null);
  const [outcomeNote, setOutcomeNote] = useState('');

  const [kundenhelferNotes, setKundenhelferNotes] = useState(
    () => buildKundenhelferDisplayNotes(lead),
  );
  const [kundenhelferChipCategories, setKundenhelferChipCategories] = useState(
    () => sanitizeKundenhelferChipCategories(
      crm.kundenhelfer?.chipCategories,
      crm.kundenhelfer?.notes ?? '',
    ),
  );
  const [kundenhelferInitialCategory, setKundenhelferInitialCategory] = useState(null);
  const [wishConditionsFocusField, setWishConditionsFocusField] = useState(null);
  const [kundenhelferMemos, setKundenhelferMemos] = useState(crm.kundenhelfer?.voiceMemos ?? []);
  const [conversationNotes, setConversationNotes] = useState(
    () => normalizeConversationNotes(crm.kundenhelfer?.conversationNotes),
  );
  const [tradeInData, setTradeInData] = useState(() => getTradeIn(lead));

  useEffect(() => {
    setKundenhelferNotes(buildKundenhelferDisplayNotes(lead));
    setKundenhelferChipCategories(sanitizeKundenhelferChipCategories(
      lead?.crm?.kundenhelfer?.chipCategories,
      lead?.crm?.kundenhelfer?.notes ?? '',
    ));
    setKundenhelferMemos(lead?.crm?.kundenhelfer?.voiceMemos ?? []);
    setConversationNotes(normalizeConversationNotes(lead?.crm?.kundenhelfer?.conversationNotes));
    setTradeInData(getTradeIn(lead));
  }, [
    lead?.crm?.kundenhelfer?.notes,
    lead?.crm?.sellerInsights,
    lead?.crm?.migration?.kundenhelferV1At,
    lead?.crm?.kundenhelfer?.chipCategories,
    lead?.crm?.kundenhelfer?.voiceMemos,
    lead?.crm?.kundenhelfer?.conversationNotes,
    lead?.crm?.tradeIn,
  ]);

  useEffect(() => {
    setCustomerAddress(addressFromLead(lead));
    setDistanceInfo(lead?.crm?.distanceInfo ?? null);
  }, [
    lead?.id,
    lead?.crm?.address,
    lead?.crm?.customerAddress,
    lead?.crm?.distanceInfo,
    lead?.contact?.address,
  ]);

  const dealerLocation = useMemo(
    () => getDealerLocation(lead?.dealerId),
    [lead?.dealerId],
  );

  const addressLine = customerAddress?.formattedAddress ?? '';
  const addressCacheKey = buildAddressCacheKey(customerAddress);

  const distanceSummary = useMemo(() => {
    const cached = getCachedDistanceInfo({
      distanceInfo,
      customerAddress,
      dealerLocation,
    });
    return formatDistanceSummary(cached) ?? '';
  }, [distanceInfo, customerAddress, dealerLocation, addressCacheKey]);

  const routeHref = useMemo(
    () => buildDealerToCustomerRouteUrl(customerAddress, dealerLocation),
    [customerAddress, dealerLocation, addressCacheKey],
  );

  useEffect(() => {
    if (!isAddressComplete(customerAddress)) return undefined;
    if (!shouldRecalculateDistance({ distanceInfo, customerAddress, dealerLocation })) {
      return undefined;
    }

    let cancelled = false;
    calculateCustomerDistance(customerAddress, dealerLocation).then((result) => {
      if (cancelled || !result) return;
      setDistanceInfo(result);
      onSave?.(buildSavePayload({ distanceInfo: result }), {
        silent: true,
        addFollowupHistory: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [addressCacheKey, dealerLocation.dealerId]);

  const history = useMemo(() => {
    const baseHistory = lead?.history ?? [];
    const linkedMessageIds = new Set(
      baseHistory.map((entry) => entry.meta?.customerMessageId).filter(Boolean),
    );
    const messageEntries = buildCustomerMessageHistoryEntries(lead ?? {})
      .filter((entry) => !linkedMessageIds.has(entry.meta?.customerMessageId));
    return [...baseHistory, ...messageEntries].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [lead]);

  const telHref = phoneTelHref(phone);

  const requestedStockVehicle = useMemo(
    () => getPrimaryRequestedStockVehicle(lead),
    [lead],
  );

  function handleOpenStockListing(stockVehicle) {
    openStockVehicleListing(stockVehicle);
  }

  function handleCreateStockOffer(stockVehicle) {
    const navState = buildStockVehicleCalculatorNavigateState(lead, stockVehicle, {
      returnPath: buildKundenaktePath(lead.id),
    });
    if (!navState) return;
    navigate('/verkaufsassistent', { state: navState });
  }

  const cleverBeratungView = useMemo(
    () => (lead ? buildCleverBeratungAkteView(lead) : null),
    [lead],
  );

  const customerUnderstanding = useMemo(
    () => (lead ? buildCustomerUnderstanding(lead) : null),
    [lead],
  );

  const customerSnapshot = useMemo(
    () => (lead ? buildCustomerSnapshotModel(lead, {
      // Working Context nur zur Offer-Leak-Erkennung – keine zweite Truth
      workingContextItems,
      relevantKeys: wishConditionsFocusField ? [wishConditionsFocusField] : [],
      highlightLabels: snapshotHighlightLabels,
    }) : null),
    [lead, wishConditionsFocusField, workingContextItems, snapshotHighlightLabels],
  );

  const hasSellerCustomerPicture = Boolean(customerUnderstanding?.meta?.hasData);

  const resolvedOffers = useMemo(() => {
    const crmOffers = crm.offers ?? [];
    if (crmOffers.length) return crmOffers;
    if (lead?.offerCode) {
      const paymentLabel = PAYMENT_TYPE_LABELS[wishPaymentType]
        ?.replace(' / Barzahlung', '')
        ?.replace('Kauf / Barzahlung', 'Kauf');
      return [{
        id: lead.offerCode,
        code: lead.offerCode,
        name: lead.vehicle?.label,
        vehicle: lead.vehicle?.model ?? wishModel,
        paymentType: paymentLabel ?? wishPaymentType,
        status: 'draft',
      }];
    }
    return [];
  }, [crm.offers, lead?.offerCode, lead?.vehicle, wishModel, wishPaymentType]);

  const wishSummaryFields = useMemo(() => ({
    brand: fields.brand ?? 'Kia',
    model: wishModel,
    trimLabel: wishTrim,
    paymentType: wishPaymentType,
    desiredPrice: wishDesiredPrice ? Number(wishDesiredPrice) : null,
    desiredRate: wishDesiredRate ? Number(wishDesiredRate) : null,
    termMonths: wishTermMonths ? Number(wishTermMonths) : null,
    mileagePerYear: wishMileage ? Number(wishMileage) : null,
    downPayment: wishDownPayment !== '' && wishDownPayment != null
      ? Number(wishDownPayment)
      : null,
    desiredDeliveryDate: wishDelivery,
    deliveryTime: wishDelivery,
  }), [fields.brand, wishModel, wishTrim, wishPaymentType, wishDesiredPrice, wishDesiredRate, wishTermMonths, wishMileage, wishDownPayment, wishDelivery]);

  const wishEditValues = useMemo(() => ({
    paymentType: wishPaymentType,
    termMonths: wishTermMonths,
    mileagePerYear: wishMileage,
    downPayment: wishDownPayment,
    desiredRate: wishDesiredRate,
    desiredPrice: wishDesiredPrice,
    delivery: wishDelivery,
  }), [
    wishPaymentType,
    wishTermMonths,
    wishMileage,
    wishDownPayment,
    wishDesiredRate,
    wishDesiredPrice,
    wishDelivery,
  ]);

  const schnellaufnahmeChips = useMemo(
    () => buildSchnellaufnahmeChips(wishEditValues),
    [wishEditValues],
  );

  const workingOfferItem = useMemo(
    () => findOfferWorkingContext(workingContextItems),
    [workingContextItems],
  );

  const selectedOfferContexts = useMemo(
    () => listOfferWorkingContexts(workingContextItems),
    [workingContextItems],
  );

  const selectedTrackIds = useMemo(
    () => selectedOfferContexts.map((item) => item.offerId).filter(Boolean),
    [selectedOfferContexts],
  );

  const hideRedundantWishChips = useMemo(() => {
    if (!hasSellerCustomerPicture || !schnellaufnahmeChips.length) return false;
    const corpus = [
      ...(customerUnderstanding?.verstaendnis?.labels ?? []),
      ...(customerUnderstanding?.verstaendnis?.concerns ?? []),
      customerUnderstanding?.gespraechseinstieg?.lead ?? '',
      customerUnderstanding?.gespraechseinstieg?.context ?? '',
    ].join(' ').toLowerCase();
    if (!corpus.trim()) return false;

    let overlap = 0;
    for (const chip of schnellaufnahmeChips) {
      const label = String(chip.label ?? '').toLowerCase();
      if (!label) continue;
      if (corpus.includes(label)) {
        overlap += 1;
        continue;
      }
      if (/budget|leasing|finanz|kauf|\bkm\b|rate|zahlungsart|monat/i.test(label)
        && /budget|leasing|finanz|kauf|\bkm\b|rate|zahlungsart|monat/i.test(corpus)) {
        overlap += 1;
      }
    }
    return overlap >= Math.min(2, schnellaufnahmeChips.length);
  }, [hasSellerCustomerPicture, customerUnderstanding, schnellaufnahmeChips]);

  const headSubline = buildSalesDoneVehicleLine({
    brand: fields.brand ?? 'Kia',
    model: wishModel,
    paymentType: wishPaymentType,
  });
  const referenceCode = lead?.referenceCode ?? lead?.offerCode ?? null;
  const vehicleLine = headSubline;

  const relatedWishes = useMemo(
    () => getRelatedLeadsByCustomer(leads, lead).filter((l) => l.id !== lead?.id),
    [leads, lead],
  );

  const vehicleCards = useMemo(() => buildVehicleOpportunityCards({
    lead,
    wishFields: wishSummaryFields,
    reservedModels,
    relatedLeads: relatedWishes,
    offers: resolvedOffers,
  }), [lead, wishSummaryFields, reservedModels, relatedWishes, resolvedOffers]);

  const resolvedSelectionGroups = useMemo(() => resolveOfferSelectionGroups({
    lead,
    wishFields: wishSummaryFields,
    storedGroups: offerSelectionGroups.length ? offerSelectionGroups : null,
  }), [lead, wishSummaryFields, offerSelectionGroups]);

  useEffect(() => {
    if (offerSelectionGroups.length > 0) return;
    if (!resolvedSelectionGroups.length) return;
    setOfferSelectionGroups(resolvedSelectionGroups);
  }, [offerSelectionGroups.length, resolvedSelectionGroups]);

  const boardItems = useMemo(() => buildBoardItems({
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
  }), [vehicleCards, resolvedSelectionGroups]);

  const akteCleverScore = useMemo(() => computeAkteCleverStaerke({
    name,
    phone,
    email,
    lead,
    vehicleCardCount: vehicleCards.length,
    offersCount: resolvedOffers.length,
    hasNextStep: Boolean(nextStepId),
  }), [lead, name, phone, email, vehicleCards.length, resolvedOffers.length, nextStepId]);

  const cleverRecommendation = useMemo(() => buildCleverActionRecommendation({
    lead,
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
    customerName: name,
  }), [lead, vehicleCards, resolvedSelectionGroups, name]);

  const [cleverDoneActionIds, setCleverDoneActionIds] = useState([]);

  useEffect(() => {
    const last = lead?.crm?.cleverLastDoneActionId;
    setCleverDoneActionIds(last ? [last] : []);
  }, [lead?.id, lead?.crm?.cleverLastDoneActionId]);

  const advisorNextStepHint = useMemo(() => {
    const label = lead?.crm?.nextStepLabel;
    if (!label) return null;
    if (lead?.advisorConversation || lead?.crm?.nextStepId === 'continue_advisor_conversation') {
      return {
        title: label,
        text: label,
        cta: label,
        ctaLabel: label,
      };
    }
    return null;
  }, [lead?.advisorConversation, lead?.crm?.nextStepId, lead?.crm?.nextStepLabel]);

  const journeyResult = useMemo(() => evaluateJourney(lead, {
    excludedActionIds: cleverDoneActionIds,
    telHref,
    customerName: name,
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
  }), [lead, vehicleCards, resolvedSelectionGroups, name, cleverDoneActionIds, telHref]);

  const reminderEval = useMemo(() => evaluateJourneyReminder(lead, {
    journey: journeyResult,
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
  }), [lead, journeyResult, vehicleCards, resolvedSelectionGroups]);

  const messageSuggestion = useMemo(() => buildCleverMessageSuggestion(lead, {
    journey: journeyResult,
    reminder: reminderEval,
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
    customerName: name,
    phone,
    email,
    kundenhelferNotes,
    wishPaymentType,
  }), [lead, journeyResult, reminderEval, vehicleCards, resolvedSelectionGroups, name, phone, email, kundenhelferNotes, wishPaymentType]);

  const cleverEmpfiehltView = useMemo(() => {
    let view = journeyResult?.view;
    if (!view || !advisorNextStepHint) {
      if (view) {
        view = {
          ...view,
          messageSuggestion,
          ...(reminderEval?.displayLine ? { reminderLine: reminderEval.displayLine } : {}),
        };
        if (!reminderEval?.displayLine && crm.followUpAt && crm.nextStepLabel) {
          view.reminderLine = formatReminderDisplay({
            dueAt: crm.followUpAt,
            reason: crm.journeyReminderReason ?? crm.nextStepLabel,
          });
        }
      }
      return view;
    }
    return {
      ...view,
      headline: advisorNextStepHint.title ?? view.headline,
      subline: advisorNextStepHint.text ?? view.subline,
      reminderLine: reminderEval?.displayLine ?? view.reminderLine,
      messageSuggestion,
    };
  }, [journeyResult, advisorNextStepHint, reminderEval, messageSuggestion, crm.followUpAt, crm.nextStepLabel, crm.journeyReminderReason]);

  const sellerCleverMoment = useMemo(
    () => buildSellerCleverMoment(lead),
    [lead],
  );

  const vehicleTracks = useMemo(() => {
    const sorted = sortTracksForOverview(listCustomerVehicleTracks(lead));
    if (!freshTrackId) return sorted;
    const idx = sorted.findIndex((track) => (
      String(track.id) === String(freshTrackId)
      || track.offerIds?.some((id) => String(id) === String(freshTrackId))
    ));
    if (idx <= 0) return sorted;
    const next = [...sorted];
    const [pinned] = next.splice(idx, 1);
    return [pinned, ...next];
  }, [lead, freshTrackId]);

  const goldenMomentView = useMemo(
    () => buildGoldenMomentView(lead),
    [lead],
  );

  const leadAppointments = useMemo(
    () => listLeadAppointments(lead),
    [lead],
  );

  const unterlagenPaymentType = wishPaymentType !== 'unknown' ? wishPaymentType : lead?.paymentType;
  const unterlagenOpenCount = useMemo(
    () => countUnterlagenOpenTasks(lead, unterlagenPaymentType),
    [lead, unterlagenPaymentType],
  );
  const unterlagenSummary = useMemo(
    () => computeUnterlagenSummary(lead, unterlagenPaymentType),
    [lead, unterlagenPaymentType],
  );

  const attachableDocuments = useMemo(
    () => listAttachableAkteDocuments(lead, unterlagenSummary),
    [lead, unterlagenSummary],
  );

  const akteSearchHits = useMemo(() => {
    if (activeSheet !== SHEETS.akteSearch) return [];
    const q = String(akteSearchQuery || '').trim();
    if (q.length < 2) return [];
    return searchAkteByQuery(lead, q, { limit: 20, freeText: true }).hits ?? [];
  }, [activeSheet, akteSearchQuery, lead]);
  const selfDisclosureCard = useMemo(() => buildSelfDisclosureCardModel(lead), [lead]);
  const selfDisclosureLabel = selfDisclosureCard?.statusLabel || 'offen';

  const headerContextLine = useMemo(() => {
    const paymentLabel = PAYMENT_TYPE_LABELS[wishPaymentType]
      || (wishPaymentType === 'leasing' ? 'Leasing'
        : wishPaymentType === 'financing' ? 'Finanzierung'
          : wishPaymentType === 'cash' ? 'Kauf' : '');
    const trackCount = vehicleTracks.length || vehicleCards.length;
    if (trackCount >= 2) {
      const parts = [`${trackCount} Fahrzeuge`];
      if (paymentLabel) parts.push(paymentLabel);
      return parts.join(' · ');
    }
    const models = [...new Set(
      vehicleCards
        .map((card) => String(formatVehicleCardTitle(card) || '').replace(/^Kia\s+/i, '').trim())
        .filter(Boolean),
    )].slice(0, 2);
    if (!models.length && wishModel) models.push(String(wishModel).replace(/^Kia\s+/i, '').trim());
    const parts = [];
    if (models.length) parts.push(models.join(' / '));
    if (paymentLabel) parts.push(paymentLabel);
    return parts.join(' · ');
  }, [vehicleCards, vehicleTracks, wishModel, wishPaymentType]);

  function focusChatComposer({
    clever = true,
    seedDraft = '',
    autoRun = false,
    intentConstraint = undefined,
  } = {}) {
    setAkteTab(AKTE_TABS.clever);
    setCleverMode(true);
    setComposerFocusToken((n) => n + 1);
    if (intentConstraint !== undefined) {
      setComposerIntentFocusConstraint(intentConstraint);
      setComposerIntentFocusToken((n) => n + 1);
    }
    if (seedDraft) {
      setComposerSeedAutoRun(Boolean(autoRun));
      setComposerSeedDraft(seedDraft);
      setComposerSeedToken((n) => n + 1);
    }
    setMoreSheetOpen(false);
  }

  function handleKundenbildMerken() {
    setKundenbildExpanded(true);
    focusChatComposer({
      clever: true,
      intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
    });
  }

  function handleRememberApplied({ labels = [] } = {}) {
    const next = (labels || []).filter(Boolean).slice(0, 6);
    setSnapshotHighlightLabels(next);
    setKundenbildExpanded(true);
    if (next.length) {
      window.setTimeout(() => setSnapshotHighlightLabels([]), 2800);
    }
  }

  useEffect(() => {
    if (composerDeepLinkDoneRef.current) return;
    const wantsComposer = initialComposerFocus
      || initialSheet === SHEETS.antworten
      || Boolean(initialAntwortenIntent)
      || Boolean(initialAntwortenOfferId);
    if (!wantsComposer) return;
    if (initialSheet === SHEETS.questionAnswer) return;
    composerDeepLinkDoneRef.current = true;

    let question = '';
    let vehicleLabel = '';
    if (initialInboxItemId && lead?.id && inbox?.listForCustomer) {
      const inboxItem = inbox.listForCustomer(lead.id).find((item) => item.id === initialInboxItemId)
        ?? null;
      question = String(
        inboxItem?.metadata?.questionText
          ?? inboxItem?.message
          ?? inboxItem?.title
          ?? '',
      ).trim();
      vehicleLabel = String(inboxItem?.vehicleLabel ?? '').trim();
    }
    if (!question && initialMessageId) {
      const msg = (lead?.crm?.customerMessages ?? []).find((entry) => entry.id === initialMessageId);
      question = String(msg?.text ?? msg?.body ?? '').trim();
    }
    if (!question && initialQuestionContext?.questionId) {
      question = '';
    }

    const seed = buildComposerReplySeed(initialAntwortenIntent, { question, vehicleLabel });
    const t = setTimeout(() => {
      focusChatComposer({ clever: true, seedDraft: seed });
      if (!initialAntwortenOfferId) {
        const toastText = initialAntwortenIntent === 'offer_change_request'
          ? 'Änderungswunsch im Composer – prüfen, dann übernehmen'
          : 'Antwort im Composer – tippen oder sprechen, dann senden';
        setToast(toastText);
        setTimeout(() => setToast(''), 3200);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [
    initialComposerFocus,
    initialSheet,
    initialAntwortenIntent,
    initialAntwortenOfferId,
    initialInboxItemId,
    initialMessageId,
    initialQuestionContext?.questionId,
    lead?.id,
    inbox,
  ]);

  useEffect(() => {
    if (!initialAntwortenOfferId || focusOfferAttachedRef.current) return;
    const focusOfferId = String(initialAntwortenOfferId);
    const track = listCustomerVehicleTracks(lead).find((entry) => (
      String(entry.id) === focusOfferId
      || entry.offerIds?.some((id) => String(id) === focusOfferId)
      || String(entry.vehicleOffer?.id || '') === focusOfferId
    ));
    const card = track
      ? trackToComposerCard(track)
      : (vehicleCards.find((c) => String(c.id) === focusOfferId) ?? null);
    if (!card) return;
    focusOfferAttachedRef.current = true;
    setFreshTrackId(String(track?.id || card.id));
    setWorkingContextItems((prev) => upsertWorkingContextItem(
      prev,
      buildOfferWorkingContextItem(card, lead),
    ));
  }, [initialAntwortenOfferId, lead, vehicleCards]);

  function openOffersBoard() {
    setMoreSheetOpen(false);
    setAngeboteFilter('all');
    setAkteTab(AKTE_TABS.angebote);
    openSheet(SHEETS.boardOffers);
  }

  function handleAkteTabSelect(tabId) {
    setAkteTab(tabId);
    if (tabId === AKTE_TABS.kunde) {
      openSheet(SHEETS.customer);
      return;
    }
    if (tabId === AKTE_TABS.angebote) {
      openOffersBoard();
      return;
    }
    if (tabId === AKTE_TABS.mehr) {
      setMoreSheetOpen(true);
      return;
    }
    // Chat = voller Verlauf; Clever = Composer + letzte Aktion (kein Feed)
    setMoreSheetOpen(false);
    if (activeSheet === SHEETS.boardOffers || activeSheet === SHEETS.customer) {
      closeSheet();
    }
    setCleverMode(true);
    setComposerFocusToken((n) => n + 1);
  }

  function openVehicleTrack(track) {
    if (!track) {
      openOffersBoard();
      return;
    }
    openOfferInWorkspace({
      ...track.config,
      id: track.id,
      vehicleOffer: track.vehicleOffer,
    });
  }

  /**
   * Klick auf Spur: Composer-Kontext + eine Kundennachricht zum Angebot vorbereiten
   * (wie „Fasse das Angebot als Mail zusammen“) – keine Navigation.
   */
  function selectVehicleTrack(track, { replace = false } = {}) {
    if (!track) return;
    const card = trackToComposerCard(track);
    if (!card) return;
    const item = buildOfferWorkingContextItem(card, lead);
    const nextItems = replace
      ? upsertWorkingContextItem(workingContextItems, item)
      : toggleOfferWorkingContext(workingContextItems, item);
    const selected = listOfferWorkingContexts(nextItems).some((o) => o.id === item.id);
    setWorkingContextItems(nextItems);
    if (!selected) {
      focusChatComposer({ clever: true });
      return;
    }
    focusChatComposer({
      clever: true,
      seedDraft: 'Schreib ihm eine kurze Zusammenfassung zu dem angehängten Angebot.',
      autoRun: true,
    });
  }

  function clearOfferSelection() {
    setWorkingContextItems((prev) => prev.filter((item) => item.kind !== WORKING_CONTEXT_KINDS.OFFER));
  }

  function handlePrepareMessageFromSelection() {
    const offers = listOfferWorkingContexts(workingContextItems);
    if (!offers.length) {
      focusChatComposer({ clever: true });
      return;
    }
    const labels = offers.map((o) => o.shortLabel || o.label).join(', ');
    focusChatComposer({
      clever: true,
      autoRun: true,
      seedDraft: offers.length > 1
        ? `Erkläre dem Kunden diese Angebote und bereite den Kundenlink vor: ${labels}.`
        : `Erkläre ihm das Angebot und schicke den Kundenlink per E-Mail: ${labels}.`,
    });
  }

  function handleCompareSelectedOffers() {
    const offers = listOfferWorkingContexts(workingContextItems);
    if (offers.length < 2) return;
    const labels = offers.map((o) => o.shortLabel || o.label).join(' vs. ');
    focusChatComposer({
      clever: true,
      autoRun: true,
      seedDraft: `Vergleiche kurz diese Angebote für den Kunden: ${labels}.`,
    });
  }

  function handleCreateCustomerOfferFromSelection() {
    const offers = listOfferWorkingContexts(workingContextItems);
    if (!offers.length) {
      handleSendCustomerSelection();
      return;
    }
    focusChatComposer({
      clever: true,
      autoRun: true,
      seedDraft: offers.length > 1
        ? `Erstelle ein Kundenangebot aus diesen Auswahl: ${offers.map((o) => o.shortLabel || o.label).join(', ')}.`
        : `Bereite den Kundenlink für ${offers[0].shortLabel || offers[0].label} vor.`,
    });
  }

  function applyOfferReferenceFromComposer(text) {
    const result = resolveOfferReferenceFromText(lead, text);
    if (result.status === 'resolved' && result.tracks.length) {
      let nextItems = workingContextItems.filter((item) => item.kind !== WORKING_CONTEXT_KINDS.OFFER);
      for (const track of result.tracks) {
        const card = trackToComposerCard(track);
        if (!card) continue;
        nextItems = upsertWorkingContextItem(
          nextItems,
          buildOfferWorkingContextItem(card, lead),
          { allowMultipleOffers: true },
        );
      }
      setWorkingContextItems(nextItems);
      return result;
    }
    if (result.status === 'ambiguous' && result.options.length) {
      setToast(result.question || 'Welches Angebot meinst du?');
      setTimeout(() => setToast(''), 4200);
      return result;
    }
    return result;
  }

  function openScenarioOfferSlot(slot, track) {
    if (!track) return;
    openOfferInWorkspace({
      ...track.config,
      id: track.id,
      vehicleOffer: slot?.offer ?? track.vehicleOffer,
      commercialScenarioId: slot?.scenarioId ?? null,
      monthlyRate: slot?.monthlyRate ?? track.monthlyRate,
      termMonths: slot?.scenario?.termMonths ?? track.termMonths,
      mileagePerYear: slot?.scenario?.annualMileage ?? track.annualMileage,
      downPayment: slot?.scenario?.downPayment ?? track.downPayment,
      paymentType: slot?.type ?? track.config?.paymentType,
    });
  }

  function handleSendBothScenarioOffers(track) {
    const result = sendBothScenarioOffers({
      lead,
      trackId: track?.id ?? null,
      createdByName: name?.trim() || 'Verkäufer',
      firstName: String(name || '').split(/\s+/)[0] || null,
    });
    if (!result.ok) {
      setToast(result.error === 'no_ready_offers'
        ? 'Beide Angebote müssen zuerst bereit sein.'
        : 'Dual-Versand fehlgeschlagen.');
      setTimeout(() => setToast(''), 3500);
      return;
    }
    onSave?.(buildSavePayload({
      vehicleOffers: result.lead.crm?.vehicleOffers,
      customerMessages: result.lead.crm?.customerMessages,
      customerMessageThreads: result.lead.crm?.customerMessageThreads,
    }), {
      historyText: `${result.itemCount} Angebote gesendet (Leasing + Finanzierung)`,
      addFollowupHistory: true,
    });
    setToast('Beide Angebote an Kunden gesendet');
    setTimeout(() => setToast(''), 3500);
    closeSheet();
  }

  function resumeVehicleTrack(track) {
    if (!track?.id) return;
    const nextLead = patchVehicleTrackOnLead(lead, track.id, {
      status: VEHICLE_TRACK_STATUS.OPEN,
      rejectionReason: null,
      rejectionReasonLabel: null,
    });
    onSave?.({
      ...buildSavePayload({
        vehicleConfigurations: nextLead.crm.vehicleConfigurations,
      }),
    }, { silent: true, addFollowupHistory: false });
  }

  function handleGoldenMomentPrimary(moment) {
    // Slice 18 / Phase 3: Nachfolge-CTA → Composer Propose (nicht Fahrzeugspur)
    if (
      moment?.recommendedAction === 'prepare_succession_offer'
      || moment?.type === 'contract_succession_follow_up'
    ) {
      focusChatComposer({
        seedDraft: 'Bereite ein Nachfolgeangebot vor.',
        autoRun: true,
      });
      return;
    }
    const track = vehicleTracks.find((t) => t.id === moment.vehicleTrackId);
    if (track?.config) {
      openVehicleTrack(track);
      return;
    }
    focusChatComposer({
      seedDraft: moment.recommendedAction === 'follow_up_favorite'
        ? 'Nachfassen zum Favoriten.'
        : '',
    });
  }

  function handleAkteNavSelect(tabId) {
    // Legacy: Tabs entfallen – alles läuft über Feed / Kundendaten / Mehr
    if (tabId === AKTE_TABS.mehr) {
      setMoreSheetOpen(true);
      return;
    }
    if (tabId === AKTE_TABS.angebote) {
      openOffersBoard();
      return;
    }
    if (tabId === AKTE_TABS.kunde) {
      openSheet(SHEETS.customer);
      return;
    }
    focusChatComposer({ clever: true });
  }

  function handleTischOpenOffer(item) {
    if (!item) {
      openOffersBoard();
      return;
    }
    if (item.type === 'selection_group') {
      openSelectionGroup(item.group);
      return;
    }
    navigateBoardOfferCard(item.card);
  }

  const activitiesLastSeenAt = crm.activitiesLastSeenAt ?? null;
  const activityDashboard = useMemo(
    () => getActivityDashboard(history, activitiesLastSeenAt),
    [history, activitiesLastSeenAt],
  );
  const activitiesCount = activityDashboard.newCustomerActivities || activityDashboard.total;
  const pipelineStatusLabel = getLeadStatusBadgeLabel(pipelineStatusId);

  const lastLoggedCleverActionRef = useRef(null);
  const syncedInsightsRef = useRef(new Set());
  const appliedReminderRef = useRef(null);

  function logCustomerActivity(activity) {
    if (!activity?.text) return;
    onAddHistory?.(activity.text, activity.type ?? 'customer_activity', {
      silent: true,
      ...(activity.meta ?? {}),
    });
  }

  function openActivitiesSheet() {
    if (inboxOpenCount > 0 && onOpenInbox) {
      onOpenInbox(lead);
      return;
    }
    openSheet(SHEETS.history);
    onSave?.(buildSavePayload({
      activitiesLastSeenAt: new Date().toISOString(),
    }), { silent: true, addFollowupHistory: false });
  }

  function handleQuestionPersonalReply(item) {
    const draft = item?.cleverAnswer ? String(item.cleverAnswer) : '';
    openCleverAntworten('answer_customer_question', draft || null);
  }

  useEffect(() => {
    if (!cleverRecommendation?.actionId || !lead?.id) return;
    const logKey = `${lead.id}:${cleverRecommendation.actionId}`;
    if (lastLoggedCleverActionRef.current === logKey) return;
    lastLoggedCleverActionRef.current = logKey;
    onAddHistory?.(cleverRecommendation.analyticsText, 'clever_action', { silent: true });
  }, [cleverRecommendation, lead?.id, onAddHistory]);

  useEffect(() => {
    if (!lead?.id) return;
    const pending = mergeInsightActivities(history, detectCleverInsights(history));
    for (const activity of pending) {
      const key = activity.meta?.insightText ?? activity.text;
      if (syncedInsightsRef.current.has(key)) continue;
      syncedInsightsRef.current.add(key);
      logCustomerActivity(activity);
    }
  }, [history, lead?.id]);

  const primaryVehicleCard = vehicleCards[0];
  const vehicleTitleForUnterlagen = primaryVehicleCard
    ? formatVehicleCardTitle(primaryVehicleCard)
    : headSubline;
  const vehicleConditionsForUnterlagen = primaryVehicleCard
    ? formatVehicleCardConditions(primaryVehicleCard)
    : '';

  const nextStepLabel = lead?.crm?.nextStepLabel
    ?? FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label
    ?? 'Morgen anrufen';

  const primaryOffer = resolvedOffers[0];
  const offerFeedback = primaryOffer ? getOfferMicroFeedback(primaryOffer.status) : null;

  function handleAddVehicle() {
    startProposalNavigateFlow({
      proposalIntent: PROPOSAL_INTENTS.VEHICLE,
      paymentType: wishPaymentType !== 'unknown' ? wishPaymentType : 'leasing',
    });
  }

  function persistLeadWishBeforeNavigate(paymentType = null) {
    if (paymentType && paymentType !== 'unknown') {
      setWishPaymentType(paymentType);
    }
    const payload = buildSavePayload();
    if (paymentType && paymentType !== 'unknown') {
      payload.paymentType = paymentType;
      payload.wish = {
        ...(payload.wish ?? {}),
        paymentType,
      };
    }
    onSave?.(payload, {
      silent: true,
      addFollowupHistory: false,
    });
  }

  function startProposalNavigateFlow({ proposalIntent, paymentType = null } = {}) {
    closeSheet();
    persistLeadWishBeforeNavigate(paymentType);
    if (onStartNewWish) {
      onStartNewWish(lead, { proposalIntent, paymentType });
      return;
    }
    onNewWish?.();
  }

  function handleAddProposalOption(optionId) {
    if (optionId === 'selection_group') {
      const groups = offerSelectionGroups.length
        ? offerSelectionGroups
        : resolvedSelectionGroups;
      if (groups.length > 0) {
        closeSheet();
        openSelectionGroup(groups[0]);
        return;
      }
      startProposalNavigateFlow({
        proposalIntent: PROPOSAL_INTENTS.SELECTION_GROUP,
        paymentType: wishPaymentType !== 'unknown' ? wishPaymentType : 'leasing',
      });
      return;
    }

    if (optionId === 'leasing' || optionId === 'financing') {
      const proposalIntent = optionId === 'financing'
        ? PROPOSAL_INTENTS.FINANCING
        : PROPOSAL_INTENTS.LEASING;
      startProposalNavigateFlow({ proposalIntent, paymentType: optionId });
      return;
    }

    if (optionId === 'cash') {
      startProposalNavigateFlow({
        proposalIntent: PROPOSAL_INTENTS.CASH,
        paymentType: 'cash',
      });
      return;
    }

    if (optionId === 'vehicle' || optionId === 'lease_finance') {
      startProposalNavigateFlow({ proposalIntent: PROPOSAL_INTENTS.VEHICLE });
    }
  }

  function handleLeaseFinanceOption(optionId) {
    const paymentType = resolveProposalPaymentType(optionId);
    const proposalIntent = optionId === 'financing'
      ? PROPOSAL_INTENTS.FINANCING
      : PROPOSAL_INTENTS.LEASING;
    startProposalNavigateFlow({ proposalIntent, paymentType });
  }

  function openSelectionGroup(group) {
    setSelectedSelectionGroup(group);
    openSheet(SHEETS.cleverAuswahl);
  }

  function handleCleverAuswahlBack() {
    setSelectedSelectionGroup(null);
    closeSheet();
  }

  function handleDuplicateSelectionVariant(group, variantSummary) {
    if (!group || !variantSummary) return;
    const storedGroups = offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups;
    const canonicalGroup = storedGroups.find((entry) => entry.id === group.id) ?? group;
    const fullVariant = resolveSelectionGroupVariant(canonicalGroup, variantSummary);
    if (!fullVariant) {
      setToast('Variante konnte nicht dupliziert werden.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    const nextGroup = cloneSelectionGroupVariant(canonicalGroup, fullVariant.id);
    const nextGroups = storedGroups.map((entry) => (
      entry.id === nextGroup.id ? nextGroup : entry
    ));
    persistOfferSelectionGroups(nextGroups, `Variante ${fullVariant.trimLabel ?? ''} dupliziert`.trim());
    setSelectedSelectionGroup(nextGroup);
    setToast('Variante dupliziert.');
    setTimeout(() => setToast(''), 3000);
  }

  function handleCleverAuswahlReview() {
    setToast('Bitte alle Varianten bearbeiten und Raten prüfen.');
    setTimeout(() => setToast(''), 4000);
  }

  function handleOpenPortalShare() {
    const portfolio = lead?.crm?.customerOfferPortfolio;
    const access = lead?.crm?.customerPortalAccess;
    if (!portfolio?.items?.length) {
      handleSendCustomerSelection();
      return;
    }
    setPortfolioShare({
      portfolio,
      itemCount: portfolio.items.length,
      portalAccess: access,
    });
    openSheet(SHEETS.portfolioShare);
  }

  async function handlePortalCopyLink(url) {
    const target = url ?? lead?.crm?.customerPortalAccess?.portfolioUrl;
    if (!target) return;
    const ok = await copyOfferLink(target);
    setToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    setTimeout(() => setToast(''), 3000);
  }

  function handlePortalCardReply({ inboxItemId = null } = {}) {
    const item = portalCustomerMessageItem;
    const resolvedInboxId = inboxItemId ?? item?.id ?? null;
    if (resolvedInboxId) setInboxItemIdForAntworten(resolvedInboxId);
    const question = String(item?.message ?? item?.title ?? '')
      .replace(/^[„"]|[“"]$/g, '')
      .trim();
    const seed = question
      ? `Schreib ihm zur Frage „${question.slice(0, 140)}“: `
      : 'Schreib ihm: ';
    focusChatComposer({ clever: true, seedDraft: seed });
    setToast('Antwort im Composer – tippen oder sprechen, dann senden');
    setTimeout(() => setToast(''), 3200);
  }

  function handleSendSpecialQuestionAnswer() {
    const answer = String(lead?.specialQuestionAnswer?.answerText ?? '').trim();
    const question = String(
      lead?.specialCustomerQuestion?.rawText
      || lead?.specialCustomerQuestion?.question
      || '',
    ).trim();
    const seed = answer
      || buildComposerReplySeed('answer_customer_question', { question });
    specialAnswerPendingSendRef.current = Boolean(answer);
    focusChatComposer({ clever: true, seedDraft: seed });
    setToast(answer
      ? 'Gespeicherte Antwort im Composer – prüfen und senden'
      : 'Antwort im Composer – tippen oder sprechen, dann senden');
    setTimeout(() => setToast(''), 3200);
  }

  function markSpecialQuestionAnswerSent() {
    const stored = lead?.specialQuestionAnswer;
    if (!stored?.answerText || stored.sentAt) return;
    onSave?.({
      specialQuestionAnswer: {
        ...stored,
        sentAt: new Date().toISOString(),
      },
      specialCustomerQuestion: {
        ...(lead?.specialCustomerQuestion ?? {}),
        status: 'answered_sent',
      },
      crm: {
        ...crm,
        nextStepId: null,
        nextStepLabel: null,
      },
    }, {
      historyText: 'Antwort an Kunden gesendet',
      historyType: 'note',
      addFollowupHistory: false,
      silent: true,
    });
  }

  function handleSendCustomerSelection() {
    if (!email?.trim()) {
      setToast('Bitte zuerst E-Mail-Adresse ergänzen.');
      setTimeout(() => setToast(''), 3500);
      openSheet(SHEETS.customer);
      return;
    }
    handlePrepareCustomerLink();
  }

  function handlePrepareCustomerLink() {
    if (!email?.trim()) {
      setToast('Bitte zuerst E-Mail-Adresse ergänzen.');
      setTimeout(() => setToast(''), 3500);
      openSheet(SHEETS.customer);
      return false;
    }

    const storedGroups = offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups;
    const sendableCards = filterSendableVehicleCards(vehicleCards, lead);
    const result = prepareCustomerOfferPortfolio({
      lead,
      offerSelectionGroups: storedGroups,
      vehicleCards: sendableCards,
      origin: typeof window !== 'undefined' ? window.location.origin : null,
    });

    if (!result.ok) {
      setToast('Keine versandbereiten Angebote – bitte zuerst Angebote im Angebotsrechner erstellen.');
      setTimeout(() => setToast(''), 4000);
      return false;
    }

    const envkvCheck = validatePortfolioEnVkvForSend(result.portfolio.items);
    if (!envkvCheck.ok) {
      const labels = envkvCheck.blockers.map((b) => b.label).join(', ');
      setToast(`${envkvCheck.message} (${labels})`);
      setTimeout(() => setToast(''), 6000);
      return false;
    }

    const portalPrepared = prepareCustomerPortalAccess(lead, {
      portfolioUrl: result.portfolio.url,
      email: email.trim(),
      accessToken: result.portfolio.token,
      advisor: {
        userId: lead.ownerId ?? null,
        name: lead.ownerName ?? null,
      },
    });

    if (!portalPrepared.ok) {
      setToast('Kundenlink konnte nicht vorbereitet werden.');
      setTimeout(() => setToast(''), 3500);
      return false;
    }

    const sanitized = sanitizeOfferSelectionGroups(result.offerSelectionGroups);
    setOfferSelectionGroups(sanitized);
    onSave?.(buildSavePayload({
      offerSelectionGroups: sanitized,
      customerOfferPortfolio: result.portfolio,
      customerPortalAccess: portalPrepared.access,
    }), {
      historyText: portalPrepared.historyText
        ?? `Kundenlink mit ${result.itemCount} Angebot${result.itemCount === 1 ? '' : 'en'} vorbereitet`,
      addFollowupHistory: true,
    });

    setPortfolioShare({
      portfolio: result.portfolio,
      itemCount: result.itemCount,
      portalAccess: portalPrepared.access,
    });
    setSelectedSelectionGroup(null);
    openSheet(SHEETS.portfolioShare);
    return true;
  }

  function handlePortfolioShareSent(payload) {
    if (!portfolioShare?.portfolio) return;
    const via = typeof payload === 'string' ? payload : payload?.via;
    const mailResult = typeof payload === 'object' ? payload?.mailResult : null;

    const baseCrm = {
      ...(lead?.crm ?? {}),
      customerOfferPortfolio: portfolioShare.portfolio,
      customerPortalAccess: portfolioShare.portalAccess ?? lead?.crm?.customerPortalAccess ?? null,
    };
    const baseLead = { ...lead, crm: baseCrm };

    if (via === 'copy') {
      const copied = recordCustomerPortalAccessLinkCopied(baseLead);
      const withCards = appendOfferCardsToThread({
        lead: {
          ...baseLead,
          crm: {
            ...baseCrm,
            customerPortalAccess: copied.access,
          },
        },
        items: portfolioShare.portfolio.items ?? [],
        firstName: String(name || '').split(/\s+/)[0] || null,
        createdByName: name?.trim() || 'Verkäufer',
      });
      setPortfolioShare({
        ...portfolioShare,
        portalAccess: copied.access,
      });
      onSave?.(buildSavePayload({
        customerPortalAccess: copied.access,
        customerMessages: withCards.ok
          ? withCards.lead.crm?.customerMessages
          : undefined,
        customerMessageThreads: withCards.ok
          ? withCards.lead.crm?.customerMessageThreads
          : undefined,
      }), {
        historyText: copied.historyText ?? 'Kundenlink kopiert',
        addFollowupHistory: true,
      });
      return;
    }

    if (via === 'email' && mailResult?.ok === false) {
      let nextPortfolio = applyPortfolioMailDelivery(portfolioShare.portfolio, mailResult);
      setPortfolioShare({
        ...portfolioShare,
        portfolio: nextPortfolio,
      });
      onSave?.(buildSavePayload({
        customerOfferPortfolio: nextPortfolio,
      }), {
        historyText: `Kundenlink E-Mail fehlgeschlagen: ${mailResult?.error ?? 'Unbekannt'}`,
        addFollowupHistory: true,
      });
      return;
    }

    let nextPortfolio = markPortfolioSent(portfolioShare.portfolio);
    if (mailResult) {
      nextPortfolio = applyPortfolioMailDelivery(nextPortfolio, mailResult);
    }
    const sentAccess = markCustomerPortalAccessSent({
      ...baseLead,
      crm: {
        ...baseCrm,
        customerOfferPortfolio: nextPortfolio,
      },
    }, { via: via === 'mailto' ? 'mailto' : 'email' });

    const withCards = appendOfferCardsToThread({
      lead: {
        ...baseLead,
        crm: {
          ...baseCrm,
          customerOfferPortfolio: nextPortfolio,
          customerPortalAccess: sentAccess.access,
        },
      },
      items: nextPortfolio.items ?? [],
      firstName: String(name || '').split(/\s+/)[0] || null,
      createdByName: name?.trim() || 'Verkäufer',
    });

    setPortfolioShare({
      ...portfolioShare,
      portfolio: nextPortfolio,
      portalAccess: sentAccess.access,
    });

    onSave?.(buildSavePayload({
      customerOfferPortfolio: nextPortfolio,
      customerPortalAccess: sentAccess.access,
      customerMessages: withCards.ok
        ? withCards.lead.crm?.customerMessages
        : undefined,
      customerMessageThreads: withCards.ok
        ? withCards.lead.crm?.customerMessageThreads
        : undefined,
    }), {
      historyText: sentAccess.historyText ?? (
        via === 'email'
          ? 'Kundenlink per E-Mail versendet'
          : 'Kundenlink per Mail-App vorbereitet'
      ),
      addFollowupHistory: true,
    });
    if (inboxItemIdForAntworten) handleInboxItemHandled(inboxItemIdForAntworten);
  }

  function handleEditSelectionVariant(group, variantSummary) {
    if (!group || !variantSummary) {
      setToast('Variante konnte nicht geladen werden.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    const storedGroups = offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups;
    const canonicalGroup = storedGroups.find((entry) => entry.id === group.id) ?? group;
    const fullVariant = resolveSelectionGroupVariant(canonicalGroup, variantSummary);
    if (!fullVariant) {
      setToast('Variante konnte nicht geladen werden – bitte Clever Auswahl erneut öffnen.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    logCustomerActivity(buildVariantViewedActivity({
      modelLabel: canonicalGroup.modelLabel,
      trimLabel: fullVariant.trimLabel ?? variantSummary.trimLabel ?? 'Ausstattung',
    }));
    setVariantConfigureContext({ group: canonicalGroup, variant: fullVariant });
    setActiveSheet(null);
    setSelectedSelectionGroup(null);
  }

  function handleOpenVariantOffer(group, variantSummary) {
    if (!group || !variantSummary) {
      setToast('Variante konnte nicht geladen werden.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    const storedGroups = offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups;
    const canonicalGroup = storedGroups.find((entry) => entry.id === group.id) ?? group;
    const fullVariant = resolveSelectionGroupVariant(canonicalGroup, variantSummary);
    if (!fullVariant) {
      setToast('Variante konnte nicht geladen werden – bitte Clever Auswahl erneut öffnen.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    setVariantOfferContext({ group: canonicalGroup, variant: fullVariant });
    setActiveSheet(null);
    setSelectedSelectionGroup(null);
  }

  function handleVariantOfferBack() {
    const group = variantOfferContext?.group ?? null;
    setVariantOfferContext(null);
    if (group) {
      const refreshed = (offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups)
        .find((entry) => entry.id === group.id) ?? group;
      setSelectedSelectionGroup(refreshed);
      openSheet(SHEETS.cleverAuswahl);
    }
  }

  async function handleVariantOfferUploadPdf(variant, file) {
    const ctx = variantOfferContext;
    if (!ctx?.group || !variant) return null;
    const nextVariant = await attachPdfToSelectionVariant(variant, file);
    const nextGroups = updateSelectionGroupVariant(
      offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups,
      ctx.group.id,
      nextVariant.id,
      nextVariant,
    );
    const summary = buildVariantOfferSummaryLine(ctx.group, nextVariant);
    persistOfferSelectionGroups(nextGroups, `Angebot-PDF hinterlegt: ${summary}`);
    const updatedGroup = nextGroups.find((g) => g.id === ctx.group.id) ?? ctx.group;
    setVariantOfferContext({ group: updatedGroup, variant: nextVariant });
    return nextVariant;
  }

  function handleVariantOfferDeletePdf(variant) {
    const ctx = variantOfferContext;
    if (!ctx?.group || !variant) return null;
    const nextVariant = removePdfFromSelectionVariant(variant);
    const nextGroups = updateSelectionGroupVariant(
      offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups,
      ctx.group.id,
      nextVariant.id,
      nextVariant,
    );
    persistOfferSelectionGroups(nextGroups, `Angebot-PDF entfernt: ${buildVariantOfferSummaryLine(ctx.group, nextVariant)}`);
    const updatedGroup = nextGroups.find((g) => g.id === ctx.group.id) ?? ctx.group;
    setVariantOfferContext({ group: updatedGroup, variant: nextVariant });
    return nextVariant;
  }

  function handleVariantOfferEditConfiguration(group, variant) {
    setVariantOfferContext(null);
    handleEditSelectionVariant(group, variant);
  }

  function handleVariantConfigureBack() {
    const group = variantConfigureContext?.group ?? null;
    setVariantConfigureContext(null);
    if (group) {
      setSelectedSelectionGroup(group);
      openSheet(SHEETS.cleverAuswahl);
    }
  }

  function persistOfferSelectionGroups(nextGroups, historyText) {
    const sanitized = sanitizeOfferSelectionGroups(nextGroups);
    setOfferSelectionGroups(sanitized);
    onSave?.(buildSavePayload({ offerSelectionGroups: sanitized }), {
      historyText,
      addFollowupHistory: Boolean(historyText),
    });
  }

  function handleVariantConfigureSave(group, nextVariant) {
    const nextGroups = updateSelectionGroupVariant(
      offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups,
      group.id,
      nextVariant.id,
      nextVariant,
    );
    const updatedGroup = nextGroups.find((g) => g.id === group.id) ?? group;
    persistOfferSelectionGroups(
      nextGroups,
      `Variante ${nextVariant.trimLabel ?? ''} konfiguriert und gespeichert`.trim(),
    );
    setVariantConfigureContext(null);
    setSelectedSelectionGroup(updatedGroup);
    setToast('Variante gespeichert.');
    setTimeout(() => setToast(''), 3000);
    openSheet(SHEETS.cleverAuswahl);
  }

  function handleVariantConfigureDuplicate(nextGroup) {
    const sanitized = sanitizeOfferSelectionGroups([
      ...(offerSelectionGroups.length ? offerSelectionGroups : resolvedSelectionGroups).filter((g) => g.id !== nextGroup.id),
      nextGroup,
    ]);
    persistOfferSelectionGroups(sanitized, 'Weitere Variante aus Konfigurator dupliziert');
    setVariantConfigureContext(null);
    setSelectedSelectionGroup(nextGroup);
    setToast('Variante dupliziert.');
    setTimeout(() => setToast(''), 3000);
    openSheet(SHEETS.cleverAuswahl);
  }

  function openOfferInWorkspace(card) {
    if (!card) return;
    setMoreSheetOpen(false);
    setActiveSheet(null);
    setSelectedVehicleCard(null);
    setOfferWorkspaceCard(card);
    setWorkingContextItems((prev) => upsertWorkingContextItem(
      prev,
      buildOfferWorkingContextItem(card, lead),
    ));
    focusChatComposer({ clever: true });
  }

  /** Nur Context-Pill – wie Cursor-Anhang, ohne Workspace zu öffnen */
  function attachOfferToComposer(card, { quiet = false } = {}) {
    if (!card) return;
    setActiveSheet(null);
    setMoreSheetOpen(false);
    setWorkingContextItems((prev) => upsertWorkingContextItem(
      prev,
      buildOfferWorkingContextItem(card, lead),
    ));
    focusChatComposer({ clever: true });
    if (!quiet) {
      setToast('Ausgewählt – Clever kennt den Kontext');
      setTimeout(() => setToast(''), 2800);
    }
  }

  function attachDocumentToComposer(doc) {
    if (!doc) return;
    setActiveSheet(null);
    setMoreSheetOpen(false);
    setWorkingContextItems((prev) => upsertWorkingContextItem(
      prev,
      buildDocumentWorkingContextItem(doc),
    ));
    focusChatComposer({ clever: true });
    setToast('Dokument angehängt');
    setTimeout(() => setToast(''), 2500);
  }

  function openAttachOfferPicker() {
    setMoreSheetOpen(false);
    openSheet(SHEETS.attachOffer);
  }

  function openAttachDocumentPicker() {
    setMoreSheetOpen(false);
    openSheet(SHEETS.attachDocument);
  }

  function openAkteSearch() {
    setMoreSheetOpen(false);
    setAkteSearchQuery('');
    openSheet(SHEETS.akteSearch);
  }

  function focusFeedMessage(messageId) {
    if (!messageId) return;
    // Workspace schließen → Feed sichtbar (Mobile Replace + Desktop klarer Fokus)
    setOfferWorkspaceCard(null);
    setAkteTab(AKTE_TABS.chat);
    setFeedFocusMessageId(String(messageId));
    setFeedFocusToken((token) => token + 1);
  }

  function handleAkteSearchHit(hit) {
    if (!hit) return;
    closeSheet();
    // Nachrichten zuerst – relatedOfferId darf den Fokus nicht zum Angebot umbiegen
    if (hit.kind === 'message' && hit.id) {
      focusFeedMessage(hit.id);
      return;
    }
    if (hit.kind === 'offer' || hit.offerId) {
      const offerId = hit.offerId || hit.id;
      const card = (vehicleCards ?? []).find(
        (c) => c.id === offerId || c.configurationId === offerId,
      );
      if (card) {
        openOfferInWorkspace(card);
        return;
      }
    }
    focusChatComposer({ clever: true });
    setToast(hit.snippet
      ? `Gefunden: ${String(hit.snippet).slice(0, 72)}`
      : 'Treffer im Verlauf');
    setTimeout(() => setToast(''), 3200);
  }

  function closeOfferWorkspace() {
    setOfferWorkspaceCard(null);
  }

  function handleRemoveWorkingContext(itemId) {
    setWorkingContextItems((prev) => removeWorkingContextItem(prev, itemId));
    if (offerWorkspaceCard) {
      const id = `offer:${offerWorkspaceCard.id || offerWorkspaceCard.configurationId || ''}`;
      if (itemId === id) setOfferWorkspaceCard(null);
    }
  }

  function openBoardOfferFromCard(card) {
    // Bleibt in der Akte: Workspace + Context-Pill, kein Phasen-Wechsel
    openOfferInWorkspace(card);
  }

  function handleOpenOfferFromFeed(payload = {}) {
    const offerId = payload?.offerId
      || payload?.vehicleCardId
      || payload?.configurationId
      || payload?.id
      || null;
    if (offerId) {
      const card = (vehicleCards ?? []).find(
        (c) => c.id === offerId || c.configurationId === offerId,
      );
      if (card) {
        openOfferInWorkspace(card);
        return;
      }
    }
    openOffersBoard();
  }

  function navigateBoardOfferCard(card) {
    const primaryAction = resolveBoardOfferPrimaryAction(card, lead);
    handleBoardCardAction(primaryAction, card);
  }

  function handleBoardCardAction(action, card) {
    const handler = action?.handlerType ?? action?.id;
    if (handler === 'edit_offer') {
      if (onOpenOfferEdit) {
        onOpenOfferEdit(card);
        return;
      }
      openBoardOfferEntry(card, lead, {
        onOpenProposal: onOpenOfferProposal,
        onOpenCalculator: onOpenOfferEdit,
      });
      return;
    }
    if (handler === 'create_offer' || handler === 'configure_conditions') {
      openOfferInWorkspace(card);
      return;
    }
    if (handler === 'view_proposal') {
      openOfferInWorkspace(card);
      return;
    }
    if (handler === 'duplicate_offer') {
      handleDuplicateVehicleCard(card);
      return;
    }
    if (handler === 'remove_offer') {
      handleRemoveBoardCard(card);
      return;
    }
    if (handler === 'send_offer') {
      handleSendCustomerSelection();
      return;
    }
    if (handler === 'answer_question') {
      const interaction = getCustomerOfferInteraction(lead, card.id);
      const openQuestion = (interaction?.customerQuestions ?? []).find((q) => q.status === 'open');
      if (openQuestion) {
        openOfferQuestionAnswer({ offerId: card.id, questionId: openQuestion.id });
      } else {
        openCleverAntworten('answer_customer_question');
      }
    }
  }

  function handleDuplicateVehicleCard(card) {
    const configs = lead?.crm?.vehicleConfigurations ?? [];
    const config = configs.find((entry) => entry.id === card.configurationId || entry.id === card.id);
    if (!config) {
      setToast('Bitte zuerst im Angebotsrechner ein Angebot speichern.');
      setTimeout(() => setToast(''), 3500);
      return;
    }
    const newId = `vc-${Date.now()}`;
    const duplicated = duplicateVehicleConfiguration(config, { newId });
    const nextConfigs = [...configs, duplicated];
    const nextReserved = [
      ...reservedModels,
      {
        id: newId,
        name: `${config.model ?? card.modelName}`.trim(),
        modelKey: config.modelKey ?? card.modelKey,
        trimLabel: config.trimLabel ?? card.trimLabel,
        configurationId: newId,
        isPrimary: false,
      },
    ];
    onSave?.(buildSavePayload({
      vehicleConfigurations: nextConfigs,
      reservedModels: nextReserved,
    }), {
      historyText: `Angebot dupliziert: ${formatVehicleCardTitle(card)}`,
      addFollowupHistory: true,
    });
    setToast('Angebot dupliziert.');
    setTimeout(() => setToast(''), 3000);
  }

  function handleRemoveBoardCard(card) {
    const configs = (lead?.crm?.vehicleConfigurations ?? []).filter(
      (entry) => entry.id !== card.id && entry.id !== card.configurationId,
    );
    const nextReserved = reservedModels.filter(
      (entry) => entry.id !== card.id && entry.configurationId !== card.id,
    );
    const vehicleOffers = { ...(lead?.crm?.vehicleOffers ?? {}) };
    delete vehicleOffers[card.id];
    setReservedModels(nextReserved);
    onSave?.(buildSavePayload({
      vehicleConfigurations: configs,
      reservedModels: nextReserved,
      vehicleOffers,
    }), {
      historyText: `Angebot entfernt: ${formatVehicleCardTitle(card)}`,
      addFollowupHistory: true,
    });
    setToast('Angebot vom Tisch entfernt.');
    setTimeout(() => setToast(''), 3000);
  }

  function handleVehicleOffer(card) {
    const primaryAction = resolveBoardOfferPrimaryAction(card, lead);
    if (primaryAction.handlerType === 'answer_question') {
      handleBoardCardAction(primaryAction, card);
      return;
    }
    openBoardOfferFromCard(card);
  }

  function toggleVehicleFavorite(card) {
    if (card.source !== 'reserved') return;
    const nextFavorite = !card.isFavorite;
    const next = reservedModels.map((m) => (
      m.id === card.id ? { ...m, isFavorite: nextFavorite } : m
    ));
    setReservedModels(next);
    setSelectedVehicleCard({ ...card, isFavorite: nextFavorite });
    if (nextFavorite) {
      logCustomerActivity(buildFavoriteActivity({
        modelLabel: card.modelName ?? card.model,
        trimLabel: card.trimLabel,
      }));
    }
    onSave?.(buildSavePayload({ reservedModels: next }), {
      historyText: card.isFavorite ? 'Favorit entfernt' : 'Als Favorit markiert',
      addFollowupHistory: false,
    });
  }

  function removeVehicleCard(card) {
    if (card.source === 'reserved') {
      const model = reservedModels.find((m) => m.id === card.id);
      if (model) removeReservedModel(model);
    }
    closeSheet();
    setSelectedVehicleCard(null);
  }

  function closeSheet() {
    if (activeSheet === SHEETS.boardOffers && akteTab === AKTE_TABS.angebote) {
      setAkteTab(AKTE_TABS.clever);
    }
    setActiveSheet(null);
    if (activeSheet === SHEETS.questionAnswer) {
      setQuestionContext(null);
      onQuestionAnswerContextConsumed?.();
    }
    if (activeSheet === SHEETS.vehicle) {
      setSelectedVehicleCard(null);
    }
    if (activeSheet === SHEETS.kundenhelfer) {
      setKundenhelferInitialCategory(null);
    }
    if (activeSheet === SHEETS.cleverAuswahl) {
      setSelectedSelectionGroup(null);
    }
    if (activeSheet === SHEETS.wishConditions) {
      setWishConditionsFocusField(null);
    }
  }

  function openWishConditionsSheet(focusField = null) {
    setWishConditionsFocusField(focusField);
    openSheet(SHEETS.wishConditions);
  }

  function openKundenhelferSheet(categoryId = null) {
    setKundenhelferInitialCategory(categoryId);
    openSheet(SHEETS.kundenhelfer);
  }

  /** Notizzettel: Konditionen schnell ändern, Wünsche → Kundenhelfer */
  function handleNotepadChipClick(chip) {
    if (chip?.kind === 'condition' || chip?.field) {
      openWishConditionsSheet(chip.field ?? null);
      return;
    }
    openKundenhelferSheet();
  }

  const snapshotChipEditorValues = useMemo(() => {
    const profile = getNeedProfileFromLead(lead) ?? {};
    const tradeIn = getTradeIn(lead);
    const hasExisting = Boolean(
      tradeIn.vehicle?.trim()
      || lead?.crm?.existingVehicle?.label
      || lead?.crm?.existingVehicle?.make,
    );
    const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
    const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE) || tracks[0];
    return {
      desiredRate: wishDesiredRate || '',
      desiredRateMode: lead?.wish?.desiredRateMode || profile?.budget?.rateMode || SNAPSHOT_RATE_MODES.APPROX,
      children: profile.children ?? 0,
      dog: Boolean(profile.dog),
      termMonths: wishTermMonths || '',
      mileagePerYear: wishMileage || '',
      preferredColor: favorite?.config?.vehicleTrack?.preferredColor || '',
      delivery: wishDelivery || '',
      hasExistingVehicle: hasExisting,
      existingVehicle: tradeIn.vehicle
        || lead?.crm?.existingVehicle?.label
        || [lead?.crm?.existingVehicle?.make, lead?.crm?.existingVehicle?.model].filter(Boolean).join(' ')
        || '',
      paymentType: wishPaymentType || 'leasing',
      downPayment: wishDownPayment || '',
    };
  }, [
    lead,
    wishDesiredRate,
    wishTermMonths,
    wishMileage,
    wishDelivery,
    wishPaymentType,
    wishDownPayment,
  ]);

  /** Kundenbild-Chip → feld-spezifischer Mini-Editor (kein generisches Offen-Sheet). */
  function handleKundenbildFactTap(fact) {
    const mini = String(fact?.miniEditor ?? '').trim();
    if (mini && Object.values(SNAPSHOT_MINI_EDITOR).includes(mini)) {
      setSnapshotChipEditor({ key: mini, factId: fact?.id || null });
      return;
    }
    const key = String(fact?.editKey ?? '').trim();
    if (!key) return;
    if (key === 'desiredRate' || key === 'downPayment' || key === 'paymentType'
      || key === 'termMonths' || key === 'mileagePerYear' || key === 'delivery'
      || key === 'leasingEndDate') {
      const editorMap = {
        desiredRate: SNAPSHOT_MINI_EDITOR.DESIRED_RATE,
        downPayment: SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT,
        paymentType: SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE,
        termMonths: SNAPSHOT_MINI_EDITOR.TERM_MONTHS,
        mileagePerYear: SNAPSHOT_MINI_EDITOR.MILEAGE,
        delivery: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
        leasingEndDate: SNAPSHOT_MINI_EDITOR.DESIRED_RATE,
      };
      setSnapshotChipEditor({ key: editorMap[key], factId: fact?.id || null });
      return;
    }
    if (key === 'children' || key === 'dog') {
      setSnapshotChipEditor({
        key: key === 'dog' ? SNAPSHOT_MINI_EDITOR.DOG : SNAPSHOT_MINI_EDITOR.CHILDREN,
        factId: fact?.id || null,
      });
      return;
    }
    if (key === 'tradeIn') {
      setSnapshotChipEditor({ key: SNAPSHOT_MINI_EDITOR.TRADE_IN, factId: fact?.id || null });
      return;
    }
    if (key === 'vehicleTrack') {
      setSnapshotChipEditor({ key: SNAPSHOT_MINI_EDITOR.COLOR, factId: fact?.id || null });
      return;
    }
    openKundenhelferSheet();
  }

  function applySnapshotChipEdit(editorKey, draft = {}) {
    const profile = { ...(getNeedProfileFromLead(lead) || {}) };
    let nextLead = lead;
    let historyText = 'Kundenbild aktualisiert';

    if (editorKey === SNAPSHOT_MINI_EDITOR.DESIRED_RATE) {
      const rate = draft.desiredRate !== '' && draft.desiredRate != null
        ? Number(draft.desiredRate)
        : null;
      const mode = draft.desiredRateMode || SNAPSHOT_RATE_MODES.APPROX;
      setWishDesiredRate(rate != null && Number.isFinite(rate) ? String(rate) : '');
      profile.budget = {
        ...(profile.budget ?? {}),
        maxMonthlyRate: rate != null && Number.isFinite(rate) ? rate : null,
        rateMode: mode,
      };
      nextLead = mergeNeedProfileIntoLead(lead, profile);
      nextLead = {
        ...nextLead,
        desiredRate: rate != null && Number.isFinite(rate) ? rate : null,
        wish: {
          ...(nextLead.wish ?? {}),
          desiredRate: rate != null && Number.isFinite(rate) ? rate : null,
          desiredRateMode: mode,
        },
      };
      historyText = 'Wunschrate aktualisiert';
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.CHILDREN) {
      profile.children = Math.max(0, Number(draft.children) || 0);
      if (profile.children > 0 && !profile.priorities?.includes('family')) {
        profile.priorities = [...(profile.priorities ?? []), 'family'];
      }
      nextLead = mergeNeedProfileIntoLead(lead, profile);
      historyText = 'Kinder aktualisiert';
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.DOG) {
      profile.dog = Boolean(draft.dog);
      nextLead = mergeNeedProfileIntoLead(lead, profile);
      historyText = 'Hund aktualisiert';
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.TERM_MONTHS) {
      applyWishConditions({ termMonths: draft.termMonths });
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.MILEAGE) {
      applyWishConditions({ mileagePerYear: draft.mileagePerYear });
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE) {
      applyWishConditions({ paymentType: draft.paymentType });
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT) {
      applyWishConditions({ downPayment: draft.downPayment });
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY) {
      const delivery = draft.delivery === 'wichtig' ? 'wichtig' : (draft.delivery ?? '');
      applyWishConditions({ delivery });
      if (delivery === 'wichtig') {
        const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
        const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE) || tracks[0];
        if (favorite?.id) {
          nextLead = patchVehicleTrackOnLead(lead, favorite.id, { deliveryTimeImportance: 'high' });
          onSave?.(buildSavePayload({
            vehicleConfigurations: nextLead.crm?.vehicleConfigurations,
            needProfile: nextLead.crm?.needProfile,
          }), { historyText: 'Lieferzeit-Priorität gesetzt', addFollowupHistory: false });
        }
      }
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.COLOR) {
      const color = String(draft.preferredColor ?? '').trim();
      const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
      const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE) || tracks[0];
      if (favorite?.id && color) {
        nextLead = patchVehicleTrackOnLead(lead, favorite.id, { preferredColor: color });
        onSave?.(buildSavePayload({
          vehicleConfigurations: nextLead.crm?.vehicleConfigurations,
        }), { historyText: 'Farbe aktualisiert', addFollowupHistory: false });
        setSnapshotHighlightLabels([color]);
        window.setTimeout(() => setSnapshotHighlightLabels([]), 2200);
      }
      setSnapshotChipEditor(null);
      return;
    } else if (editorKey === SNAPSHOT_MINI_EDITOR.TRADE_IN) {
      if (!draft.hasExistingVehicle) {
        const cleared = patchTradeIn(getTradeIn(lead), { vehicle: '', datValue: null });
        setTradeInData(cleared);
        onSave?.(buildSavePayload({
          tradeIn: cleared,
          existingVehicle: null,
        }), { historyText: 'Bestandsfahrzeug entfernt', addFollowupHistory: false });
      } else {
        const vehicle = String(draft.existingVehicle ?? '').trim();
        const nextTrade = patchTradeIn(getTradeIn(lead), { vehicle });
        setTradeInData(nextTrade);
        onSave?.(buildSavePayload({
          tradeIn: nextTrade,
          existingVehicle: vehicle
            ? { label: vehicle, tradeInCandidate: true }
            : lead?.crm?.existingVehicle,
        }), { historyText: 'Bestandsfahrzeug aktualisiert', addFollowupHistory: false });
      }
      setSnapshotChipEditor(null);
      return;
    } else {
      setSnapshotChipEditor(null);
      return;
    }

    onSave?.({
      ...buildSavePayload({
        needProfile: nextLead.crm?.needProfile,
      }),
      desiredRate: nextLead.desiredRate,
      wish: nextLead.wish,
    }, { historyText, addFollowupHistory: false });
    setSnapshotChipEditor(null);
  }

  function openSheet(id) {
    setActiveSheet(id);
  }

  function openCleverAntworten(presetType = null, draft = null) {
    const seed = buildComposerReplySeed(presetType, { draft });
    focusChatComposer({ clever: true, seedDraft: seed });
    setToast('Antwort im Composer – tippen oder sprechen, dann senden');
    setTimeout(() => setToast(''), 3200);
  }

  function handleSellerAssistSendMessage({ body } = {}) {
    const text = String(body ?? '').trim();
    if (!text) return;
    handleSendCleverMessage({ text });
  }

  function handleSellerAssistSendWorkspacePackage({ body, actions } = {}) {
    const result = sendSellerWorkspacePackage({
      lead,
      body,
      actions,
      createdByName: name?.trim() || 'Verkäufer',
    });
    if (!result.ok) {
      setToast('Paket konnte nicht gesendet werden.');
      setTimeout(() => setToast(''), 3500);
      return;
    }
    onSave?.({
      ...buildSavePayload({
        customerMessages: result.lead.crm?.customerMessages,
        customerMessageThreads: result.lead.crm?.customerMessageThreads,
        cleverUnterlagen: result.lead.crm?.cleverUnterlagen,
      }),
      history: result.lead.history,
    }, {
      silent: true,
      addFollowupHistory: false,
    });
    setToast('Nachricht + Aktionen im Arbeitsraum gesendet');
    setTimeout(() => setToast(''), 3500);
  }

  function handleSellerAssistWhatsApp(body) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) {
      setToast('Telefonnummer fehlt');
      setTimeout(() => setToast(''), 2800);
      return;
    }
    const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
    window.open(
      `https://wa.me/${normalized}?text=${encodeURIComponent(String(body ?? ''))}`,
      '_blank',
      'noopener',
    );
  }

  function handleSellerAssistEmail(body) {
    if (!email?.trim()) {
      setToast('E-Mail fehlt');
      setTimeout(() => setToast(''), 2800);
      return;
    }
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?body=${encodeURIComponent(String(body ?? ''))}`;
  }

  function handleSellerAssistEditMessage(body) {
    openCleverAntworten('frei', String(body ?? ''));
  }

  function handleSellerAssistPrepareOffer(result) {
    const magic = result?.magic ?? null;
    const handoffLead = result?.lead ?? lead;
    if (magic) {
      onPrepareOffer?.(handoffLead, { magicPreparation: magic });
      setToast('Angebotsskizze bereit');
      setTimeout(() => setToast(''), 2800);
      return;
    }
    openOffersBoard();
  }

  function handleSellerAssistSaveNote(text) {
    handleNotepadCaptureCommit({
      text,
      labels: null,
      context: 'voice_note',
      attachment: null,
    });
  }

  function handleSellerAssistCallback(text) {
    onAddHistory?.(
      `Rückruf vorgemerkt: ${String(text ?? '').slice(0, 120)}`,
      'note',
      { silent: false },
    );
    setToast('Rückruf vorgemerkt');
    setTimeout(() => setToast(''), 2800);
  }

  function handleInboxItemHandled(inboxItemId) {
    if (!inboxItemId) return;
    markInboxItemDone(inboxItemId);
    inbox?.refresh?.();
    setInboxItemIdForAntworten(null);
    setInboxItemIdForSelfDisclosure(null);
  }

  function openSelfDisclosureReview(inboxItemId = null) {
    if (inboxItemId) setInboxItemIdForSelfDisclosure(inboxItemId);
    openSheet(SHEETS.selfDisclosureReview);
  }

  function handlePrepareCorrectionMessage(draft) {
    if (!draft) return;
    openCleverAntworten('free_reply', draft);
    setToast('Korrekturtext im Composer vorbereitet.');
    setTimeout(() => setToast(''), 3500);
  }

  function openOfferQuestionAnswer({ offerId, questionId, inboxItemId = null }) {
    const ctx = { offerId, questionId, inboxItemId };
    setQuestionContext(ctx);
    openSheet(SHEETS.questionAnswer);
    onOpenOfferQuestionAnswer?.(ctx);
  }

  function handleSaveOfferQuestionAnswer({ answerText }) {
    if (!questionContext?.offerId || !questionContext?.questionId) return;

    const result = applyCustomerOfferQuestionAnswer({
      lead,
      offerId: questionContext.offerId,
      questionId: questionContext.questionId,
      answerText,
    });
    if (!result.ok) {
      setToast('Antwort konnte nicht gespeichert werden.');
      setTimeout(() => setToast(''), 3500);
      return;
    }

    onSave?.(result.leadPatch, {
      historyText: result.historyText,
      historyType: 'note',
      addFollowupHistory: false,
    });

    markInboxDoneForQuestion({
      inboxItemId: questionContext.inboxItemId,
      leadId: lead?.id,
      questionId: questionContext.questionId,
    });
    inbox?.refresh?.();

    closeSheet();
    setToast('Antwort gespeichert');
    setTimeout(() => setToast(''), 3500);
  }

  function handleMarkOfferQuestionDoneOnly() {
    markInboxDoneForQuestion({
      inboxItemId: questionContext?.inboxItemId,
      leadId: lead?.id,
      questionId: questionContext?.questionId,
    });
    inbox?.refresh?.();
    closeSheet();
    setToast('Im Clever Eingang als erledigt markiert');
    setTimeout(() => setToast(''), 3500);
  }

  function handleCleverBeratungPrepareOffer() {
    if (onPrepareOfferFromClever) {
      onPrepareOfferFromClever();
      return;
    }
    const rec = cleverBeratungView?.recommendation;
    if (rec?.modelKey) {
      onPrepareOffer?.({
        id: rec.modelKey,
        modelKey: rec.modelKey,
        name: rec.vehicleTitle ?? `Kia ${rec.modelLabel ?? ''}`.trim(),
        trimLabel: rec.trimLabel ?? undefined,
      });
      return;
    }
    onPrepareOffer?.();
  }

  function handleCleverBeratungChangeRecommendation() {
    if (reservedModels.length > 0) {
      openSheet(SHEETS.models);
      return;
    }
    if (onReturnToReview) {
      onReturnToReview();
      return;
    }
    handleAddVehicle();
  }

  function handleApplyShowroomCapture() {
    const result = applyShowroomCaptureToLead(lead);
    if (!result.ok) {
      setToast(result.message ?? 'Übernahme fehlgeschlagen.');
      setTimeout(() => setToast(''), 3500);
      return;
    }
    onSave?.(result.leadPatch, {
      historyText: 'Showroom Schnellaufnahme übernommen',
      historyType: 'note',
      addFollowupHistory: false,
    });
    setToast('Schnellaufnahme übernommen');
    setTimeout(() => setToast(''), 3500);
  }

  function handleEditShowroomCapture() {
    if (!lead?.id) return;
    navigate(`/verkaufsassistent?view=showroom&leadId=${encodeURIComponent(lead.id)}`, {
      state: {
        showroomLeadId: lead.id,
        pendingCapture: lead.crm?.pendingShowroomCapture ?? null,
      },
    });
  }

  function handleSuggestVehiclesFromShowroom() {
    handleApplyShowroomCapture();
    handleAddVehicle();
  }

  function handlePrepareOfferFromShowroom() {
    handleApplyShowroomCapture();
    onPrepareOffer?.();
  }

  function handleSaveSpecialQuestionAnswer({ answerText, sourceNote, learnForClever }) {
    const knowledgeResult = saveSellerKnowledgeAnswerFromLead({
      lead,
      answerText,
      sourceNote,
      learnForClever,
    });
    if (!knowledgeResult.ok) {
      setToast(knowledgeResult.message ?? 'Antwort konnte nicht gespeichert werden.');
      setTimeout(() => setToast(''), 3500);
      return;
    }

    onSave?.({
      specialQuestionAnswer: {
        answerText,
        sourceNote: sourceNote || null,
        knowledgeAnswerId: knowledgeResult.answer?.id ?? null,
        learnForClever,
        savedAt: new Date().toISOString(),
        sentAt: null,
      },
      specialCustomerQuestion: {
        ...lead.specialCustomerQuestion,
        status: 'answered_pending_send',
      },
      crm: {
        ...crm,
        nextStepId: 'send_customer_answer',
        nextStepLabel: 'Antwort an Kunden senden',
      },
    }, {
      historyText: 'Kundenfrage beantwortet',
      historyType: 'note',
      addFollowupHistory: false,
    });

    closeSheet();
    if (inboxItemIdForAntworten) handleInboxItemHandled(inboxItemIdForAntworten);
    setToast(learnForClever
      ? 'Antwort gespeichert – Clever kann daraus lernen.'
      : 'Antwort gespeichert (ohne Clever-Lernen).');
    setTimeout(() => setToast(''), 3500);
  }

  function selectFollowUp(chip) {
    setNextStepId(chip.id);
    setFollowUpAt(computeFollowUpAt(chip.id));
    setFollowUpSource('manual');
  }

  function buildSavePayload(extraCrm = {}, addressOverride = null) {
    const nextLabel = lead?.crm?.nextStepLabel
      ?? FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label
      ?? nextStepLabel;
    const outcomeChip = CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId);
    const vehicleLabel = [fields.brand ?? 'Kia', wishModel, wishTrim].filter(Boolean).join(' ').trim();
    const addressStorage = addressToStorageFields(addressOverride ?? customerAddress);
    const nextDistanceInfo = extraCrm.distanceInfo ?? distanceInfo ?? null;
    const {
      kundenhelfer: extraKundenhelfer,
      tradeIn: extraTradeIn,
      ...restExtraCrm
    } = extraCrm;

    return {
      contact: {
        name: name.trim() || 'Kunde (offen)',
        phone: phone.trim(),
        email: email.trim(),
        address: addressStorage.address,
      },
      notes: note.trim(),
      status: pipelineToLeadStatus(pipelineStatusId),
      vehicle: {
        brand: fields.brand ?? 'Kia',
        model: wishModel,
        trim: wishTrim,
        label: vehicleLabel || 'Kia – Modell offen',
      },
      paymentType: wishPaymentType,
      desiredRate: wishDesiredRate ? Number(wishDesiredRate) : (lead?.desiredRate ?? null),
      deliveryTime: wishDelivery,
      wish: {
        // Lead-Wish beibehalten (Rabatt, Leasingende, Liefertermin aus Review)
        ...(lead?.wish ?? {}),
        paymentType: wishPaymentType !== 'unknown'
          ? wishPaymentType
          : (lead?.wish?.paymentType ?? lead?.paymentType ?? null),
        termMonths: wishTermMonths
          ? Number(wishTermMonths)
          : (lead?.wish?.termMonths ?? null),
        mileagePerYear: wishMileage
          ? Number(wishMileage)
          : (lead?.wish?.mileagePerYear ?? null),
        desiredPrice: wishDesiredPrice
          ? Number(wishDesiredPrice)
          : (lead?.wish?.desiredPrice ?? null),
        downPayment: wishDownPayment
          ? Number(wishDownPayment)
          : (lead?.wish?.downPayment ?? null),
        equipment: wishEquipment.trim() || lead?.wish?.equipment || '',
        desiredRate: wishDesiredRate
          ? Number(wishDesiredRate)
          : (lead?.wish?.desiredRate ?? lead?.desiredRate ?? null),
        desiredDeliveryDate: wishDelivery || lead?.wish?.desiredDeliveryDate || null,
      },
      crm: {
        ...crm,
        pipelineStatusId,
        nextStepId,
        nextStepLabel: nextLabel,
        followUpAt,
        followUpSource,
        reservedModels,
        offerSelectionGroups: extraCrm.offerSelectionGroups ?? resolvedSelectionGroups,
        offers: crm.offers ?? [],
        kundenhelfer: buildKundenhelferSavePatch({
          existingKundenhelfer: crm.kundenhelfer,
          extraKundenhelfer,
          voiceMemos: kundenhelferMemos,
          conversationNotes,
        }),
        tradeIn: patchTradeIn(
          tradeInData ?? createEmptyTradeIn(),
          extraTradeIn ?? {},
        ),
        address: addressStorage.address,
        customerAddress: addressStorage.customerAddress,
        distanceInfo: nextDistanceInfo,
        lastOutcomeId: outcomeId ?? crm.lastOutcomeId,
        lastOutcomeLabel: outcomeChip?.label ?? crm.lastOutcomeLabel,
        ...restExtraCrm,
      },
    };
  }

  useEffect(() => {
    if (!reminderEval?.shouldApply || !lead?.id) return;
    const key = `${lead.id}:${reminderEval.fingerprint}`;
    if (appliedReminderRef.current === key) return;

    const result = applyJourneyReminder(lead, reminderEval);
    if (!result.applied) return;

    appliedReminderRef.current = key;
    onSave?.(buildSavePayload(result.crmPatch), { silent: true, addFollowupHistory: false });
    onAddHistory?.(
      result.historyEntry.text,
      result.historyEntry.type,
      { silent: true, meta: result.historyEntry.meta },
    );
  }, [lead, reminderEval, onSave, onAddHistory]);

  function handleSendCleverMessage({
    text,
    threadId,
    relatedOfferId,
    relatedQuestionId,
  }) {
    const result = sendCleverChannelMessage({
      lead,
      text,
      threadId,
      relatedOfferId: relatedOfferId ?? questionContext?.offerId ?? initialAntwortenOfferId,
      relatedQuestionId: relatedQuestionId ?? questionContext?.questionId,
      createdByName: name?.trim() || 'Verkäufer',
    });
    if (!result.message) {
      setToast(result.error === 'thread_not_found'
        ? 'Thread nicht gefunden – bitte aus Clever Eingang erneut öffnen'
        : result.error === 'sensitive_or_empty'
          ? 'Nachricht enthält sensible Daten und kann nicht gesendet werden.'
          : 'Nachricht konnte nicht gesendet werden.');
      setTimeout(() => setToast(''), 3500);
      return;
    }
    onSave?.({
      ...buildSavePayload({
        customerMessages: result.lead.crm?.customerMessages,
        customerMessageThreads: result.lead.crm?.customerMessageThreads,
      }),
      history: result.lead.history,
    }, {
      silent: true,
      addFollowupHistory: false,
    });
    if (inboxItemIdForAntworten) handleInboxItemHandled(inboxItemIdForAntworten);
    setToast('Im Kundenportal gespeichert');
    setTimeout(() => setToast(''), 3500);
  }

  function save(meta = {}) {
    onSave?.(buildSavePayload(), meta);
  }

  function saveUnterlagen(unterlagenData, historyText, historyType = 'unterlagen', tradeInOverride = null) {
    const nextTradeIn = tradeInOverride ?? tradeInData;
    if (tradeInOverride) setTradeInData(tradeInOverride);
    onSave?.(buildSavePayload({
      cleverUnterlagen: unterlagenData,
      tradeIn: nextTradeIn,
    }), {
      historyText,
      historyType,
      addFollowupHistory: false,
      silent: !historyText,
    });
  }

  function sellerInsightOptions(extra = {}) {
    return {
      ...extra,
      sellerId: lead?.ownerId ?? lead?.assignedSellerId ?? null,
      sellerName: lead?.ownerName ?? null,
    };
  }

  function saveKundenhelferSheet() {
    const baseline = buildKundenhelferDisplayNotes(lead);
    const newChips = collectNewKundenhelferChips(baseline, kundenhelferNotes);
    const extraCrm = newChips.length
      ? {
        sellerInsights: appendSellerInsightsFromTexts(
          lead,
          newChips,
          sellerInsightOptions(),
        ).crm.sellerInsights,
      }
      : {};

    onSave?.(buildSavePayload(extraCrm), {
      historyText: 'Clever Kundenhelfer aktualisiert',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function handleNotepadCaptureCommit({
    text,
    labels = null,
    context = null,
    attachment = null,
  } = {}) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed && !(labels?.length) && !attachment) return;

    const nextLead = appendSellerInsightToLead(
      lead,
      trimmed || (labels?.length ? labels.join(', ') : 'Notiz-Scan'),
      sellerInsightOptions({
        context,
        understoodLabels: Array.isArray(labels) && labels.length ? labels : undefined,
        attachment: attachment ?? null,
      }),
    );
    const historyText = context === 'handwritten_note'
      ? 'Zettel gescannt'
      : 'Gespräch festgehalten';
    onSave?.(buildSavePayload({
      sellerInsights: nextLead.crm.sellerInsights,
    }), {
      historyText,
      historyType: 'note',
      addFollowupHistory: false,
      silent: true,
    });
    setToast('Notiert');
    setTimeout(() => setToast(''), 2800);
  }

  function saveCustomerSheet() {
    save({ historyText: 'Kundendaten ergänzt', addFollowupHistory: false });
    closeSheet();
  }

  async function saveAddressSheet() {
    const normalized = normalizeAddressResult(customerAddress);
    setCustomerAddress(normalized);

    let nextDistance = distanceInfo;
    if (shouldRecalculateDistance({
      distanceInfo,
      customerAddress: normalized,
      dealerLocation,
    })) {
      nextDistance = await calculateCustomerDistance(normalized, dealerLocation);
      setDistanceInfo(nextDistance);
    }

    onSave?.(buildSavePayload({ distanceInfo: nextDistance }, normalized), {
      historyText: 'Adresse ergänzt',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function saveWishSheet() {
    save({ historyText: 'Kundenwunsch festgehalten', addFollowupHistory: false });
    closeSheet();
  }

  function applyWishConditions(patch) {
    const pt = patch.paymentType ?? wishPaymentType;
    const nextTermMonths = patch.termMonths != null ? String(patch.termMonths) : wishTermMonths;
    const nextMileage = patch.mileagePerYear != null ? String(patch.mileagePerYear) : wishMileage;
    const nextDownPayment = patch.downPayment != null ? String(patch.downPayment) : wishDownPayment;
    const nextDesiredRate = patch.desiredRate != null ? String(patch.desiredRate) : wishDesiredRate;
    const nextDesiredPrice = patch.desiredPrice != null ? String(patch.desiredPrice) : wishDesiredPrice;
    const nextDelivery = patch.delivery != null ? patch.delivery : wishDelivery;

    setWishPaymentType(pt);
    setWishTermMonths(nextTermMonths);
    setWishMileage(nextMileage);
    setWishDownPayment(nextDownPayment);
    setWishDesiredRate(nextDesiredRate);
    setWishDesiredPrice(nextDesiredPrice);
    setWishDelivery(nextDelivery);

    const wishConditions = buildWishConditionsFromSources({
      paymentType: pt,
      termMonths: nextTermMonths ? Number(nextTermMonths) : null,
      mileagePerYear: nextMileage ? Number(nextMileage) : null,
      downPayment: nextDownPayment !== '' && nextDownPayment != null
        ? Number(nextDownPayment)
        : null,
      desiredRate: nextDesiredRate ? Number(nextDesiredRate) : null,
      desiredPrice: nextDesiredPrice ? Number(nextDesiredPrice) : null,
    });
    const currentGroups = offerSelectionGroups.length
      ? offerSelectionGroups
      : sanitizeOfferSelectionGroups(lead?.crm?.offerSelectionGroups ?? []);
    const syncedGroups = syncOfferSelectionGroupsWithWish(currentGroups, wishConditions);
    setOfferSelectionGroups(syncedGroups);

    const payload = buildSavePayload({ offerSelectionGroups: syncedGroups });
    onSave?.({
      ...payload,
      paymentType: pt,
      desiredRate: nextDesiredRate ? Number(nextDesiredRate) : null,
      deliveryTime: nextDelivery,
      wish: {
        ...payload.wish,
        termMonths: nextTermMonths ? Number(nextTermMonths) : null,
        mileagePerYear: nextMileage ? Number(nextMileage) : null,
        desiredPrice: nextDesiredPrice ? Number(nextDesiredPrice) : null,
        downPayment: nextDownPayment !== '' && nextDownPayment != null
          ? Number(nextDownPayment)
          : null,
      },
    }, {
      historyText: 'Wunschkonditionen aktualisiert',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function handleAdoptLexiconChip(searchState) {
    const chip = buildLexiconAkteChip(searchState);
    if (!chip) return;
    const { question, cleverAnswer } = extractLexiconQuestionAnswer(searchState);
    if (question) {
      logCustomerActivity(buildCleverQuestionActivity({ question, cleverAnswer }));
    }
    const nextLead = appendSellerInsightsFromTexts(lead, [chip], sellerInsightOptions());
    setKundenhelferNotes(addCustomKundenhelferChip(kundenhelferNotes, chip));
    onSave?.(buildSavePayload({
      sellerInsights: nextLead.crm.sellerInsights,
    }), {
      historyText: `Lexikon übernommen: ${chip}`,
      addFollowupHistory: false,
    });
    setToast('In Kundenakte übernommen');
    setTimeout(() => setToast(''), 2800);
  }

  function saveNextSheet() {
    save({
      historyText: `Nachfassen geplant: ${nextStepLabel}`,
      historyType: 'followup',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function removeReservedModel(model) {
    const next = reservedModels.filter((m) => m.id !== model.id);
    const reindexed = next.map((m, index) => ({ ...m, isPrimary: index === 0 }));
    setReservedModels(reindexed);
    onSave?.(buildSavePayload({ reservedModels: reindexed }), {
      historyText: `${formatReservedModelName(model.name)} entfernt`,
      addFollowupHistory: false,
    });
  }

  function createOfferForModel(model) {
    closeSheet();
    onPrepareOffer?.(model);
  }

  function trackCleverActionFollowed(actionHint) {
    if (!actionHint?.title) return;
    onAddHistory?.(
      formatCleverActionFollowedHistoryText(actionHint),
      'clever_action',
      { silent: true },
    );
  }

  function handleCleverMarkDone(view) {
    if (!view?.actionId) return;
    setCleverDoneActionIds((prev) => [...new Set([...prev, view.actionId])]);
    onAddHistory?.(
      view.doneOption?.historyText ?? '✓ Clever-Empfehlung erledigt',
      'clever_action',
      { silent: true },
    );
    onSave?.(buildSavePayload({
      cleverLastDoneActionId: view.actionId,
      cleverLastDoneAt: new Date().toISOString(),
    }), { silent: true });
  }

  function handleCleverEmpfiehltAction(view, action) {
    const hint = cleverActionToHint(view?.recommendation ?? cleverRecommendation, { telHref });
    if (action?.type === 'call' || action?.type === 'whatsapp' || action?.type === 'email') {
      trackCleverActionFollowed(hint);
      return;
    }
    handleCleverAction(hint);
  }

  function handleCleverOpenOffer(view) {
    const cardId = view?.recommendation?.meta?.cardId;
    const card = cardId
      ? vehicleCards.find((item) => item.id === cardId)
      : vehicleCards[0];
    if (card) {
      openBoardOfferFromCard(card);
      return;
    }
    handleCleverAction(cleverActionToHint(view?.recommendation ?? cleverRecommendation, { telHref }));
  }

  async function handleCopyMessageSuggestion(suggestion) {
    if (!suggestion?.text) return;
    try {
      await copyToClipboard(suggestion.text);
      onAddHistory?.('Clever Textvorschlag kopiert', 'clever_message', { silent: true });
      setToast('Textvorschlag kopiert');
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('Kopieren nicht möglich – Text in Clever Nachrichten öffnen.');
      setTimeout(() => setToast(''), 3500);
    }
  }

  function handlePrepareMessageSuggestion(suggestion) {
    if (!suggestion?.text) return;
    openCleverAntworten('frei', suggestion.text);
    onAddHistory?.('Clever Textvorschlag im Composer vorbereitet', 'clever_message', { silent: true });
  }

  function handleCleverAction(actionHint) {
    trackCleverActionFollowed(actionHint);
    const handler = actionHint?.handlerType ?? actionHint?.action;
    if (handler === 'selection_send') {
      handleSendCustomerSelection();
      return;
    }
    if (handler === 'portal_followup' || handler === 'portal_code_remind') {
      handleOpenPortalShare();
      return;
    }
    if (handler === 'portal_viewed_followup') {
      openCleverAntworten('nachfassen');
      return;
    }
    if (handler === 'offer_question') {
      const cardId = actionHint?.meta?.cardId;
      const card = cardId
        ? vehicleCards.find((c) => c.id === cardId)
        : vehicleCards[0];
      if (card) {
        const interaction = getCustomerOfferInteraction(lead, card.id);
        const openQuestion = (interaction?.customerQuestions ?? []).find((q) => q.status === 'open');
        if (openQuestion) {
          openOfferQuestionAnswer({
            offerId: card.id,
            questionId: openQuestion.id,
            inboxItemId: actionHint?.meta?.inboxItemId ?? null,
          });
        }
      }
      return;
    }
    if (handler === 'offer_send' || handler === 'offer_proposal') {
      const cardId = actionHint?.meta?.cardId;
      const card = cardId
        ? vehicleCards.find((c) => c.id === cardId)
        : vehicleCards[0];
      if (card) {
        openBoardOfferFromCard(card);
        return;
      }
      onPrepareOffer?.();
      return;
    }
    if (handler === 'documents' || handler === 'leasing_submit' || handler === 'unterlagen') {
      openSheet(SHEETS.unterlagen);
      return;
    }
    if (handler === 'self_disclosure_review') {
      openSelfDisclosureReview(actionHint?.meta?.inboxItemId ?? null);
      return;
    }
    if (handler === 'offer_create') {
      handleAddVehicle();
      return;
    }
    if (handler === 'offer_send_portfolio') {
      handleSendCustomerSelection();
      return;
    }
    if (handler === 'delivery_handover' || handler === 'delivery_plan') {
      openCleverAntworten('delivery');
      return;
    }
    if (handler === 'order') {
      openSheet(SHEETS.more);
      return;
    }
    if (handler === 'send_customer_answer') {
      handleSendSpecialQuestionAnswer();
      return;
    }
    if (handler === 'answer_customer_question') {
      handlePortalCardReply({
        inboxItemId: actionHint?.meta?.inboxItemId ?? null,
      });
      return;
    }
    if (handler === 'showroom_capture_review') {
      handleEditShowroomCapture();
      return;
    }
    if (handler !== 'call') {
      openSheet(SHEETS.customer);
    }
  }

  function saveOutcomeSheet() {
    const chip = CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId);
    if (chip) {
      const text = chip.label + (outcomeNote.trim() ? ` · ${outcomeNote.trim()}` : '');
      onAddHistory?.(text, 'call', { pipelineStatusId: chip.statusId });
      setPipelineStatusId(chip.statusId);
      onSave?.(buildSavePayload({
        lastOutcomeId: chip.id,
        lastOutcomeLabel: chip.label,
        pipelineStatusId: chip.statusId,
      }), { silent: true, addFollowupHistory: false });
    } else if (outcomeNote.trim()) {
      onAddHistory?.(outcomeNote.trim(), 'note');
    }
    setOutcomeNote('');
    closeSheet();
  }

  const isChatTab = akteTab === AKTE_TABS.chat;
  /** Clever: kein Verlauf über Composer – nur letzte Aktion. Chat-Tab = voller Verlauf. */
  const hideComposerFeed = !isChatTab;
  const feedCleverBanner = isChatTab ? null : (
    <>
      <CustomerAkteCleverNotepad
        lead={lead}
        conditionChips={schnellaufnahmeChips}
        customerName={name}
        workingOfferLabel={workingOfferItem?.shortLabel || workingOfferItem?.label || null}
        onOpenWorkingOffer={workingOfferItem?.card
          ? () => openOfferInWorkspace(workingOfferItem.card)
          : null}
        onOpenFull={() => openKundenhelferSheet()}
        onChipClick={handleNotepadChipClick}
        sticky
      />
      {goldenMomentView ? (
        <div className="cn-hide-when-assist-rail">
          <CustomerAkteGoldenMomentCard
            moment={goldenMomentView}
            onPrimary={handleGoldenMomentPrimary}
            onSecondary={() => focusChatComposer({ seedDraft: 'Nachfassen.' })}
          />
        </div>
      ) : cleverEmpfiehltView ? (
        <div className="cn-hide-when-assist-rail">
          <CleverEmpfiehltCard
            view={{
              ...cleverEmpfiehltView,
              closureChance: undefined,
              closureLabel: undefined,
            }}
            telHref={telHref}
            onPrimaryAction={handleCleverEmpfiehltAction}
            onMarkDone={handleCleverMarkDone}
            onOpenOffer={handleCleverOpenOffer}
            onCopyMessage={handleCopyMessageSuggestion}
            onPrepareMessage={handlePrepareMessageSuggestion}
          />
        </div>
      ) : sellerCleverMoment ? (
        <div className="cn-hide-when-assist-rail">
          <CleverMoment
            className="cn-clever-moment--lavender"
            eyebrow="Clever"
            title={sellerCleverMoment.summary}
            primaryLabel={sellerCleverMoment.primaryAction?.label}
            onPrimary={() => focusChatComposer({
              seedDraft: sellerCleverMoment.primaryAction?.modeHint === 'appointment'
                ? 'Probefahrt anbieten.'
                : '',
            })}
            secondaryLabel={sellerCleverMoment.secondaryAction?.label}
            onSecondary={() => focusChatComposer({
              seedDraft: sellerCleverMoment.secondaryAction?.modeHint === 'appointment'
                ? 'Probefahrt anbieten.'
                : '',
            })}
          />
        </div>
      ) : null}
      {vehicleTracks.filter((t) => t.hasMultipleScenarios).map((track) => (
        <div key={`mobile-slots-${track.id}`} className="cn-hide-when-context-rail">
          <CustomerAkteScenarioOfferSlots
            track={track}
            disabled={isSaving}
            onCreateOffer={(slot) => openScenarioOfferSlot(slot, track)}
            onOpenOffer={(slot) => openScenarioOfferSlot(slot, track)}
            onSendBoth={handleSendBothScenarioOffers}
          />
        </div>
      ))}
      {vehicleTracks.length > 0 ? (
        <div className="cn-hide-when-context-rail">
          <CustomerAkteVehicleTracks
            tracks={vehicleTracks}
            title="Angebote"
            onOpenTrack={openVehicleTrack}
            onSelectTrack={selectVehicleTrack}
            onResumeTrack={resumeVehicleTrack}
            selectedTrackIds={selectedTrackIds}
            freshTrackId={freshTrackId}
          />
        </div>
      ) : null}
    </>
  );

  const mainWorkspace = (
    <div className="cust-akte-shell__pane cust-akte-shell__pane--clever cust-akte-shell__pane--feed cn-chat-readable">
      {kundenbildExpanded && customerSnapshot?.meta?.hasData ? (
        <CustomerAkteKundenbild
          model={customerSnapshot}
          expanded
          variant="panel"
          onFactTap={handleKundenbildFactTap}
          onMerken={handleKundenbildMerken}
        />
      ) : null}

      {requestedStockVehicle ? (
        <CustomerAkteRequestedStockVehicle
          stockVehicle={requestedStockVehicle}
          onOpenListing={handleOpenStockListing}
          onCreateOffer={handleCreateStockOffer}
        />
      ) : null}

      {lead?.crm?.hasPendingShowroomCapture && lead?.crm?.pendingShowroomCapture?.status === 'pending' ? (
        <CustomerAkteShowroomCapture
          capture={lead.crm.pendingShowroomCapture}
          onApply={handleApplyShowroomCapture}
          onEdit={handleEditShowroomCapture}
          onSuggestVehicles={handleSuggestVehiclesFromShowroom}
          onPrepareOffer={handlePrepareOfferFromShowroom}
        />
      ) : null}

      <CustomerAkteSharedWorkspace
        lead={lead}
        customerName={name}
        cleverMode
        focusToken={composerFocusToken}
        intentFocusToken={composerIntentFocusToken}
        intentFocusConstraint={composerIntentFocusConstraint}
        onRememberApplied={handleRememberApplied}
        seedDraft={composerSeedDraft}
        seedDraftToken={composerSeedToken}
        seedAutoRun={composerSeedAutoRun}
        replyContext={composerReplyContext}
        workingContextItems={workingContextItems}
        onRemoveWorkingContext={handleRemoveWorkingContext}
        onResolveOfferReference={applyOfferReferenceFromComposer}
        onUpsertWorkingContext={(item) => {
          setWorkingContextItems((prev) => upsertWorkingContextItem(prev, item));
        }}
        scrollToMessageId={feedFocusMessageId}
        scrollToMessageToken={feedFocusToken}
        onFocusFeedMessage={focusFeedMessage}
        workspaceSlot={offerWorkspaceCard ? (
          <CustomerAkteOfferWorkspacePanel
            card={offerWorkspaceCard}
            lead={lead}
            onBack={closeOfferWorkspace}
            onEdit={(card) => {
              if (onOpenOfferEdit) {
                onOpenOfferEdit(card);
                return;
              }
              openBoardOfferEntry(card, lead, {
                onOpenProposal: onOpenOfferProposal,
                onOpenCalculator: onOpenOfferEdit,
              });
            }}
            onOpenBoard={openOffersBoard}
          />
        ) : null}
        compactEmpty
        hideFeed={hideComposerFeed}
        isSaving={isSaving}
        feedTopSlot={hideComposerFeed ? null : feedCleverBanner}
        onOpenOffer={handleOpenOfferFromFeed}
        onAttachOffer={openAttachOfferPicker}
        onAttachDocument={openAttachDocumentPicker}
        onPrepareOfferDraft={handleSellerAssistPrepareOffer}
        onSendPortfolio={handlePrepareCustomerLink}
        onMessageSent={() => {
          if (inboxItemIdForAntworten) handleInboxItemHandled(inboxItemIdForAntworten);
          if (specialAnswerPendingSendRef.current) {
            markSpecialQuestionAnswerSent();
            specialAnswerPendingSendRef.current = false;
          }
        }}
        onUploadDocument={() => openSheet(SHEETS.unterlagen)}
        onStartSelfDisclosure={() => openSelfDisclosureReview()}
        onPersistLead={(nextLead) => {
          const nextCrm = nextLead.crm ?? {};
          if (nextCrm.followUpAt) setFollowUpAt(nextCrm.followUpAt);
          if (nextCrm.nextStepId) setNextStepId(nextCrm.nextStepId);
          if (nextCrm.followUpSource) setFollowUpSource(nextCrm.followUpSource);
          if (nextLead.desiredRate != null) setWishDesiredRate(String(nextLead.desiredRate));
          if (nextLead.paymentType && nextLead.paymentType !== 'unknown') {
            setWishPaymentType(nextLead.paymentType);
          }
          if (nextLead.wish?.mileagePerYear != null) {
            setWishMileage(String(nextLead.wish.mileagePerYear));
          }
          if (nextLead.wish?.termMonths != null) {
            setWishTermMonths(String(nextLead.wish.termMonths));
          }
          if (nextLead.wish?.downPayment != null && nextLead.wish.downPayment !== '') {
            setWishDownPayment(String(nextLead.wish.downPayment));
          }
          if (nextLead.wish?.desiredDeliveryDate) {
            setWishDelivery(String(nextLead.wish.desiredDeliveryDate));
          }
          if (nextLead.contact?.phone) setPhone(nextLead.contact.phone);
          if (nextLead.contact?.name || nextLead.name) {
            setName(nextLead.contact?.name || nextLead.name);
          }
          onSave?.({
            ...buildSavePayload({
              customerMessages: nextCrm.customerMessages,
              customerMessageThreads: nextCrm.customerMessageThreads,
              cleverAppointment: nextCrm.cleverAppointment,
              followUpAt: nextCrm.followUpAt,
              nextStepId: nextCrm.nextStepId,
              nextStepLabel: nextCrm.nextStepLabel,
              followUpSource: nextCrm.followUpSource,
              testDriveScheduledAt: nextCrm.testDriveScheduledAt,
              testDriveAppointmentAt: nextCrm.testDriveAppointmentAt,
              ...(Array.isArray(nextCrm.sellerInsights)
                ? { sellerInsights: nextCrm.sellerInsights }
                : {}),
              ...(nextCrm.tradeIn ? { tradeIn: nextCrm.tradeIn } : {}),
              ...(nextCrm.needProfile ? { needProfile: nextCrm.needProfile } : {}),
              ...(Array.isArray(nextCrm.vehicleConfigurations)
                ? { vehicleConfigurations: nextCrm.vehicleConfigurations }
                : {}),
            }),
            desiredRate: nextLead.desiredRate ?? undefined,
            paymentType: nextLead.paymentType ?? undefined,
            wish: nextLead.wish ?? undefined,
            contact: nextLead.contact
              ? {
                name: nextLead.contact.name,
                phone: nextLead.contact.phone,
                email: nextLead.contact.email,
                address: nextLead.contact.address,
              }
              : undefined,
            history: nextLead.history,
          }, { silent: true, addFollowupHistory: false });
        }}
      />
    </div>
  );

  const appointmentSummaryLine = leadAppointments[0]
    ? `${appointmentTypeLabel(leadAppointments[0].type) || leadAppointments[0].typeLabel} · ${formatAppointmentWhen(leadAppointments[0].startAt)}`
    : '';

  return (
    <section className="dai-lead-followup cust-akte cust-akte--responsive-shell cust-akte--feed" aria-labelledby="dai-lead-followup-title">
      <h2 id="dai-lead-followup-title" className="visually-hidden">
        {name?.trim() || 'Kunde noch offen'}
      </h2>

      <WorkspaceShell
        className="cust-akte-workspace-shell"
        withBottomNav
        variant="triple"
        desktopNav={(
          <CustomerAkteFileNav
            variant="rail"
            activeTab={akteTab}
            onSelect={handleAkteTabSelect}
            badges={{
              angebote: vehicleTracks.length || boardItems.length || 0,
            }}
          />
        )}
        header={(
          <CustomerAkteCompactHeader
            customerName={name}
            contextLine={headerContextLine}
            phone={phone}
            telHref={telHref}
            onBack={onDiscard}
            onOpenProfile={() => openSheet(SHEETS.customer)}
            onSearch={openAkteSearch}
            onMore={() => setMoreSheetOpen(true)}
            onMissingPhone={() => openSheet(SHEETS.customer)}
          />
        )}
        band={customerSnapshot?.meta?.hasData ? (
          <CustomerAkteKundenbild
            model={customerSnapshot}
            expanded={kundenbildExpanded}
            variant="bar"
            onToggle={setKundenbildExpanded}
            onFactTap={handleKundenbildFactTap}
            onMerken={handleKundenbildMerken}
          />
        ) : null}
        mobileContext={null}
        context={null}
        assist={(
          <CustomerAkteOfferRail
            tracks={vehicleTracks}
            goldenMoment={goldenMomentView}
            boardItems={boardItems}
            showTracks
            onOpenBoard={openOffersBoard}
            onOpenTrack={openVehicleTrack}
            onSelectTrack={selectVehicleTrack}
            onResumeTrack={resumeVehicleTrack}
            selectedTrackIds={selectedTrackIds}
            freshTrackId={freshTrackId}
            onCompareSelected={handleCompareSelectedOffers}
            onCreateCustomerOffer={handleCreateCustomerOfferFromSelection}
            onPrepareMessage={handlePrepareMessageFromSelection}
            onClearSelection={clearOfferSelection}
            onGoldenPrimary={handleGoldenMomentPrimary}
            onGoldenSecondary={() => focusChatComposer({ seedDraft: 'Nachfassen.' })}
          />
        )}
        main={<div className="cust-akte-shell__workspace">{mainWorkspace}</div>}
        nav={(
          <CustomerAkteFileNav
            activeTab={akteTab}
            onSelect={handleAkteTabSelect}
            badges={{
              angebote: vehicleTracks.length || boardItems.length || 0,
            }}
          />
        )}
      />

      <CustomerAkteMoreSheet
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        offersCount={boardItems.length}
        unterlagenLabel={`${unterlagenSummary.doneCount ?? 0}/${unterlagenSummary.totalCount ?? 0}`}
        unterlagenOpen={unterlagenOpenCount}
        selfDisclosureLabel={selfDisclosureLabel}
        activitiesCount={activityDashboard.newCustomerActivities || 0}
        appointmentSummary={appointmentSummaryLine}
        onOffers={openOffersBoard}
        onUnterlagen={() => openSheet(SHEETS.unterlagen)}
        onSelfDisclosure={() => openSelfDisclosureReview()}
        onHistory={openActivitiesSheet}
        onTermine={() => openSheet(SHEETS.next)}
        onCustomerData={() => openSheet(SHEETS.customer)}
        onNotepad={() => openKundenhelferSheet()}
        onPortal={() => handleOpenPortalShare()}
        onLexikon={() => openSheet(SHEETS.lexikon)}
      />

      <CustomerAkteWishConditionsSheet
        open={activeSheet === SHEETS.wishConditions}
        onClose={closeSheet}
        values={wishEditValues}
        onApply={applyWishConditions}
        getBudgetFieldLabel={getBudgetFieldLabel}
        saving={isSaving}
        focusField={wishConditionsFocusField}
      />

      <CustomerAkteSnapshotChipEditor
        open={Boolean(snapshotChipEditor?.key)}
        editorKey={snapshotChipEditor?.key || null}
        values={snapshotChipEditorValues}
        onClose={() => setSnapshotChipEditor(null)}
        onApply={applySnapshotChipEdit}
        saving={isSaving}
      />

      <LeadDetailPanel
        open={activeSheet === SHEETS.boardOffers}
        onClose={closeSheet}
        title="Angebote"
        footer={(
          <div className="dai-lead-sheet-footer-row">
            <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
              Schließen
            </button>
            <button type="button" className="dai-btn dai-btn--primary" onClick={() => { closeSheet(); handleAddVehicle(); }}>
              + Angebot
            </button>
          </div>
        )}
      >
        <div className="cust-akte-angebote-sheet">
          {vehicleTracks.filter((t) => t.hasMultipleScenarios).map((track) => (
            <CustomerAkteScenarioOfferSlots
              key={`scenario-slots-${track.id}`}
              track={track}
              disabled={isSaving}
              onCreateOffer={(slot) => {
                closeSheet();
                openScenarioOfferSlot(slot, track);
              }}
              onOpenOffer={(slot) => {
                closeSheet();
                openScenarioOfferSlot(slot, track);
              }}
              onSendBoth={handleSendBothScenarioOffers}
            />
          ))}
          {vehicleTracks.length > 0 ? (
            <CustomerAkteVehicleTracks
              tracks={vehicleTracks}
              title="Angebote"
              showFilters
              filter={angeboteFilter}
              onFilterChange={setAngeboteFilter}
              emptyLabel="Keine Spuren in diesem Filter."
              onOpenTrack={(track) => {
                closeSheet();
                openVehicleTrack(track);
              }}
              onSelectTrack={(track) => {
                closeSheet();
                selectVehicleTrack(track);
              }}
              onResumeTrack={resumeVehicleTrack}
              selectedTrackIds={selectedTrackIds}
              freshTrackId={freshTrackId}
            />
          ) : null}
          <CustomerAktePortalSendCta
            boardItems={boardItems}
            email={email}
            onSend={handleSendCustomerSelection}
            onAddEmail={() => openSheet(SHEETS.customer)}
            disabled={isSaving}
          />
          {boardItems.length > 0 ? (
            <details className="cust-akte-angebote-sheet__board">
              <summary>Klassisches Angebotsboard</summary>
              <div className="cn-card-grid cn-card-grid--2 cust-akte-offers-grid">
                <CustomerAkteBoard
                  items={boardItems}
                  lead={lead}
                  animateNew={showCardAnimation && boardItems.length > 0}
                  onCardClick={navigateBoardOfferCard}
                  onCardMenu={navigateBoardOfferCard}
                  onCardAction={handleBoardCardAction}
                  onSelectionGroupClick={openSelectionGroup}
                  onAddProposal={handleAddVehicle}
                />
              </div>
            </details>
          ) : null}
        </div>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.attachOffer}
        onClose={closeSheet}
        title="Angebot anhängen"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {vehicleCards.length === 0 ? (
          <p className="cust-attach-offer__empty">
            Noch kein Angebot in dieser Akte.
            {' '}
            <button
              type="button"
              className="cust-attach-offer__link"
              onClick={() => { closeSheet(); handleAddVehicle(); }}
            >
              Angebot anlegen
            </button>
          </p>
        ) : (
          <ul className="cust-attach-offer__list" role="listbox" aria-label="Angebote">
            {vehicleCards.map((card) => {
              const title = formatVehicleCardTitle(card).replace(/^Kia\s+/i, '');
              const meta = [
                formatVehicleCardConditions(card),
                formatVehicleCardPrice(card),
              ].filter(Boolean).join(' · ');
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    className="cust-attach-offer__item"
                    role="option"
                    onClick={() => attachOfferToComposer(card)}
                  >
                    <span className="cust-attach-offer__title">{title}</span>
                    {meta ? <span className="cust-attach-offer__meta">{meta}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="cust-attach-offer__hint">
          Angehängte Angebote erscheinen als Kontext über dem Composer – Clever weiß dann, worüber du sprichst.
        </p>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.attachDocument}
        onClose={closeSheet}
        title="Dokument anhängen"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {attachableDocuments.length === 0 ? (
          <p className="cust-attach-offer__empty">
            Noch keine Unterlage in dieser Akte.
            {' '}
            <button
              type="button"
              className="cust-attach-offer__link"
              onClick={() => { closeSheet(); openSheet(SHEETS.unterlagen); }}
            >
              Unterlagen öffnen
            </button>
          </p>
        ) : (
          <ul className="cust-attach-offer__list" role="listbox" aria-label="Dokumente">
            {attachableDocuments.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="cust-attach-offer__item"
                  role="option"
                  onClick={() => attachDocumentToComposer(doc)}
                >
                  <span className="cust-attach-offer__title">{doc.label}</span>
                  {doc.fileName ? (
                    <span className="cust-attach-offer__meta">{doc.fileName}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="cust-attach-offer__hint">
          Angehängte Dokumente sitzen als Kontext-Pill über dem Composer.
        </p>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.akteSearch}
        onClose={() => {
          setAkteSearchQuery('');
          closeSheet();
        }}
        title="Suche"
        footer={(
          <button
            type="button"
            className="dai-btn dai-btn--ghost"
            onClick={() => {
              setAkteSearchQuery('');
              closeSheet();
            }}
          >
            Schließen
          </button>
        )}
      >
        <label className="cust-akte-search__field" htmlFor="cust-akte-search-input">
          <span className="visually-hidden">In dieser Akte suchen</span>
          <input
            id="cust-akte-search-input"
            className="cust-akte-search__input"
            type="search"
            value={akteSearchQuery}
            onChange={(e) => setAkteSearchQuery(e.target.value)}
            placeholder="Lieferzeit, EV4, 20.000 …"
            autoFocus
          />
        </label>
        {String(akteSearchQuery || '').trim().length < 2 ? (
          <p className="cust-attach-offer__hint">
            Durchsucht Nachrichten, Angebote und Notizen in diesem Vorgang.
          </p>
        ) : akteSearchHits.length === 0 ? (
          <p className="cust-attach-offer__empty">Keine Treffer.</p>
        ) : (
          <ul className="cust-attach-offer__list" role="listbox" aria-label="Suchtreffer">
            {akteSearchHits.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  type="button"
                  className="cust-attach-offer__item"
                  role="option"
                  onClick={() => handleAkteSearchHit(hit)}
                >
                  <span className="cust-attach-offer__title">
                    {hit.kind === 'offer' ? 'Angebot' : hit.kind === 'note' ? 'Notiz' : 'Nachricht'}
                    {hit.whenLabel ? ` · ${hit.whenLabel}` : ''}
                  </span>
                  <span className="cust-attach-offer__meta">
                    {hit.snippet || hit.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </LeadDetailPanel>

      {/* ── Mehr (selten) ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.more}
        onClose={closeSheet}
        title="Mehr"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        <div className="cust-akte-more__actions">
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.lexikon); }}>
            Clever-Lexikon
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.wish); }}>
            Wunsch bearbeiten
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.next); }}>
            Termine
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openOffersBoard(); }}>
            Angebote
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.outcome); }}>
            Ergebnis
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.history); }}>
            Verlauf ({history.length})
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); onEnterDetail?.(); }}>
            Verkaufschance im CRM
          </button>
        </div>
        <DealerAppLegalMenu />
      </LeadDetailPanel>

      {/* ── Fahrzeugkarte Aktionen ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.vehicle && Boolean(selectedVehicleCard)}
        onClose={closeSheet}
        title={selectedVehicleCard?.modelName ?? 'Fahrzeug'}
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {selectedVehicleCard && (
          <div className="cust-akte-vehicle-sheet">
            <div className="dai-reserved-model__visual" style={{ width: '100%', maxWidth: 200, marginBottom: 12 }}>
              <VehicleImage
                brand="Kia"
                model={selectedVehicleCard.modelKey}
                bodyType={selectedVehicleCard.bodyType ?? 'suv'}
                variant="card"
                className="dai-reserved-model__image-wrap"
                imageClassName="dai-reserved-model__image"
              />
            </div>
            <p className="cust-akte-vehicle-sheet__meta">
              {[selectedVehicleCard?.trimLabel, formatVehicleCardConditions(selectedVehicleCard), formatVehicleCardPrice(selectedVehicleCard)]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="cust-akte-vehicle-sheet__actions">
              <button
                type="button"
                className="dai-btn dai-btn--primary dai-btn--block"
                onClick={() => {
                  closeSheet();
                  openBoardOfferFromCard(selectedVehicleCard);
                }}
              >
                {resolveBoardOfferPrimaryAction(selectedVehicleCard, lead).label}
              </button>
              <button
                type="button"
                className="dai-btn dai-btn--secondary dai-btn--block"
                onClick={() => { closeSheet(); openSheet(SHEETS.offer); }}
              >
                Link vorbereiten
              </button>
              <button
                type="button"
                className="dai-btn dai-btn--ghost dai-btn--block"
                onClick={() => openSheet(SHEETS.wish)}
              >
                Wunsch anpassen
              </button>
              {selectedVehicleCard.source === 'reserved' && (
                <button
                  type="button"
                  className="dai-btn dai-btn--ghost dai-btn--block"
                  onClick={() => toggleVehicleFavorite(selectedVehicleCard)}
                >
                  {selectedVehicleCard.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
                </button>
              )}
              {selectedVehicleCard.source === 'reserved' && (
                <button
                  type="button"
                  className="dai-btn dai-btn--ghost dai-btn--block"
                  onClick={() => removeVehicleCard(selectedVehicleCard)}
                >
                  Modell entfernen
                </button>
              )}
            </div>
          </div>
        )}
      </LeadDetailPanel>

      {/* ── Kunde ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.customer}
        onClose={closeSheet}
        title="Kunde"
        footer={(
          <SheetFooter onCancel={closeSheet} onSave={saveCustomerSheet} saving={isSaving} />
        )}
      >
        <div className="dai-lead-form">
          <Field label="Name" id="lead-name" value={name} onChange={setName} placeholder="Max Müller" />
          <Field
            label="Telefon"
            id="lead-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={setPhone}
            placeholder="0170 1234567"
          />
          <Field
            label="E-Mail"
            id="lead-email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="kunde@beispiel.de"
          />
          <button
            type="button"
            className="dai-btn dai-btn--ghost dai-btn--block"
            onClick={() => {
              closeSheet();
              openSheet(SHEETS.address);
            }}
          >
            {addressLine ? 'Adresse bearbeiten' : '+ Adresse hinzufügen'}
          </button>
        </div>
      </LeadDetailPanel>

      {/* ── Adresse ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.address}
        onClose={closeSheet}
        title="Adresse"
        footer={(
          <SheetFooter onCancel={closeSheet} onSave={saveAddressSheet} saving={isSaving} />
        )}
      >
        <CustomerAddressSheet
          address={customerAddress}
          onChange={setCustomerAddress}
        />
      </LeadDetailPanel>

      {/* ── Wunsch ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.wish}
        onClose={closeSheet}
        title="Wunsch"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveWishSheet} saving={isSaving} />}
      >
        <div className="dai-lead-form">
          <Field
            label="Fahrzeug / Modell"
            id="lead-wish-model"
            value={wishModel}
            onChange={setWishModel}
            placeholder="z. B. EV5 Earth"
          />
          <label className="dai-lead-field" htmlFor="lead-wish-payment">
            <span className="dai-lead-field__label">Angebotsart</span>
            <select
              id="lead-wish-payment"
              className="dai-lead-field__input"
              value={wishPaymentType}
              onChange={(e) => {
                const next = e.target.value;
                setWishPaymentType(next);
                if (next === 'cash') setWishDesiredRate('');
                else if (next !== 'unknown') setWishDesiredPrice('');
              }}
            >
              {DEALER_AI_PAYMENT_OPTIONS.map((id) => (
                <option key={id} value={id}>{PAYMENT_TYPE_LABELS[id]}</option>
              ))}
            </select>
          </label>
          {wishPaymentType === 'cash' ? (
            <Field
              label={getBudgetFieldLabel('cash')}
              id="lead-wish-price"
              type="number"
              inputMode="numeric"
              value={wishDesiredPrice}
              onChange={setWishDesiredPrice}
              placeholder="30000"
            />
          ) : (
            <Field
              label={getBudgetFieldLabel(wishPaymentType)}
              id="lead-wish-rate"
              type="number"
              inputMode="numeric"
              value={wishDesiredRate}
              onChange={setWishDesiredRate}
              placeholder="299"
            />
          )}
          <Field
            label="Laufzeit"
            id="lead-wish-term"
            type="number"
            inputMode="numeric"
            value={wishTermMonths}
            onChange={setWishTermMonths}
            placeholder="48 Monate"
          />
          <Field
            label="Kilometer"
            id="lead-wish-km"
            type="number"
            inputMode="numeric"
            value={wishMileage}
            onChange={setWishMileage}
            placeholder="15000 / Jahr"
          />
          <Field
            label="Anzahlung"
            id="lead-wish-down"
            type="number"
            inputMode="numeric"
            value={wishDownPayment}
            onChange={setWishDownPayment}
            placeholder="2000"
          />
          <label className="dai-lead-field" htmlFor="lead-wish-delivery">
            <span className="dai-lead-field__label">Übergabe</span>
            <select
              id="lead-wish-delivery"
              className="dai-lead-field__input"
              value={wishDelivery}
              onChange={(e) => setWishDelivery(e.target.value)}
            >
              <option value="">—</option>
              {DEALER_AI_DELIVERY_DATE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <Field
            label="Ausstattung"
            id="lead-wish-equipment"
            value={wishEquipment}
            onChange={setWishEquipment}
            placeholder="z. B. Earth, Panorama"
          />
        </div>
      </LeadDetailPanel>

      {/* ── Nächster Schritt ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.next}
        onClose={closeSheet}
        title="Termine"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveNextSheet} saving={isSaving} />}
      >
        {leadAppointments.length > 0 ? (
          <div className="dai-lead-appt-list" aria-label="Geplante Termine">
            {leadAppointments.map((appt) => (
              <div key={appt.id || appt.startAt} className="dai-lead-appt-row">
                <strong>{appointmentTypeLabel(appt.type) || appt.typeLabel}</strong>
                <span>{formatAppointmentWhen(appt.startAt)}</span>
                {appt.vehicleContext ? <span>{appt.vehicleContext}</span> : null}
                <span className="dai-lead-appt-status">{appt.status || 'geplant'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dai-lead-tip">Noch keine Termine – Clever bereitet sie im Composer vor.</p>
        )}
        <p className="dai-lead-tip">Wiedervorlage / nächster Schritt (bestehende CRM-Logik):</p>
        <div className="dai-lead-chips dai-lead-chips--large" role="group" aria-label="Nächster Schritt">
          {FOLLOW_UP_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dai-lead-chip dai-lead-chip--large${nextStepId === chip.id ? ' is-active' : ''}`}
              onClick={() => selectFollowUp(chip)}
              aria-pressed={nextStepId === chip.id}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <label className="dai-lead-field" htmlFor="lead-followup-at">
          <span className="dai-lead-field__label">Datum / Uhrzeit</span>
          <input
            id="lead-followup-at"
            type="datetime-local"
            className="dai-lead-field__input"
            value={toDatetimeLocalValue(followUpAt)}
            onChange={(e) => {
              setFollowUpAt(new Date(e.target.value).toISOString());
              setFollowUpSource('manual');
            }}
          />
        </label>
      </LeadDetailPanel>

      {/* ── Passende Modelle ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.models}
        onClose={closeSheet}
        title="Passende Modelle"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {reservedModels.length === 0 ? (
          <div className="dai-lead-empty">
            <p>Ein passendes Modell bringt die Chance in Fahrt.</p>
            {onReturnToReview && (
              <button
                type="button"
                className="dai-btn dai-btn--secondary"
                onClick={() => { closeSheet(); onReturnToReview?.(); }}
              >
                Modelle hinzufügen
              </button>
            )}
          </div>
        ) : (
          <div className="dai-reserved-models">
            {reservedModels.map((model, index) => (
              <ReservedModelDetailCard
                key={model.id}
                model={model}
                index={index}
                onOffer={createOfferForModel}
                onRemove={removeReservedModel}
                disabled={isSaving}
              />
            ))}
          </div>
        )}
      </LeadDetailPanel>

      {/* ── Angebot ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.offer}
        onClose={closeSheet}
        title="Angebot"
        footer={resolvedOffers.length === 0 ? (
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        ) : null}
      >
        {resolvedOffers.length === 0 ? (
          <div className="dai-lead-empty">
            <p>Ein Angebot macht es konkret.</p>
            <div className="dai-lead-empty__actions">
              <button type="button" className="dai-btn dai-btn--primary" onClick={() => { closeSheet(); onPrepareOffer?.(); }}>
                Angebot vorbereiten
              </button>
              <button type="button" className="dai-btn dai-btn--ghost" disabled title="Bald verfügbar">
                Link vorbereiten
              </button>
            </div>
          </div>
        ) : (
          <>
            {offerFeedback && (
              <div className="dai-offer-feedback">
                <p className="dai-offer-feedback__headline">{offerFeedback.headline}</p>
                <p className="dai-offer-feedback__subline">{offerFeedback.subline}</p>
              </div>
            )}
            <ul className="dai-lead-offers">
            {resolvedOffers.map((offer) => (
              <li key={offer.id} className="dai-lead-offer-card">
                <p className="dai-lead-offer-card__name">{offer.name}</p>
                <p className="dai-lead-offer-card__meta">
                  {[offer.vehicle, offer.paymentType, OFFER_STATUS_LABELS[offer.status] ?? offer.status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="dai-lead-offer-card__actions">
                  {offer.code && (
                    <Link to={`/angebot/${offer.code}`} className="dai-btn dai-btn--secondary">
                      Angebot öffnen
                    </Link>
                  )}
                  <button type="button" className="dai-btn dai-btn--ghost">Link vorbereiten</button>
                  <button type="button" className="dai-btn dai-btn--ghost">Link senden</button>
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
      </LeadDetailPanel>

      {/* ── Ergebnis ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.outcome}
        onClose={closeSheet}
        title="Ergebnis"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveOutcomeSheet} saving={isSaving} />}
      >
        <div className="dai-lead-chips dai-lead-chips--large dai-lead-chips--wrap" role="group" aria-label="Ergebnis">
          {CALL_OUTCOME_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dai-lead-chip dai-lead-chip--large dai-lead-chip--outcome${outcomeId === chip.id ? ' is-active' : ''}`}
              onClick={() => setOutcomeId(chip.id)}
              aria-pressed={outcomeId === chip.id}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <Field
          label="Kurze Notiz"
          id="lead-outcome-note"
          type="textarea"
          value={outcomeNote}
          onChange={setOutcomeNote}
          placeholder="Optional"
        />
      </LeadDetailPanel>

      {/* ── Verlauf ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.history}
        onClose={closeSheet}
        title="Verlauf"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        <div className="cust-akte-verlauf">
          {lead?.advisorConversation && (
            <div className="cust-akte-verlauf__block">
              <CustomerAkteCleverGespraech conversation={lead.advisorConversation} />
            </div>
          )}
          {customerUnderstanding?.meta?.hasData && (
            <p className="cust-akte-verlauf__note">
              Das Clever-Verständnis finden Sie oben in der Kundenakte.
            </p>
          )}
          {(lead?.equipmentWishes?.length ?? 0) > 0 && (
            <div className="cust-akte-verlauf__block cust-akte-verlauf__block--subtle">
              <CustomerAkteEquipmentWishes wishes={lead.equipmentWishes} />
            </div>
          )}
          <CustomerAkteActivityTimeline
            history={history}
            dashboard={activityDashboard}
            phone={phone}
            email={email}
            customerName={name}
            onPersonalReply={handleQuestionPersonalReply}
          />
        </div>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.unterlagen}
        onClose={closeSheet}
        title="Abschluss & Unterlagen"
      >
        <CleverUnterlagenSheet
          lead={lead}
          paymentType={wishPaymentType !== 'unknown' ? wishPaymentType : lead?.paymentType}
          customerName={name}
          phone={phone}
          email={email}
          vehicleTitle={vehicleTitleForUnterlagen}
          vehicleConditions={vehicleConditionsForUnterlagen}
          vehicleCards={vehicleCards}
          tradeIn={tradeInData}
          onTradeInChange={setTradeInData}
          isGewerbe={lead?.wish?.customerGroup === 'gewerbe' || lead?.crm?.customerGroup === 'gewerbe'}
          embedded
          onClose={closeSheet}
          onSave={saveUnterlagen}
        />
      </LeadDetailPanel>

      {variantOfferContext && (
        <SelectionVariantOfferView
          group={variantOfferContext.group}
          variant={variantOfferContext.variant}
          lead={lead}
          onBack={handleVariantOfferBack}
          onUploadPdf={handleVariantOfferUploadPdf}
          onDeletePdf={handleVariantOfferDeletePdf}
          onEditConfiguration={handleVariantOfferEditConfiguration}
          isSaving={isSaving}
        />
      )}

      {variantConfigureContext && (
        <OfferVariantConfigurator
          group={variantConfigureContext.group}
          variant={variantConfigureContext.variant}
          lead={lead}
          onSave={handleVariantConfigureSave}
          onDuplicate={handleVariantConfigureDuplicate}
          onBack={handleVariantConfigureBack}
          isSaving={isSaving}
        />
      )}

      <LeadDetailPanel
        open={activeSheet === SHEETS.portfolioShare && Boolean(portfolioShare?.portfolio)}
        onClose={() => {
          setPortfolioShare(null);
          closeSheet();
        }}
        title="Kundenlink senden"
        footer={(
          <button
            type="button"
            className="dai-btn dai-btn--ghost"
            onClick={() => {
              setPortfolioShare(null);
              closeSheet();
            }}
          >
            Schließen
          </button>
        )}
      >
        {portfolioShare?.portfolio ? (
          <CustomerAktePortfolioShareSheet
            portfolio={portfolioShare.portfolio}
            portalAccess={portfolioShare.portalAccess}
            leadId={lead?.id}
            customerName={name}
            email={email}
            itemCount={portfolioShare.itemCount}
            dealerName={lead?.dealerName ?? lead?.ownerName ?? 'Clever Neuwagen'}
            onMarkSent={handlePortfolioShareSent}
          />
        ) : null}
      </LeadDetailPanel>

      {activeSheet === SHEETS.cleverAuswahl && selectedSelectionGroup && !variantConfigureContext && !variantOfferContext && (
        <CustomerAkteCleverAuswahlSheet
          group={selectedSelectionGroup}
          onBack={handleCleverAuswahlBack}
          onEditVariant={handleEditSelectionVariant}
          onOpenVariantOffer={handleOpenVariantOffer}
          onPrepareCustomerLink={handlePrepareCustomerLink}
          onDuplicateVariant={handleDuplicateSelectionVariant}
          onGroupActionReview={handleCleverAuswahlReview}
        />
      )}

      <CustomerSpecialQuestionAnswerSheet
        open={activeSheet === SHEETS.specialQuestionAnswer}
        onClose={closeSheet}
        lead={lead}
        onSave={handleSaveSpecialQuestionAnswer}
        saving={isSaving}
      />

      <CustomerAkteAddProposalSheet
        open={activeSheet === SHEETS.addProposal}
        onClose={closeSheet}
        onSelect={handleAddProposalOption}
      />

      <CustomerAkteLeaseFinanceSheet
        open={activeSheet === SHEETS.leaseFinancePick}
        onClose={closeSheet}
        onBack={() => openSheet(SHEETS.addProposal)}
        onSelect={handleLeaseFinanceOption}
      />

      <CustomerOfferQuestionAnswerSheet
        open={activeSheet === SHEETS.questionAnswer && Boolean(questionContext)}
        onClose={closeSheet}
        lead={lead}
        offerId={questionContext?.offerId}
        questionId={questionContext?.questionId}
        vehicleLabel={resolveOfferQuestionVehicleLabel(lead, questionContext?.offerId, vehicleCards)}
        onSave={handleSaveOfferQuestionAnswer}
        onMarkDoneOnly={handleMarkOfferQuestionDoneOnly}
        saving={isSaving}
      />

      <CustomerSelfDisclosureReviewSheet
        open={activeSheet === SHEETS.selfDisclosureReview}
        onClose={closeSheet}
        lead={lead}
        onSave={onSave}
        onPrepareCorrectionMessage={handlePrepareCorrectionMessage}
        inboxItemId={inboxItemIdForSelfDisclosure}
        onInboxItemHandled={handleInboxItemHandled}
        saving={isSaving}
      />

      <CleverKundenhelferSheet
        open={activeSheet === SHEETS.kundenhelfer}
        onClose={closeSheet}
        notes={kundenhelferNotes}
        onNotesChange={setKundenhelferNotes}
        chipCategories={kundenhelferChipCategories}
        onChipCategoriesChange={setKundenhelferChipCategories}
        voiceMemos={kundenhelferMemos}
        onVoiceMemosChange={setKundenhelferMemos}
        conversationNotes={conversationNotes}
        onConversationNotesChange={setConversationNotes}
        vehicleCards={vehicleCards}
        lead={lead}
        initialCategoryId={kundenhelferInitialCategory}
        onSave={saveKundenhelferSheet}
        isSaving={isSaving}
      />

      <LeadDetailPanel
        open={activeSheet === SHEETS.lexikon}
        onClose={closeSheet}
        title="Clever-Lexikon"
      >
        <CleverLexikon
          className="cust-akte-lexikon"
          subline="Technische Daten und Ausstattung – optional in die Kundenakte übernehmen."
          showChips
          onAdoptToAkte={handleAdoptLexiconChip}
        />
      </LeadDetailPanel>

      {toast && (
        <div className="cust-akte-toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}
