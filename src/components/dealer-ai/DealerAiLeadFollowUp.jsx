import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatReservedModelBadge,
  formatReservedModelName,
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
  computeAkteCleverStaerke,
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  hasVehicleOffer,
} from '../../services/customerAkte.js';
import {
  buildCleverActionRecommendation,
  cleverActionToHint,
  CLEVER_ACTION_IDS,
  formatCleverActionFollowedHistoryText,
} from '../../services/crm/cleverActionEngine.js';
import { countUnterlagenOpenTasks } from '../../services/cleverUnterlagen.js';
import { getHistoryEntryCount } from '../../services/customerAkteHistory.js';
import {
  buildOfferMailtoHref,
  buildOfferShareMessage,
  buildOfferWhatsappHref,
} from '../../services/vehicleOffer.js';
import { buildCleverAntwortenContext } from '../../services/cleverAntworten.js';
import CleverKundenhelferSheet from './CleverKundenhelferSheet.jsx';
import CleverAntwortenSheet from './CleverAntwortenSheet.jsx';
import CustomerAkteHeader from './CustomerAkteHeader.jsx';
import CustomerAkteActionBar from './CustomerAkteActionBar.jsx';
import CustomerAkteKundenhelfer from './CustomerAkteKundenhelfer.jsx';
import CustomerAkteEquipmentWishes from './CustomerAkteEquipmentWishes.jsx';
import CustomerAkteNextStep from './CustomerAkteNextStep.jsx';
import CustomerAkteBoard from './CustomerAkteBoard.jsx';
import CleverUnterlagenSheet from './CleverUnterlagenSheet.jsx';
import DealerAppLegalMenu from '../dealer/DealerAppLegalMenu.jsx';
import VehicleImage from '../shared/VehicleImage.jsx';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import './CustomerAkte.css';

const SHEETS = {
  customer: 'customer',
  wish: 'wish',
  next: 'next',
  offer: 'offer',
  models: 'models',
  outcome: 'outcome',
  history: 'history',
  kundenhelfer: 'kundenhelfer',
  unterlagen: 'unterlagen',
  antworten: 'antworten',
  vehicle: 'vehicle',
  more: 'more',
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
  const [showCardAnimation, setShowCardAnimation] = useState(isFresh);
  const [reservedModels, setReservedModels] = useState(crm.reservedModels ?? []);

  useEffect(() => {
    if (isFresh) {
      setShowCardAnimation(true);
      const timer = setTimeout(() => setShowCardAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isFresh]);

  useEffect(() => {
    setReservedModels(lead?.crm?.reservedModels ?? []);
  }, [lead?.crm?.reservedModels]);

  const [name, setName] = useState(lead?.contact?.name?.replace('Kunde (offen)', '') ?? fields.customerName ?? '');
  const [phone, setPhone] = useState(lead?.contact?.phone ?? '');
  const [email, setEmail] = useState(lead?.contact?.email ?? '');
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

  useEffect(() => {
    setKundenhelferNotes(lead?.crm?.kundenhelfer?.notes ?? '');
    setKundenhelferMemos(lead?.crm?.kundenhelfer?.voiceMemos ?? []);
  }, [lead?.crm?.kundenhelfer?.notes, lead?.crm?.kundenhelfer?.voiceMemos]);

  const history = useMemo(
    () => [...(lead?.history ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [lead?.history],
  );

  const telHref = phoneTelHref(phone);

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
    customerName: name,
  }), [lead, vehicleCards, name]);

  const nextBestStep = useMemo(
    () => cleverActionToHint(cleverRecommendation, { telHref }),
    [cleverRecommendation, telHref],
  );

  const unterlagenPaymentType = wishPaymentType !== 'unknown' ? wishPaymentType : lead?.paymentType;
  const unterlagenOpenCount = useMemo(
    () => countUnterlagenOpenTasks(lead, unterlagenPaymentType),
    [lead, unterlagenPaymentType],
  );
  const activitiesCount = useMemo(() => getHistoryEntryCount(history), [history]);
  const pipelineStatusLabel = getLeadStatusBadgeLabel(pipelineStatusId);

  const lastLoggedCleverActionRef = useRef(null);

  useEffect(() => {
    if (!cleverRecommendation?.actionId || !lead?.id) return;
    const logKey = `${lead.id}:${cleverRecommendation.actionId}`;
    if (lastLoggedCleverActionRef.current === logKey) return;
    lastLoggedCleverActionRef.current = logKey;
    onAddHistory?.(cleverRecommendation.analyticsText, 'clever_action', { silent: true });
  }, [cleverRecommendation, lead?.id, onAddHistory]);

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
    const next = reservedModels.map((m) => (
      m.id === card.id ? { ...m, isFavorite: !m.isFavorite } : m
    ));
    setReservedModels(next);
    setSelectedVehicleCard({ ...card, isFavorite: !card.isFavorite });
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
  }

  function openSheet(id) {
    setActiveSheet(id);
  }

  function openCleverAntworten(presetType = null) {
    setAntwortenPreset(presetType);
    openSheet(SHEETS.antworten);
  }

  function selectFollowUp(chip) {
    setNextStepId(chip.id);
    setFollowUpAt(computeFollowUpAt(chip.id));
  }

  function buildSavePayload(extraCrm = {}) {
    const nextLabel = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label ?? nextStepLabel;
    const outcomeChip = CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId);
    const vehicleLabel = [fields.brand ?? 'Kia', wishModel, wishTrim].filter(Boolean).join(' ').trim();

    return {
      contact: {
        name: name.trim() || 'Kunde (offen)',
        phone: phone.trim(),
        email: email.trim(),
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
        equipment: wishEquipment.trim(),
      },
      crm: {
        ...crm,
        pipelineStatusId,
        nextStepId,
        nextStepLabel: nextLabel,
        followUpAt,
        reservedModels,
        offers: crm.offers ?? [],
        kundenhelfer: {
          notes: kundenhelferNotes.trim(),
          voiceMemos: kundenhelferMemos,
        },
        lastOutcomeId: outcomeId ?? crm.lastOutcomeId,
        lastOutcomeLabel: outcomeChip?.label ?? crm.lastOutcomeLabel,
        ...extraCrm,
      },
    };
  }

  function save(meta = {}) {
    onSave?.(buildSavePayload(), meta);
  }

  function saveUnterlagen(unterlagenData, historyText, historyType = 'unterlagen') {
    onSave?.(buildSavePayload({ cleverUnterlagen: unterlagenData }), {
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

  function saveWishSheet() {
    save({ historyText: 'Kundenwunsch festgehalten', addFollowupHistory: false });
    closeSheet();
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
        address={lead?.crm?.address ?? lead?.contact?.address ?? ''}
        customerSince={lead?.createdAt}
        cleverScore={akteCleverScore}
        kundenhelferNotes={kundenhelferNotes}
        vehicleCardCount={vehicleCards.length}
        offersCount={resolvedOffers.length}
        hasNextStep={Boolean(nextStepId)}
        pipelineStatusLabel={pipelineStatusLabel}
        onBack={onDiscard}
        onEditCustomer={() => openSheet(SHEETS.customer)}
        telHref={telHref}
      />

      <CustomerAkteActionBar
        telHref={telHref}
        whatsappHref={cleverWhatsappHref}
        mailHref={cleverMailHref}
        email={email}
        onCleverAntwort={() => openCleverAntworten()}
        onUnterlagen={() => openSheet(SHEETS.unterlagen)}
        onActivities={() => openSheet(SHEETS.history)}
        unterlagenBadge={unterlagenOpenCount}
        activitiesBadge={activitiesCount}
      />

      <CustomerAkteKundenhelfer
        notes={kundenhelferNotes}
        onOpenSheet={() => openSheet(SHEETS.kundenhelfer)}
        variant="profile"
      />

      <CustomerAkteNextStep
        hint={nextBestStep}
        recommendation={nextBestStep}
        telHref={telHref}
        onAction={handleCleverAction}
        onFallback={() => openSheet(SHEETS.customer)}
        onUnterlagen={() => openSheet(SHEETS.unterlagen)}
      />

      <CustomerAkteBoard
        cards={vehicleCards}
        animateNew={showCardAnimation && vehicleCards.length > 0}
        onCardClick={openVehicleCard}
        onCardMenu={openVehicleCard}
        onAddVehicle={handleAddVehicle}
      />

      {(lead?.equipmentWishes?.length ?? 0) > 0 && (
        <div className="cust-akte-section cust-akte-section--subtle">
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
              {[selectedVehicleCard.trimLabel, formatVehicleCardConditions(selectedVehicleCard), formatVehicleCardPrice(selectedVehicleCard)]
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
        title="Verlauf"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {history.length === 0 ? (
          <p className="dai-lead-empty">Noch keine Einträge.</p>
        ) : (
          <ul className="dai-lead-history dai-lead-history--timeline">
            {history.map((entry) => (
              <li key={entry.id} className="dai-lead-history__item">
                <span className="dai-lead-history__when">{formatHistoryWhen(entry.at)}</span>
                <span className="dai-lead-history__text">{polishHistoryText(entry.text)}</span>
              </li>
            ))}
          </ul>
        )}
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
          onAddHistory={(text, type) => onAddHistory?.(text, type)}
        />
      </LeadDetailPanel>

      <CleverKundenhelferSheet
        open={activeSheet === SHEETS.kundenhelfer}
        onClose={closeSheet}
        notes={kundenhelferNotes}
        onNotesChange={setKundenhelferNotes}
        voiceMemos={kundenhelferMemos}
        onVoiceMemosChange={setKundenhelferMemos}
        onSave={saveKundenhelferSheet}
        isSaving={isSaving}
      />
    </section>
  );
}
