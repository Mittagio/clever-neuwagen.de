/**
 * Angebots-Arbeitsbereich („Auf dem Tisch“) – Status & Darstellung pro Fahrzeugkarte.
 */
import { PAYMENT_TYPE_LABELS } from '../dealerAiParser.js';
import { buildWishConditionsFromLeadAndFields } from '../sales/wishConditionsSync.js';
import {
  countOpenQuestions,
  getCustomerOfferInteraction,
  INTEREST_STATUS,
} from '../customerOfferInteraction.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

export const BOARD_OFFER_STATUS = {
  DRAFT: 'draft',
  OFFER_CREATED: 'offer_created',
  OFFER_SENT: 'offer_sent',
  QUESTION_OPEN: 'question_open',
  INTERESTED: 'interested',
  DECLINED: 'declined',
};

export const BOARD_OFFER_BADGE = {
  [BOARD_OFFER_STATUS.DRAFT]: { label: 'ENTWURF', tone: 'draft' },
  [BOARD_OFFER_STATUS.OFFER_CREATED]: { label: 'ANGEBOT ERSTELLT', tone: 'created' },
  [BOARD_OFFER_STATUS.OFFER_SENT]: { label: 'GESENDET', tone: 'sent' },
  [BOARD_OFFER_STATUS.QUESTION_OPEN]: { label: 'FRAGE OFFEN', tone: 'question' },
  [BOARD_OFFER_STATUS.INTERESTED]: { label: 'INTERESSE', tone: 'interest' },
  [BOARD_OFFER_STATUS.DECLINED]: { label: 'ABGELEHNT', tone: 'declined' },
};

function formatPaymentTypeLabel(paymentType = '') {
  return PAYMENT_TYPE_LABELS[paymentType] ?? PAYMENT_TYPE_LABELS.leasing;
}

const CASH_BADGE = { label: 'BARANGEBOT ERSTELLT', tone: 'cash' };
const FINANCE_BADGE = { label: 'FINANZIERUNG ERSTELLT', tone: 'created' };

function normalizePaymentType(paymentType = '') {
  if (paymentType === 'finance') return 'financing';
  if (paymentType === 'cash') return 'cash';
  return paymentType || 'leasing';
}

function findVehicleConfiguration(lead, card = {}) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  if (card.configurationId) {
    return configs.find((entry) => entry.id === card.configurationId) ?? null;
  }
  return configs.find((entry) => entry.id === card.id) ?? null;
}

function readPaymentSnapshot(card = {}, config = null, vehicleOffer = null) {
  const boardOffer = config?.boardOffer ?? vehicleOffer?.boardOffer ?? card.boardOffer ?? null;
  if (boardOffer?.payment) {
    return {
      ...boardOffer.payment,
      type: boardOffer.payment.type ?? normalizePaymentType(card.paymentType),
    };
  }

  const paymentType = normalizePaymentType(
    config?.paymentType ?? card.paymentType ?? 'leasing',
  );

  if (paymentType === 'cash') {
    const cash = config?.cashPurchaseData ?? {};
    return {
      type: 'cash',
      listPrice: cash.listPrice ?? cash.upe ?? null,
      discountPercent: cash.discountPercent ?? null,
      discountAmount: cash.discountAmount ?? null,
      cashPrice: cash.calculatedPrice ?? null,
      transferCost: cash.transferCost ?? null,
    };
  }

  if (paymentType === 'financing') {
    const fin = config?.financingData ?? {};
    return {
      type: 'financing',
      termMonths: fin.termMonths ?? card.termMonths ?? null,
      downPayment: fin.downPayment ?? card.downPayment ?? 0,
      monthlyRate: fin.calculatedRate ?? null,
      finalRate: fin.finalRate ?? fin.balloonPayment ?? null,
      listPrice: fin.listPrice ?? null,
    };
  }

  const leasing = config?.leasingData ?? {};
  return {
    type: 'leasing',
    termMonths: leasing.termMonths ?? card.termMonths ?? null,
    mileagePerYear: leasing.mileagePerYear ?? card.mileagePerYear ?? null,
    downPayment: leasing.downPayment ?? card.downPayment ?? 0,
    monthlyRate: leasing.calculatedRate ?? null,
    listPrice: leasing.listPrice ?? null,
  };
}

export function hasCalculatedOfferPayment(payment = {}) {
  if (payment.type === 'cash') {
    return payment.cashPrice != null && Number.isFinite(Number(payment.cashPrice));
  }
  return payment.monthlyRate != null && Number.isFinite(Number(payment.monthlyRate));
}

export function isBoardOfferSendable(card = {}, lead = null) {
  const model = buildBoardOfferCardModel(card, lead);
  return model.sendable;
}

export function resolveBoardOfferStatus(card = {}, lead = null) {
  const interaction = lead ? getCustomerOfferInteraction(lead, card.id) : null;
  const vehicleOffer = card.vehicleOffer ?? null;
  const config = findVehicleConfiguration(lead, card);
  const payment = readPaymentSnapshot(card, config, vehicleOffer);
  const openQuestions = countOpenQuestions(interaction);

  if (openQuestions > 0) return BOARD_OFFER_STATUS.QUESTION_OPEN;

  if (interaction?.interestStatus === INTEREST_STATUS.INTERESTED
    || vehicleOffer?.status === VEHICLE_OFFER_STATUS.ACCEPTED) {
    return BOARD_OFFER_STATUS.INTERESTED;
  }

  if (interaction?.interestStatus === INTEREST_STATUS.NOT_INTERESTED
    || vehicleOffer?.status === VEHICLE_OFFER_STATUS.REJECTED) {
    return BOARD_OFFER_STATUS.DECLINED;
  }

  if (
    vehicleOffer?.status === VEHICLE_OFFER_STATUS.SENT
    || vehicleOffer?.status === VEHICLE_OFFER_STATUS.OPENED
  ) {
    return BOARD_OFFER_STATUS.OFFER_SENT;
  }

  const explicitStatus = config?.boardOffer?.status
    ?? vehicleOffer?.boardStatus
    ?? card.boardStatus;

  if (explicitStatus === BOARD_OFFER_STATUS.OFFER_CREATED && hasCalculatedOfferPayment(payment)) {
    return BOARD_OFFER_STATUS.OFFER_CREATED;
  }

  if (hasCalculatedOfferPayment(payment) && explicitStatus !== BOARD_OFFER_STATUS.DRAFT) {
    return BOARD_OFFER_STATUS.OFFER_CREATED;
  }

  return BOARD_OFFER_STATUS.DRAFT;
}

function formatCurrency(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function formatMileage(km) {
  if (km == null) return null;
  return `${Number(km).toLocaleString('de-DE')} km/Jahr`;
}

function formatDownPayment(value) {
  if (value == null) return null;
  return `${Number(value).toLocaleString('de-DE')} € Anzahlung`;
}

function formatLastEdited(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `zuletzt bearbeitet heute ${time}`;
  return `zuletzt bearbeitet ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function buildConditionChips(payment = {}) {
  const chips = [];
  if (payment.type === 'cash') {
    chips.push({ id: 'cash', label: 'Barangebot' });
    if (payment.discountPercent != null) {
      chips.push({ id: 'discount', label: `${payment.discountPercent} % Rabatt` });
    } else if (payment.discountAmount != null) {
      chips.push({ id: 'discount', label: `${formatCurrency(payment.discountAmount)} Rabatt` });
    }
    return chips;
  }

  if (payment.termMonths) {
    chips.push({ id: 'term', label: `${payment.termMonths} Monate` });
  }
  if (payment.mileagePerYear) {
    chips.push({ id: 'mileage', label: formatMileage(payment.mileagePerYear) });
  }
  if (payment.downPayment != null) {
    chips.push({
      id: 'down',
      label: Number(payment.downPayment) === 0 ? '0 € Anzahlung' : formatDownPayment(payment.downPayment),
    });
  }
  if (payment.type === 'financing' && payment.finalRate != null) {
    chips.push({ id: 'final', label: `Schlussrate ${formatCurrency(payment.finalRate)}` });
  }
  return chips;
}

function buildPrimaryResult(payment = {}) {
  if (payment.type === 'cash') {
    return payment.cashPrice != null
      ? { value: formatCurrency(payment.cashPrice), suffix: 'Kaufpreis', kind: 'cash' }
      : null;
  }
  if (payment.monthlyRate != null) {
    return {
      value: `${Number(payment.monthlyRate).toLocaleString('de-DE')} €`,
      suffix: '/Monat',
      kind: 'rate',
    };
  }
  return null;
}

function resolveBadge(status, payment = {}) {
  if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
    return BOARD_OFFER_BADGE[BOARD_OFFER_STATUS.QUESTION_OPEN];
  }
  if (status === BOARD_OFFER_STATUS.DRAFT) {
    return BOARD_OFFER_BADGE[BOARD_OFFER_STATUS.DRAFT];
  }
  if (payment.type === 'cash' && status === BOARD_OFFER_STATUS.OFFER_CREATED) {
    return CASH_BADGE;
  }
  if (payment.type === 'financing' && status === BOARD_OFFER_STATUS.OFFER_CREATED) {
    return FINANCE_BADGE;
  }
  return BOARD_OFFER_BADGE[status] ?? BOARD_OFFER_BADGE[BOARD_OFFER_STATUS.DRAFT];
}

function buildDraftBudgetHint(lead, paymentType = 'leasing') {
  if (!lead) return null;
  const wish = buildWishConditionsFromLeadAndFields(lead, {});
  if (paymentType === 'cash' && wish.desiredPrice != null) {
    return `Kundenwunsch: bis ${formatCurrency(wish.desiredPrice)}`;
  }
  if (wish.desiredRate != null) {
    return `Kundenwunsch: bis ${Number(wish.desiredRate).toLocaleString('de-DE')} €/Monat`;
  }
  return null;
}

function buildPackageLine(config = null, card = {}) {
  const packages = config?.selectedPackages ?? card.selectedPackages ?? [];
  if (!packages.length) return null;
  const first = packages[0];
  const label = typeof first === 'string' ? first : first?.label ?? first?.name;
  if (!label) return null;
  return packages.length > 1 ? `Pakete: ${label} +${packages.length - 1}` : `Paket: ${label}`;
}

/**
 * Primäre Kartenaktion für Klick und Haupt-CTA – abhängig vom Angebotsstatus.
 */
export function resolveBoardOfferPrimaryAction(card = {}, lead = null) {
  const status = resolveBoardOfferStatus(card, lead);
  const config = findVehicleConfiguration(lead, card);
  const payment = readPaymentSnapshot(card, config, card.vehicleOffer ?? null);

  if (status === BOARD_OFFER_STATUS.DRAFT || !hasCalculatedOfferPayment(payment)) {
    return { id: 'create_offer', label: 'Angebot erstellen', handlerType: 'create_offer' };
  }
  if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
    return { id: 'answer_question', label: 'Frage beantworten', handlerType: 'answer_question' };
  }
  if (status === BOARD_OFFER_STATUS.INTERESTED) {
    return { id: 'view_proposal', label: 'Reaktion ansehen', handlerType: 'view_proposal' };
  }
  if (status === BOARD_OFFER_STATUS.DECLINED) {
    return { id: 'view_proposal', label: 'Angebot ansehen', handlerType: 'view_proposal' };
  }
  if (status === BOARD_OFFER_STATUS.OFFER_SENT) {
    return { id: 'view_proposal', label: 'Kundenlink ansehen', handlerType: 'view_proposal' };
  }
  if (status === BOARD_OFFER_STATUS.OFFER_CREATED) {
    return { id: 'edit_offer', label: 'Bearbeiten', handlerType: 'edit_offer' };
  }
  return { id: 'create_offer', label: 'Angebot erstellen', handlerType: 'create_offer' };
}

function buildBoardOfferSecondaryActions(status, { openQuestionCount = 0 } = {}) {
  const duplicate = { id: 'duplicate', label: 'Duplizieren', handlerType: 'duplicate_offer' };
  const remove = { id: 'remove', label: 'Entfernen', handlerType: 'remove_offer' };
  const send = { id: 'send', label: 'Senden', handlerType: 'send_offer' };
  const edit = { id: 'edit', label: 'Bearbeiten', handlerType: 'edit_offer' };
  const viewProposal = { id: 'view_proposal', label: 'Angebot ansehen', handlerType: 'view_proposal' };

  if (status === BOARD_OFFER_STATUS.DRAFT) {
    return [];
  }
  if (status === BOARD_OFFER_STATUS.OFFER_CREATED) {
    return [duplicate, remove, send];
  }
  if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
    const actions = [viewProposal, duplicate, remove];
    if (openQuestionCount === 0) return [duplicate, remove];
    return actions;
  }
  if (status === BOARD_OFFER_STATUS.OFFER_SENT
    || status === BOARD_OFFER_STATUS.INTERESTED
    || status === BOARD_OFFER_STATUS.DECLINED) {
    return [edit, duplicate, remove];
  }
  return [duplicate, remove];
}

export function buildBoardOfferFromDraft(offerDraft, { configId, now = new Date().toISOString() } = {}) {
  const { payment, vehicle } = offerDraft;
  const paymentType = normalizePaymentType(payment.type);
  const hasCalculated = payment.calculatedRate != null;

  const paymentSnapshot = {
    type: paymentType,
    termMonths: payment.termMonths ?? null,
    mileagePerYear: payment.mileagePerYear ?? null,
    downPayment: payment.downPayment ?? 0,
    monthlyRate: paymentType === 'cash' ? null : payment.calculatedRate ?? null,
    finalRate: payment.balloonPayment ?? payment.finalRate ?? null,
    listPrice: payment.listPrice ?? payment.upe ?? null,
    discountPercent: payment.discountPercent ?? null,
    discountAmount: payment.discountAmount ?? null,
    cashPrice: paymentType === 'cash' ? payment.calculatedRate ?? null : null,
    transferCost: payment.transferCost ?? null,
  };

  return {
    id: configId ?? `bo-${Date.now()}`,
    type: 'vehicle_offer',
    status: hasCalculated ? BOARD_OFFER_STATUS.OFFER_CREATED : BOARD_OFFER_STATUS.DRAFT,
    vehicle: {
      brand: vehicle.brand ?? 'Kia',
      modelKey: vehicle.modelKey,
      modelLabel: vehicle.model,
      trimLabel: vehicle.trimLabel,
      colorLabel: vehicle.color,
      packages: vehicle.selectedPackages ?? [],
      extras: vehicle.selectedEquipmentFeatures ?? [],
    },
    payment: paymentSnapshot,
    calculatedAt: hasCalculated ? now : null,
    updatedAt: now,
    sentAt: null,
    source: 'customer_akte',
  };
}

export function buildBoardOfferCardModel(card = {}, lead = null) {
  const config = findVehicleConfiguration(lead, card);
  const vehicleOffer = card.vehicleOffer ?? null;
  const payment = readPaymentSnapshot(card, config, vehicleOffer);
  const status = resolveBoardOfferStatus(card, lead);
  const isDraft = status === BOARD_OFFER_STATUS.DRAFT;
  const hasCalculated = hasCalculatedOfferPayment(payment);
  const interaction = lead ? getCustomerOfferInteraction(lead, card.id) : null;
  const openQuestionCount = countOpenQuestions(interaction);
  const paymentType = payment.type ?? normalizePaymentType(card.paymentType);
  const updatedAt = config?.boardOffer?.updatedAt
    ?? vehicleOffer?.updatedAt
    ?? config?.updatedAt
    ?? config?.createdAt
    ?? null;

  const primaryAction = resolveBoardOfferPrimaryAction(card, lead);
  const secondaryActions = buildBoardOfferSecondaryActions(status, { openQuestionCount });

  return {
    cardId: card.id,
    status,
    isDraft,
    sendable: !isDraft && hasCalculated && status !== BOARD_OFFER_STATUS.DECLINED,
    badge: resolveBadge(status, payment),
    paymentTypeLabel: formatPaymentTypeLabel(paymentType),
    conditionChips: isDraft ? [] : buildConditionChips(payment),
    primaryResult: isDraft ? null : buildPrimaryResult(payment),
    metaLine: isDraft
      ? 'Noch kein Angebot erstellt'
      : formatLastEdited(updatedAt),
    listPriceLine: !isDraft && payment.listPrice != null
      ? `UPE ${formatCurrency(payment.listPrice)}`
      : null,
    upeLine: !isDraft && payment.type === 'cash' && payment.listPrice != null
      ? formatCurrency(payment.listPrice)
      : null,
    discountLine: !isDraft && payment.type === 'cash' && payment.discountPercent != null
      ? `${payment.discountPercent} % Rabatt`
      : null,
    budgetHint: isDraft ? buildDraftBudgetHint(lead, paymentType) : null,
    packageLine: buildPackageLine(config, card),
    openQuestionCount,
    questionHint: openQuestionCount > 0
      ? `${openQuestionCount} Frage${openQuestionCount > 1 ? 'n' : ''} offen`
      : null,
    primaryAction,
    secondaryActions,
    payment,
  };
}

export function duplicateVehicleConfiguration(config = {}, { newId = `vc-${Date.now()}` } = {}) {
  const now = new Date().toISOString();
  const clone = JSON.parse(JSON.stringify(config));
  return {
    ...clone,
    id: newId,
    boardOffer: clone.boardOffer
      ? {
        ...clone.boardOffer,
        id: `bo-${newId}`,
        status: BOARD_OFFER_STATUS.OFFER_CREATED,
        calculatedAt: clone.boardOffer.calculatedAt ?? now,
        updatedAt: now,
        sentAt: null,
      }
      : null,
    createdAt: now,
    updatedAt: now,
  };
}

export function countSendableBoardItems(boardItems = [], lead = null) {
  return boardItems.filter((item) => {
    if (item.type === 'selection_group') return true;
    return isBoardOfferSendable(item.card, lead);
  }).length;
}

export function filterSendableVehicleCards(vehicleCards = [], lead = null) {
  return vehicleCards.filter((card) => isBoardOfferSendable(card, lead));
}
