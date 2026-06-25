import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  buildWishConditionChips,
  computeAkteCleverStaerke,
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  hasVehicleOffer,
} from '../../services/customerAkte.js';
import { buildSpecialQuestionAkteChips } from '../../services/dealer/specialCustomerQuestionService.js';
import { saveSellerKnowledgeAnswerFromLead } from '../../services/admin/cleverKnowledgeAnswerService.js';
import CustomerSpecialQuestionAnswerSheet from './CustomerSpecialQuestionAnswerSheet.jsx';
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
import {
  buildOfferMailtoHref,
  buildOfferShareMessage,
  buildOfferWhatsappHref,
} from '../../services/vehicleOffer.js';
import { buildCleverAntwortenContext } from '../../services/cleverAntworten.js';
import {
  buildBoardItems,
  resolveOfferSelectionGroups,
  sanitizeOfferSelectionGroups,
} from '../../services/sales/offerSelectionGroup.js';
import { updateSelectionGroupVariant } from '../../services/sales/offerVariantConfigurator.js';
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
import CleverKundenhelferSheet from './CleverKundenhelferSheet.jsx';
import CleverAntwortenSheet from './CleverAntwortenSheet.jsx';
import CustomerAkteHeader from './CustomerAkteHeader.jsx';
import CustomerAkteActionBar from './CustomerAkteActionBar.jsx';
import CustomerAkteKundenhelfer from './CustomerAkteKundenhelfer.jsx';
import CustomerAkteWishConditions from './CustomerAkteWishConditions.jsx';
import CustomerAkteWishConditionsSheet from './CustomerAkteWishConditionsSheet.jsx';
import CustomerAkteEquipmentWishes from './CustomerAkteEquipmentWishes.jsx';
import CustomerAkteCleverBeratung from './CustomerAkteCleverBeratung.jsx';
import CustomerAkteUnterlagen from './CustomerAkteUnterlagen.jsx';
import CustomerAkteActivities from './CustomerAkteActivities.jsx';
import CustomerAkteActivityTimeline from './CustomerAkteActivityTimeline.jsx';
import { buildCleverBeratungAkteView } from '../../services/dealer/cleverConsultationAkte.js';
import CustomerAkteNextStep from './CustomerAkteNextStep.jsx';
import CustomerAkteBoard from './CustomerAkteBoard.jsx';
import CustomerAkteCleverAuswahlSheet from './CustomerAkteCleverAuswahlSheet.jsx';
import OfferVariantConfigurator from './OfferVariantConfigurator.jsx';
import CustomerAddressSheet from './CustomerAddressSheet.jsx';
import CleverUnterlagenSheet from './CleverUnterlagenSheet.jsx';
import CleverLexikon from '../backend/CleverLexikon.jsx';
import { addCustomKundenhelferChip } from '../../services/cleverKundenhelfer.js';
import { normalizeConversationNotes } from '../../services/kundenhelferConversationNotes.js';
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
  onOpenOfferEdit,
  onReturnToReview,
  onDiscard,
  onAddHistory,
  initialSheet = null,
  isSaving = false,
}) {
  const fields = parsed?.fields ?? {};
  const crm = lead?.crm ?? {};

  const [activeSheet, setActiveSheet] = useState(initialSheet);
  const [antwortenPreset, setAntwortenPreset] = useState(null);

  useEffect(() => {
    if (initialSheet) setActiveSheet(initialSheet);
  }, [initialSheet]);
  const [selectedVehicleCard, setSelectedVehicleCard] = useState(null);
  const [selectedSelectionGroup, setSelectedSelectionGroup] = useState(null);
  const [variantConfigureContext, setVariantConfigureContext] = useState(null);
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
  const [pipelineStatusId, setPipelineStatusId] = useState(crm.pipelineStatusId ?? 'neu');
  const [outcomeId, setOutcomeId] = useState(crm.lastOutcomeId ?? null);
  const [outcomeNote, setOutcomeNote] = useState('');

  const [kundenhelferNotes, setKundenhelferNotes] = useState(crm.kundenhelfer?.notes ?? '');
  const [kundenhelferMemos, setKundenhelferMemos] = useState(crm.kundenhelfer?.voiceMemos ?? []);
  const [conversationNotes, setConversationNotes] = useState(
    () => normalizeConversationNotes(crm.kundenhelfer?.conversationNotes),
  );
  const [tradeInData, setTradeInData] = useState(() => getTradeIn(lead));

  useEffect(() => {
    setKundenhelferNotes(lead?.crm?.kundenhelfer?.notes ?? '');
    setKundenhelferMemos(lead?.crm?.kundenhelfer?.voiceMemos ?? []);
    setConversationNotes(normalizeConversationNotes(lead?.crm?.kundenhelfer?.conversationNotes));
    setTradeInData(getTradeIn(lead));
  }, [
    lead?.crm?.kundenhelfer?.notes,
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

  const history = useMemo(
    () => [...(lead?.history ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [lead?.history],
  );

  const telHref = phoneTelHref(phone);

  const cleverBeratungView = useMemo(
    () => (lead ? buildCleverBeratungAkteView(lead) : null),
    [lead],
  );

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
    desiredDeliveryDate: wishDelivery,
    deliveryTime: wishDelivery,
  }), [fields.brand, wishModel, wishTrim, wishPaymentType, wishDesiredPrice, wishDesiredRate, wishTermMonths, wishMileage, wishDelivery]);

  const wishConditionChips = useMemo(() => {
    const base = buildWishConditionChips({
      paymentType: wishPaymentType,
      termMonths: wishSummaryFields.termMonths,
      mileagePerYear: wishSummaryFields.mileagePerYear,
      desiredRate: wishSummaryFields.desiredRate,
      desiredPrice: wishSummaryFields.desiredPrice,
      downPayment: lead?.wish?.downPayment ?? fields.downPayment ?? wishDownPayment ?? null,
      delivery: wishDelivery,
    });
    const specialChips = buildSpecialQuestionAkteChips(lead?.specialCustomerQuestion, {
      contactRequested: true,
      answered: Boolean(lead?.specialQuestionAnswer?.answerText),
    });
    return [...specialChips, ...base];
  }, [
    wishPaymentType,
    wishSummaryFields,
    lead?.wish?.downPayment,
    fields.downPayment,
    wishDownPayment,
    wishDelivery,
    lead?.specialCustomerQuestion,
    lead?.specialQuestionAnswer?.answerText,
  ]);

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
    kundenhelferNotes,
    vehicleCardCount: vehicleCards.length,
    offersCount: resolvedOffers.length,
    hasNextStep: Boolean(nextStepId),
  }), [name, phone, email, kundenhelferNotes, vehicleCards.length, resolvedOffers.length, nextStepId]);

  const cleverRecommendation = useMemo(() => buildCleverActionRecommendation({
    lead,
    vehicleCards,
    offerSelectionGroups: resolvedSelectionGroups,
    customerName: name,
  }), [lead, vehicleCards, resolvedSelectionGroups, name]);

  const nextBestStep = useMemo(
    () => cleverActionToHint(cleverRecommendation, { telHref }),
    [cleverRecommendation, telHref],
  );

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

  function logCustomerActivity(activity) {
    if (!activity?.text) return;
    onAddHistory?.(activity.text, activity.type ?? 'customer_activity', {
      silent: true,
      ...(activity.meta ?? {}),
    });
  }

  function openActivitiesSheet() {
    openSheet(SHEETS.history);
    onSave?.(buildSavePayload({
      activitiesLastSeenAt: new Date().toISOString(),
    }), { silent: true, addFollowupHistory: false });
  }

  function handleQuestionPersonalReply(item) {
    openCleverAntworten();
    if (item?.cleverAnswer) {
      setToast('Clever-Antwort in Clever Antwort übernommen – Text anpassen und senden.');
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
    kundenhelferNotes,
    wishPaymentType,
  }), [lead, name, phone, email, vehicleCards, kundenhelferNotes, wishPaymentType]);

  const primaryVehicleCard = vehicleCards[0];
  const cleverOfferShareMessage = useMemo(() => {
    if (!primaryVehicleCard) return '';
    const offer = primaryVehicleCard.vehicleOffer ?? {};
    return buildOfferShareMessage({
      customerName: name,
      vehicleTitle: formatVehicleCardTitle(primaryVehicleCard),
      url: offer.onlineLink?.url ?? '',
    });
  }, [primaryVehicleCard, name]);

  const cleverWhatsappHref = useMemo(
    () => buildOfferWhatsappHref(phone, cleverOfferShareMessage),
    [phone, cleverOfferShareMessage],
  );

  const cleverMailHref = useMemo(() => {
    if (!primaryVehicleCard) return null;
    return buildOfferMailtoHref(
      email,
      `Ihr Angebot: ${formatVehicleCardTitle(primaryVehicleCard)}`,
      cleverOfferShareMessage,
    );
  }, [email, primaryVehicleCard, cleverOfferShareMessage]);
  const vehicleTitleForUnterlagen = primaryVehicleCard
    ? formatVehicleCardTitle(primaryVehicleCard)
    : headSubline;
  const vehicleConditionsForUnterlagen = primaryVehicleCard
    ? formatVehicleCardConditions(primaryVehicleCard)
    : '';

  const nextStepLabel = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label ?? 'Morgen anrufen';

  const primaryOffer = resolvedOffers[0];
  const offerFeedback = primaryOffer ? getOfferMicroFeedback(primaryOffer.status) : null;

  function handleAddVehicle() {
    if (onStartNewWish) {
      onStartNewWish(lead);
      return;
    }
    onNewWish?.();
  }

  function openSelectionGroup(group) {
    setSelectedSelectionGroup(group);
    openSheet(SHEETS.cleverAuswahl);
  }

  function handlePrepareCustomerLink(group) {
    setToast('Kundenlink wird in einer späteren Version verfügbar sein.');
    setTimeout(() => setToast(''), 3500);
    onAddHistory?.(
      `Clever Auswahl für ${group.modelLabel} als Kundenlink vorbereitet`,
      'clever_auswahl',
      { silent: true },
    );
  }

  function handleEditSelectionVariant(group, variantSummary) {
    const fullVariant = group.variants?.find((v) => v.id === variantSummary.id) ?? variantSummary;
    logCustomerActivity(buildVariantViewedActivity({
      modelLabel: group.modelLabel,
      trimLabel: fullVariant.trimLabel,
    }));
    setVariantConfigureContext({ group, variant: fullVariant });
    closeSheet();
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

  function openVehicleCard(card) {
    if (onOpenOfferEdit) {
      onOpenOfferEdit(card);
      return;
    }
    setSelectedVehicleCard(card);
    openSheet(SHEETS.vehicle);
  }

  function handleVehicleOffer(card) {
    if (onOpenOfferEdit) {
      onOpenOfferEdit(card);
      return;
    }
    closeSheet();
    if (hasVehicleOffer(card) && card.offer?.code) {
      logCustomerActivity(buildDocumentOpenedActivity({
        documentLabel: `${card.modelName ?? 'Angebot'} geöffnet`,
        documentType: 'offer',
      }));
      window.location.assign(`/angebot/${encodeURIComponent(card.offer.code)}`);
      return;
    }
    if (card.source === 'reserved') {
      const model = reservedModels.find((m) => m.id === card.id);
      createOfferForModel(model ?? card);
      return;
    }
    onPrepareOffer?.();
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
    if (activeSheet === SHEETS.vehicle) {
      setSelectedVehicleCard(null);
    }
    if (activeSheet === SHEETS.cleverAuswahl) {
      setSelectedSelectionGroup(null);
    }
    if (variantConfigureContext) {
      setVariantConfigureContext(null);
    }
  }

  function openSheet(id) {
    setActiveSheet(id);
  }

  function openCleverAntworten(presetType = null) {
    setAntwortenPreset(presetType);
    openSheet(SHEETS.antworten);
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
  }

  function buildSavePayload(extraCrm = {}, addressOverride = null) {
    const nextLabel = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label ?? nextStepLabel;
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
        reservedModels,
        offerSelectionGroups: extraCrm.offerSelectionGroups ?? resolvedSelectionGroups,
        offers: crm.offers ?? [],
        kundenhelfer: {
          ...(crm.kundenhelfer ?? {}),
          ...(extraKundenhelfer ?? {}),
          notes: kundenhelferNotes.trim(),
          voiceMemos: kundenhelferMemos,
          conversationNotes,
        },
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
    save({
      historyText: 'Clever Kundenhelfer aktualisiert',
      addFollowupHistory: false,
    });
    closeSheet();
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

    const payload = buildSavePayload();
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
    const nextNotes = addCustomKundenhelferChip(kundenhelferNotes, chip);
    setKundenhelferNotes(nextNotes);
    onSave?.(buildSavePayload({
      kundenhelfer: {
        notes: nextNotes.trim(),
        voiceMemos: kundenhelferMemos,
      },
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

  function handleCleverAction(actionHint) {
    trackCleverActionFollowed(actionHint);
    const handler = actionHint?.handlerType ?? actionHint?.action;
    if (handler === 'selection_send') {
      const groupId = actionHint?.meta?.groupId;
      const group = groupId
        ? resolvedSelectionGroups.find((entry) => entry.id === groupId)
        : resolvedSelectionGroups[0];
      if (group) {
        openSelectionGroup(group);
      }
      return;
    }
    if (handler === 'offer_send') {
      const cardId = actionHint?.meta?.cardId;
      const card = cardId
        ? vehicleCards.find((c) => c.id === cardId)
        : vehicleCards[0];
      if (card) {
        handleVehicleOffer(card);
      } else {
        onPrepareOffer?.();
      }
      return;
    }
    if (handler === 'documents' || handler === 'leasing_submit' || handler === 'unterlagen') {
      openSheet(SHEETS.unterlagen);
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
        kundenhelferNotes={kundenhelferNotes}
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
        whatsappHref={cleverWhatsappHref}
        mailHref={cleverMailHref}
        email={email}
        onCleverAntwort={() => openCleverAntworten()}
        onUnterlagen={() => openSheet(SHEETS.unterlagen)}
        onActivities={openActivitiesSheet}
        unterlagenBadge={unterlagenOpenCount}
        activitiesBadge={activityDashboard.newCustomerActivities}
        activitiesBadgeDetail={activityDashboard}
      />

      <CustomerAkteKundenhelfer
        notes={kundenhelferNotes}
        conversationNotes={conversationNotes}
        onOpenSheet={() => openSheet(SHEETS.kundenhelfer)}
        variant="profile"
      />

      <CustomerAkteWishConditions
        chips={wishConditionChips}
        onEdit={() => openSheet(SHEETS.wishConditions)}
      />

      <div className="cust-akte-priority">
        <CustomerAkteNextStep
          hint={nextBestStep}
          recommendation={nextBestStep}
          telHref={telHref}
          onAction={handleCleverAction}
          onFallback={() => openSheet(SHEETS.customer)}
          onUnterlagen={() => openSheet(SHEETS.unterlagen)}
        />
      </div>

      <CustomerAkteBoard
        items={boardItems}
        lead={lead}
        animateNew={showCardAnimation && boardItems.length > 0}
        onCardClick={openVehicleCard}
        onCardMenu={openVehicleCard}
        onSelectionGroupClick={openSelectionGroup}
        onAddVehicle={handleAddVehicle}
      />

      <div className="cust-akte-tier-3-group">
        <CustomerAkteActivities
          history={history}
          lastSeenAt={activitiesLastSeenAt}
          onOpenHistory={openActivitiesSheet}
        />
        <CustomerAkteUnterlagen
          lead={lead}
          paymentType={unterlagenPaymentType}
          onOpen={() => openSheet(SHEETS.unterlagen)}
        />
      </div>

      {cleverBeratungView && (
        <div className="cust-akte-secondary">
          <CustomerAkteCleverBeratung
            view={cleverBeratungView}
            telHref={telHref}
            onPrepareOffer={handleCleverBeratungPrepareOffer}
            onCreateMessage={() => openCleverAntworten()}
            onChangeRecommendation={handleCleverBeratungChangeRecommendation}
          />
        </div>
      )}

      <CustomerAkteWishConditionsSheet
        open={activeSheet === SHEETS.wishConditions}
        onClose={closeSheet}
        values={wishEditValues}
        onApply={applyWishConditions}
        getBudgetFieldLabel={getBudgetFieldLabel}
        saving={isSaving}
      />

      {(lead?.equipmentWishes?.length ?? 0) > 0 && (
        <div className="cust-akte-secondary cust-akte-section--subtle">
          <CustomerAkteEquipmentWishes wishes={lead.equipmentWishes} />
        </div>
      )}

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
                onClick={() => handleVehicleOffer(selectedVehicleCard)}
              >
                {hasVehicleOffer(selectedVehicleCard) ? 'Angebot bearbeiten' : 'Angebot erstellen'}
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
            onChange={(e) => setFollowUpAt(new Date(e.target.value).toISOString())}
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
        title="Aktivitäten"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        <CustomerAkteActivityTimeline
          history={history}
          dashboard={activityDashboard}
          phone={phone}
          email={email}
          customerName={name}
          onPersonalReply={handleQuestionPersonalReply}
        />
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
        title="Clever Antworten"
      >
        <CleverAntwortenSheet
          key={antwortenPreset ?? 'pick'}
          lead={lead}
          customerName={name}
          phone={phone}
          email={email}
          vehicleCards={vehicleCards}
          kundenhelferNotes={kundenhelferNotes}
          wishPaymentType={wishPaymentType}
          initialTypeId={antwortenPreset}
          embedded
          onAddHistory={(text, type, options) => onAddHistory?.(text, type, options)}
        />
      </LeadDetailPanel>

      {variantConfigureContext && (
        <OfferVariantConfigurator
          group={variantConfigureContext.group}
          variant={variantConfigureContext.variant}
          lead={lead}
          wishConditionChips={wishConditionChips}
          equipmentWishes={lead?.equipmentWishes ?? []}
          wishEquipmentText={wishEquipment}
          onSave={handleVariantConfigureSave}
          onDuplicate={handleVariantConfigureDuplicate}
          onBack={handleVariantConfigureBack}
          isSaving={isSaving}
        />
      )}

      <LeadDetailPanel
        open={activeSheet === SHEETS.cleverAuswahl && Boolean(selectedSelectionGroup) && !variantConfigureContext}
        onClose={closeSheet}
        title="Clever Auswahl"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {selectedSelectionGroup && (
          <CustomerAkteCleverAuswahlSheet
            group={selectedSelectionGroup}
            onEditVariant={handleEditSelectionVariant}
            onPrepareCustomerLink={handlePrepareCustomerLink}
          />
        )}
      </LeadDetailPanel>

      <CustomerSpecialQuestionAnswerSheet
        open={activeSheet === SHEETS.specialQuestionAnswer}
        onClose={closeSheet}
        lead={lead}
        onSave={handleSaveSpecialQuestionAnswer}
        saving={isSaving}
      />

      <CleverKundenhelferSheet
        open={activeSheet === SHEETS.kundenhelfer}
        onClose={closeSheet}
        notes={kundenhelferNotes}
        onNotesChange={setKundenhelferNotes}
        voiceMemos={kundenhelferMemos}
        onVoiceMemosChange={setKundenhelferMemos}
        conversationNotes={conversationNotes}
        onConversationNotesChange={setConversationNotes}
        vehicleCards={vehicleCards}
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
