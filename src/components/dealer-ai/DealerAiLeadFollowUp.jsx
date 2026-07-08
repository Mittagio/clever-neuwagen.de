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
import { countUnterlagenOpenTasks } from '../../services/cleverUnterlagen.js';
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
import { buildCleverAntwortenContext } from '../../services/cleverAntworten.js';
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
import CleverAntwortenSheet from './CleverAntwortenSheet.jsx';
import CustomerAkteHeader from './CustomerAkteHeader.jsx';
import CustomerAkteActionBar from './CustomerAkteActionBar.jsx';
import CustomerAkteKundenhelfer from './CustomerAkteKundenhelfer.jsx';
import CustomerAkteWishConditions from './CustomerAkteWishConditions.jsx';
import CustomerAkteRequestedStockVehicle from './CustomerAkteRequestedStockVehicle.jsx';
import CustomerAkteWishConditionsSheet from './CustomerAkteWishConditionsSheet.jsx';
import CustomerAkteEquipmentWishes from './CustomerAkteEquipmentWishes.jsx';
import CustomerAkteCleverBeratung from './CustomerAkteCleverBeratung.jsx';
import CustomerAkteCleverGespraech from './CustomerAkteCleverGespraech.jsx';
import CustomerAkteActivityTimeline from './CustomerAkteActivityTimeline.jsx';
import { buildCleverBeratungAkteView } from '../../services/dealer/cleverConsultationAkte.js';
import { buildCustomerUnderstanding } from '../../services/dealer/customerUnderstanding.js';
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
import CustomerAktePortalStatusCard from './CustomerAktePortalStatusCard.jsx';
import CustomerAkteApplicationDocumentsCard from './CustomerAkteApplicationDocumentsCard.jsx';
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

  const [activeSheet, setActiveSheet] = useState(
    initialSheet === SHEETS.questionAnswer
      ? SHEETS.questionAnswer
      : (initialSheet === SHEETS.antworten ? SHEETS.antworten : initialSheet),
  );
  const [antwortenPreset, setAntwortenPreset] = useState(initialAntwortenIntent ?? null);
  const [antwortenInitialDraft, setAntwortenInitialDraft] = useState(null);
  const [inboxItemIdForAntworten, setInboxItemIdForAntworten] = useState(initialInboxItemId ?? null);
  const [inboxItemIdForSelfDisclosure, setInboxItemIdForSelfDisclosure] = useState(
    initialSheet === SHEETS.selfDisclosureReview ? initialInboxItemId : null,
  );
  const [questionContext, setQuestionContext] = useState(initialQuestionContext);

  useEffect(() => {
    if (!initialSheet) return;
    if (initialSheet === SHEETS.questionAnswer) {
      setActiveSheet(SHEETS.questionAnswer);
      return;
    }
    if (initialSheet === SHEETS.antworten) {
      setActiveSheet(SHEETS.antworten);
    } else {
      setActiveSheet(initialSheet);
    }
  }, [initialSheet]);

  useEffect(() => {
    if (initialAntwortenIntent) {
      setAntwortenPreset(initialAntwortenIntent);
      setActiveSheet(SHEETS.antworten);
    }
  }, [initialAntwortenIntent]);

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

  const [name, setName] = useState(lead?.contact?.name?.replace('Kunde (offen)', '') ?? fields.customerName ?? '');
  const [phone, setPhone] = useState(lead?.contact?.phone ?? '');
  const [email, setEmail] = useState(lead?.contact?.email ?? '');
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

  const unterlagenPaymentType = wishPaymentType !== 'unknown' ? wishPaymentType : lead?.paymentType;
  const unterlagenOpenCount = useMemo(
    () => countUnterlagenOpenTasks(lead, unterlagenPaymentType),
    [lead, unterlagenPaymentType],
  );
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
    openCleverAntworten();
    if (item?.cleverAnswer) {
      setToast('Text in Clever Nachrichten übernommen – prüfen und senden.');
      setTimeout(() => setToast(''), 3500);
    }
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

  const cleverAntwortenContext = useMemo(() => buildCleverAntwortenContext({
    lead,
    customerName: name,
    phone,
    email,
    vehicleCards,
    wishPaymentType,
  }), [lead, name, phone, email, vehicleCards, wishPaymentType]);

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

  function handlePortalCardReply() {
    const item = portalCustomerMessageItem;
    if (!item) {
      openCleverAntworten('answer_customer_question');
      return;
    }
    setInboxItemIdForAntworten(item.id);
    openCleverAntworten(item.metadata?.suggestedIntent ?? 'answer_customer_question');
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
      return;
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
      return;
    }

    const envkvCheck = validatePortfolioEnVkvForSend(result.portfolio.items);
    if (!envkvCheck.ok) {
      const labels = envkvCheck.blockers.map((b) => b.label).join(', ');
      setToast(`${envkvCheck.message} (${labels})`);
      setTimeout(() => setToast(''), 6000);
      return;
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
      return;
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
      setPortfolioShare({
        ...portfolioShare,
        portalAccess: copied.access,
      });
      onSave?.(buildSavePayload({
        customerPortalAccess: copied.access,
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

    setPortfolioShare({
      ...portfolioShare,
      portfolio: nextPortfolio,
      portalAccess: sentAccess.access,
    });

    onSave?.(buildSavePayload({
      customerOfferPortfolio: nextPortfolio,
      customerPortalAccess: sentAccess.access,
    }), {
      historyText: sentAccess.historyText ?? (
        via === 'email'
          ? 'Kundenlink per E-Mail versendet'
          : 'Kundenlink per Mail-App vorbereitet'
      ),
      addFollowupHistory: true,
    });
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

  function openBoardOfferFromCard(card, options = {}) {
    openBoardOfferEntry(card, lead, {
      onOpenProposal: onOpenOfferProposal,
      onOpenCalculator: onOpenOfferEdit,
    }, options);
  }

  function navigateBoardOfferCard(card) {
    const primaryAction = resolveBoardOfferPrimaryAction(card, lead);
    handleBoardCardAction(primaryAction, card);
  }

  function handleBoardCardAction(action, card) {
    const handler = action?.handlerType ?? action?.id;
    if (handler === 'create_offer' || handler === 'edit_offer' || handler === 'configure_conditions') {
      if (onOpenOfferEdit) {
        onOpenOfferEdit(card);
        return;
      }
      if (handler === 'create_offer' && onStartNewWish) {
        const pt = card.paymentType ?? wishPaymentType;
        onStartNewWish(lead, {
          proposalIntent: pt === 'cash' ? PROPOSAL_INTENTS.CASH : PROPOSAL_INTENTS.LEASING,
          paymentType: pt !== 'unknown' ? pt : 'leasing',
        });
        return;
      }
      setSelectedVehicleCard(card);
      openSheet(SHEETS.vehicle);
      return;
    }
    if (handler === 'view_proposal') {
      openBoardOfferFromCard(card);
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
    setActiveSheet(null);
    setAntwortenPreset(null);
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

  function openSheet(id) {
    setActiveSheet(id);
  }

  function openCleverAntworten(presetType = null) {
    setAntwortenPreset(presetType);
    setInboxItemIdForAntworten(null);
    openSheet(SHEETS.antworten);
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
    setAntwortenInitialDraft(draft);
    setAntwortenPreset('free_reply');
    setInboxItemIdForAntworten(null);
    openSheet(SHEETS.antworten);
    setToast('Korrekturtext in Clever Nachrichten vorbereitet.');
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
    setToast('Antwort gespeichert – Clever kann daraus lernen.');
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
      desiredRate: wishDesiredRate ? Number(wishDesiredRate) : null,
      deliveryTime: wishDelivery,
      wish: {
        termMonths: wishTermMonths ? Number(wishTermMonths) : null,
        mileagePerYear: wishMileage ? Number(wishMileage) : null,
        desiredPrice: wishDesiredPrice ? Number(wishDesiredPrice) : null,
        downPayment: wishDownPayment ? Number(wishDownPayment) : null,
        equipment: wishEquipment.trim(),
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
      setToast('Nachricht enthält sensible Daten und kann nicht gesendet werden.');
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

  function saveKundenhelferSheet() {
    const baseline = buildKundenhelferDisplayNotes(lead);
    const newChips = collectNewKundenhelferChips(baseline, kundenhelferNotes);
    const extraCrm = newChips.length
      ? { sellerInsights: appendSellerInsightsFromTexts(lead, newChips).crm.sellerInsights }
      : {};

    onSave?.(buildSavePayload(extraCrm), {
      historyText: 'Clever Kundenhelfer aktualisiert',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function handleAddSellerInsight(text, context = null) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;

    const nextLead = appendSellerInsightToLead(lead, trimmed, { context });
    onSave?.(buildSavePayload({
      sellerInsights: nextLead.crm.sellerInsights,
    }), {
      historyText: 'Erkenntnis ergänzt',
      historyType: 'note',
      addFollowupHistory: false,
      silent: true,
    });
    setToast('Erkenntnis ergänzt');
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
    const nextLead = appendSellerInsightsFromTexts(lead, [chip]);
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
    setAntwortenInitialDraft(suggestion.text);
    setAntwortenPreset('frei');
    setInboxItemIdForAntworten(null);
    openCleverAntworten('frei');
    onAddHistory?.('Clever Textvorschlag in Nachrichten vorbereitet', 'clever_message', { silent: true });
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
    if (handler === 'answer_customer_question') {
      openSheet(SHEETS.specialQuestionAnswer);
      return;
    }
    if (handler === 'send_customer_answer') {
      openCleverAntworten();
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

  return (
    <section className="dai-lead-followup cust-akte" aria-labelledby="dai-lead-followup-title">
      <h2 id="dai-lead-followup-title" className="visually-hidden">Kundenakte</h2>

      <CustomerAkteHeader
        customerName={name}
        phone={phone}
        email={email}
        address={addressLine}
        distanceSummary={distanceSummary}
        routeHref={routeHref}
        customerSince={lead?.createdAt}
        cleverScore={akteCleverScore}
        lead={lead}
        vehicleCardCount={vehicleCards.length}
        offersCount={resolvedOffers.length}
        hasNextStep={Boolean(nextStepId)}
        pipelineStatusLabel={pipelineStatusLabel}
        onBack={onDiscard}
        onEditCustomer={() => openSheet(SHEETS.customer)}
        onEditAddress={() => openSheet(SHEETS.address)}
        telHref={telHref}
      />

      <CustomerAkteActionBar
        telHref={telHref}
        onCleverNachrichten={() => openCleverAntworten()}
        onUnterlagen={() => openSheet(SHEETS.unterlagen)}
        onHistory={openActivitiesSheet}
        unterlagenBadge={unterlagenOpenCount}
        inboxOpenCount={inboxOpenCount}
        historyBadge={inboxOpenCount ? 0 : activityDashboard.newCustomerActivities}
      />

      {customerUnderstanding?.meta?.hasData && (
        <div className="cust-akte-verstaendnis">
          <CustomerAkteCleverBeratung
            view={cleverBeratungView}
            understanding={customerUnderstanding}
            telHref={telHref}
            onPrepareOffer={handleCleverBeratungPrepareOffer}
            onCreateMessage={() => openCleverAntworten()}
            onChangeRecommendation={handleCleverBeratungChangeRecommendation}
            onAddSellerInsight={handleAddSellerInsight}
            isSavingInsight={isSaving}
          />
        </div>
      )}

      <div className={hasSellerCustomerPicture ? 'cust-akte-operativ' : undefined}>
        <CustomerAkteKundenhelfer
          notes={kundenhelferNotes}
          chipCategories={kundenhelferChipCategories}
          conversationNotes={conversationNotes}
          voiceMemos={kundenhelferMemos}
          lead={lead}
          onOpenSheet={openKundenhelferSheet}
          variant="profile"
          hasCustomerUnderstanding={hasSellerCustomerPicture}
          subdued={hasSellerCustomerPicture}
        />

        {(!hasSellerCustomerPicture || !hideRedundantWishChips) && (
          <CustomerAkteWishConditions
            chips={schnellaufnahmeChips}
            onEdit={() => openWishConditionsSheet()}
            onChipClick={(field) => openWishConditionsSheet(field)}
          />
        )}

        {cleverEmpfiehltView && (
          <div className={hasSellerCustomerPicture ? 'cust-akte-operativ__empfiehlt' : 'cust-akte-priority'}>
            <CleverEmpfiehltCard
              view={cleverEmpfiehltView}
              telHref={telHref}
              onPrimaryAction={handleCleverEmpfiehltAction}
              onMarkDone={handleCleverMarkDone}
              onOpenOffer={handleCleverOpenOffer}
              onCopyMessage={handleCopyMessageSuggestion}
              onPrepareMessage={handlePrepareMessageSuggestion}
            />
          </div>
        )}
      </div>

      {requestedStockVehicle && (
        <CustomerAkteRequestedStockVehicle
          stockVehicle={requestedStockVehicle}
          onOpenListing={handleOpenStockListing}
          onCreateOffer={handleCreateStockOffer}
        />
      )}

      {lead?.crm?.hasPendingShowroomCapture && lead?.crm?.pendingShowroomCapture?.status === 'pending' && (
        <CustomerAkteShowroomCapture
          capture={lead.crm.pendingShowroomCapture}
          onApply={handleApplyShowroomCapture}
          onEdit={handleEditShowroomCapture}
          onSuggestVehicles={handleSuggestVehiclesFromShowroom}
          onPrepareOffer={handlePrepareOfferFromShowroom}
        />
      )}

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

      <CustomerAktePortalStatusCard
        lead={lead}
        hasOpenInboxMessage={Boolean(portalCustomerMessageItem)}
        onCopyLink={handlePortalCopyLink}
        onPrepareEmail={handleOpenPortalShare}
        onWriteMessage={() => openCleverAntworten('frei')}
        onPrepareFollowup={() => openCleverAntworten('nachfassen')}
        onReply={handlePortalCardReply}
        onOpenInbox={() => onOpenInbox?.(lead)}
        onOpenSelfDisclosureReview={() => openSelfDisclosureReview()}
      />

      <CustomerAkteApplicationDocumentsCard
        lead={lead}
        onOpenSelfDisclosureReview={() => openSelfDisclosureReview()}
        onOpenUnterlagen={() => openSheet(SHEETS.unterlagen)}
      />

      <CustomerAktePortalSendCta
        boardItems={boardItems}
        email={email}
        onSend={handleSendCustomerSelection}
        onAddEmail={() => openSheet(SHEETS.customer)}
        disabled={isSaving}
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

      {/* ── Mehr ── */}
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
            Nächster Schritt
          </button>
          <button type="button" className="cust-akte-more__btn" onClick={() => { closeSheet(); openSheet(SHEETS.offer); }}>
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
          <Field
            label="Notiz"
            id="lead-note"
            type="textarea"
            value={note}
            onChange={setNote}
            placeholder="Kurz notieren"
          />
          {!email.trim() && (
            <p className="dai-lead-tip">
              Mit E-Mail ist das Angebot später in Sekunden raus.
            </p>
          )}
          {!phone.trim() && (
            <p className="dai-lead-tip">
              Telefon ergänzt? Dann ist der Rückruf nur ein Klick.
            </p>
          )}
          {!name.trim() && (
            <p className="dai-lead-tip">
              Mit Namen wirkt die Chance persönlicher.
            </p>
          )}
          {telHref && (
            <a href={telHref} className="dai-btn dai-btn--call dai-btn--block">
              Anrufen
            </a>
          )}
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
        title="Nächster Schritt"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveNextSheet} saving={isSaving} />}
      >
        <p className="dai-lead-tip">Ein nächster Schritt hält die Chance warm.</p>
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

      <LeadDetailPanel
        open={activeSheet === SHEETS.antworten}
        onClose={closeSheet}
        title="Clever Nachrichten"
      >
        <CleverAntwortenSheet
          key={`${antwortenPreset ?? 'pick'}-${inboxItemIdForAntworten ?? 'none'}-${initialThreadId ?? 'thread'}`}
          lead={lead}
          customerName={name}
          phone={phone}
          email={email}
          vehicleCards={vehicleCards}
          offerSelectionGroups={resolvedSelectionGroups}
          kundenhelferNotes={kundenhelferNotes}
          wishPaymentType={wishPaymentType}
          initialTypeId={antwortenPreset}
          initialDraft={antwortenInitialDraft}
          inboxItemId={inboxItemIdForAntworten}
          initialThreadId={initialThreadId}
          initialMessageId={initialMessageId}
          relatedOfferId={questionContext?.offerId ?? initialAntwortenOfferId}
          relatedQuestionId={questionContext?.questionId}
          onInboxItemHandled={handleInboxItemHandled}
          onSendCleverMessage={handleSendCleverMessage}
          embedded
          onAddHistory={(text, type, options) => onAddHistory?.(text, type, options)}
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
