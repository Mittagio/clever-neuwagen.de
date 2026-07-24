/**
 * Kundenakte – Datenstruktur & Hilfen (Kunde → Verkaufschancen → Angebote)
 */
import { PAYMENT_TYPE_LABELS } from './dealerAiParser.js';
import {
  formatReservedModelBadge,
  formatReservedModelName,
} from './dealerAiLeadCrm.js';
import { parseKundenhelferNotes } from './cleverKundenhelfer.js';
import { buildCustomerUnderstanding } from './dealer/customerUnderstanding.js';
import { getCleverStaerkeTier } from './cleverStaerke.js';
import { VEHICLE_OFFER_STATUS_UI, enrichCardWithVehicleOffer, VEHICLE_OFFER_STATUS } from './vehicleOffer.js';
import { resolveEffectivePaymentType } from './dealer/offerEditWishMerge.js';
import {
  getCustomerOfferInteraction,
  resolveBoardBadge,
} from './customerOfferInteraction.js';
import { computeUnterlagenSummary } from './cleverUnterlagen.js';
import {
  getSelbstauskunft,
  needsSelbstauskunft,
  SELBSTAUSKUNFT_STATUS,
} from './cleverSelbstauskunft.js';

function hasCustomerName(name) {
  const trimmed = name?.trim();
  return Boolean(trimmed && trimmed !== 'Kunde (offen)' && trimmed !== 'Kunde noch offen');
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatCustomerSince(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Kunde seit heute';
  if (diffDays === 1) return 'Kunde seit gestern';
  return `Kunde seit ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export function getCustomerInitials(name = '') {
  const cleaned = String(name).trim().replace(/\s*\(.*\)\s*/g, '');
  if (!cleaned || cleaned === 'Kunde noch offen' || cleaned === 'Kunde (offen)') return 'KW';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function getCustomerFirstName(name = '') {
  const cleaned = String(name).trim().replace(/\s*\(.*\)\s*/g, '');
  if (!cleaned || cleaned.startsWith('Kunde')) return 'Ihr Kunde';
  return cleaned.split(/\s+/)[0];
}

export function formatCustomerContactLine(phone = '', email = '') {
  const parts = [phone?.trim(), email?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Clever-Stärke auf Kundenakte-Ebene (grobe Motivation, keine Pflichtlogik).
 */
export function computeAkteCleverStaerke({
  name = '',
  phone = '',
  email = '',
  lead = null,
  understandingLabelCount = null,
  kundenhelferNotes = '',
  vehicleCardCount = 0,
  offersCount = 0,
  hasNextStep = true,
} = {}) {
  let chipCount = 0;
  if (understandingLabelCount != null) {
    chipCount = understandingLabelCount;
  } else if (lead) {
    chipCount = buildCustomerUnderstanding(lead)?.verstaendnis?.labels?.length ?? 0;
  } else if (kundenhelferNotes) {
    chipCount = parseKundenhelferNotes(kundenhelferNotes).length;
  }
  let score = 0;
  if (hasCustomerName(name)) score += 20;
  if (phone?.trim()) score += 15;
  if (email?.trim()) score += 10;
  if (chipCount > 0) score += Math.min(15, chipCount * 5);
  if (vehicleCardCount > 0) score += 25;
  if (offersCount > 0) score += 10;
  if (hasNextStep) score += 5;
  return Math.min(100, score);
}

export function getCleverScoreRingVariant(score = 0) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  if (pct <= 40) return 'low';
  if (pct <= 70) return 'mid';
  if (pct <= 90) return 'high';
  return 'max';
}

export function getAkteCleverLabel(score) {
  return getCleverStaerkeTier(score);
}

function inferModelKey(modelName = '', fallback = 'suv') {
  const slug = String(modelName).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (slug.includes('ev9')) return 'ev9';
  if (slug.includes('ev6')) return 'ev6';
  if (slug.includes('ev5')) return 'ev5';
  if (slug.includes('ev4')) return 'ev4';
  if (slug.includes('ev3')) return 'ev3';
  if (slug.includes('ev2')) return 'ev2';
  if (slug.includes('esoul')) return 'esoul';
  if (slug.includes('sportage')) return 'sportage';
  if (slug.includes('sorento')) return 'sorento';
  if (slug.includes('stonic')) return 'stonic';
  return fallback || 'suv';
}

function paymentLabel(paymentType) {
  const raw = PAYMENT_TYPE_LABELS[paymentType] ?? paymentType;
  return String(raw)
    .replace(' / Barzahlung', '')
    .replace('Kauf / Barzahlung', 'Kauf')
    .replace('Leasing', 'Leasing')
    .trim();
}

function formatWishEuro(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('de-DE')} €`;
}

function formatWishKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('de-DE')} km`;
}

/**
 * Kompakte Chips für Wunschkonditionen auf Kundenakte-Ebene (Kundenwunsch, nicht Fahrzeug).
 */
export function buildWishConditionChips({
  paymentType = 'unknown',
  termMonths = null,
  mileagePerYear = null,
  desiredRate = null,
  desiredPrice = null,
  downPayment = null,
  delivery = '',
} = {}) {
  const pt = paymentType ?? 'unknown';
  const hasTerm = Number(termMonths) > 0;
  const hasMileage = Number(mileagePerYear) > 0;
  const hasRate = Number(desiredRate) > 0;
  const hasPrice = Number(desiredPrice) > 0;
  const hasDelivery = Boolean(String(delivery ?? '').trim());

  if (pt === 'unknown' && !hasTerm && !hasMileage && !hasRate && !hasPrice && !hasDelivery) {
    return [];
  }

  const chips = [];

  if (pt === 'leasing') chips.push('Leasing');
  else if (pt === 'cash') chips.push('Kauf');
  else if (pt === 'financing' || pt === 'threeWayFinancing') chips.push('Finanzierung');
  else if (pt !== 'unknown') chips.push(paymentLabel(pt));
  else chips.push('Angebotsart offen');

  if (pt === 'cash') {
    const price = formatWishEuro(desiredPrice);
    chips.push(price ? `bis ${price}` : 'Budget offen');
  } else if (pt !== 'unknown') {
    chips.push(hasTerm ? `${Number(termMonths)} Monate` : 'Laufzeit offen');
    if (pt === 'leasing') {
      const km = formatWishKm(mileagePerYear);
      chips.push(km ? `${km}/Jahr` : 'Kilometer offen');
    }
    const downNum = Number(downPayment);
    const downLabel = Number.isFinite(downNum)
      ? `${downNum.toLocaleString('de-DE')} €`
      : '0 €';
    chips.push(`${downLabel} Anzahlung`);
    const rate = formatWishEuro(desiredRate);
    if (rate) {
      chips.push(`bis ${rate}/Monat`);
    } else if (!(Number.isFinite(downNum) && downNum > 0)) {
      chips.push('Budget offen');
    }
  }

  const deliveryLabels = {
    sofort: 'Sofort',
    '1-3-monate': '1–3 Monate',
    '3-6-monate': '3–6 Monate',
  };
  const rawDelivery = String(delivery ?? '').trim();
  const deliveryText = rawDelivery
    ? (deliveryLabels[rawDelivery.toLowerCase()] ?? rawDelivery)
  : 'Egal';
  chips.push(`Liefertermin ${deliveryText}`);

  return chips;
}

/**
 * Klickbare Konditionen-Chips für die Kundenakte (harte Deal-Fakten).
 * Zahlungsart + Laufzeit · km · Anzahlung · Verfügbarkeit.
 * @returns {Array<{ id: string, label: string, field: string }>}
 */
export function buildSchnellaufnahmeChips({
  paymentType = 'unknown',
  termMonths = null,
  mileagePerYear = null,
  desiredRate = null,
  desiredPrice = null,
  downPayment = null,
  delivery = '',
} = {}) {
  const pt = paymentType ?? 'unknown';
  const hasTerm = Number(termMonths) > 0;
  const hasMileage = Number(mileagePerYear) > 0;
  const kmLabel = formatWishKm(mileagePerYear);
  const downNum = Number(downPayment);
  const hasDown = Number.isFinite(downNum) && String(downPayment ?? '').trim() !== '';

  const deliveryLabels = {
    sofort: 'Sofort',
    '1-3-monate': '1–3 Monate',
    '3-6-monate': '3–6 Monate',
  };
  const rawDelivery = String(delivery ?? '').trim();
  const deliveryText = rawDelivery
    ? (deliveryLabels[rawDelivery.toLowerCase()] ?? rawDelivery)
    : null;

  void desiredRate;
  void desiredPrice;

  let paymentLabelText = 'Zahlungsart offen';
  if (pt === 'leasing') paymentLabelText = 'Leasing';
  else if (pt === 'cash') paymentLabelText = 'Kauf';
  else if (pt === 'financing' || pt === 'threeWayFinancing') paymentLabelText = 'Finanzierung';
  else if (pt !== 'unknown') paymentLabelText = paymentLabel(pt);

  return [
    {
      id: 'paymentType',
      label: paymentLabelText,
      field: 'paymentType',
    },
    {
      id: 'termMonths',
      label: hasTerm ? String(Number(termMonths)) : 'Laufzeit offen',
      field: 'termMonths',
    },
    {
      id: 'mileagePerYear',
      label: hasMileage && kmLabel ? kmLabel : 'km offen',
      field: 'mileagePerYear',
    },
    {
      id: 'downPayment',
      label: hasDown
        ? `Anzahlung ${downNum.toLocaleString('de-DE')} €`
        : 'Anzahlung offen',
      field: 'downPayment',
    },
    {
      id: 'delivery',
      label: deliveryText
        ? `Verfügbarkeit ${deliveryText}`
        : 'Verfügbarkeit offen',
      field: 'delivery',
    },
  ];
}

/** Labels, die nur unter Konditionen leben – nicht am Notizzettel. */
export const KONDITIONEN_OWNED_NOTEPAD_LABELS = new Set([
  'Leasing',
  'Kauf',
  'Finanzierung',
  'Angebotsart offen',
  'Zahlungsart offen',
]);

/**
 * @param {string} label
 */
export function isKonditionenOwnedNotepadLabel(label = '') {
  const text = String(label ?? '').trim();
  if (!text) return false;
  if (KONDITIONEN_OWNED_NOTEPAD_LABELS.has(text)) return true;
  return false;
}

/**
 * Notizzettel-Chips ohne Konditionen-Doppelungen (Leasing/Kauf/…).
 * @param {Array<{ label: string }|string>} chips
 */
export function filterNotepadChipsExcludingKonditionen(chips = []) {
  return (chips ?? []).filter((chip) => {
    const label = typeof chip === 'string' ? chip : chip?.label;
    return !isKonditionenOwnedNotepadLabel(label);
  });
}

function findOfferForVehicle(offers = [], model = {}) {
  const modelName = (model.modelName ?? model.name ?? '').toLowerCase();
  return offers.find((o) => {
    const ov = (o.vehicle ?? o.name ?? '').toLowerCase();
    return ov && modelName && (ov.includes(modelName.replace(/^kia\s*/i, '')) || modelName.includes(ov));
  }) ?? null;
}

/**
 * @typedef {object} VehicleOpportunityCard
 * @property {string} id
 * @property {string} [leadId]
 * @property {string} modelKey
 * @property {string} modelName
 * @property {string} [trimLabel]
 * @property {string} bodyType
 * @property {string} paymentType
 * @property {number|null} [termMonths]
 * @property {number|null} [mileagePerYear]
 * @property {number|null} [desiredRate]
 * @property {number|null} [desiredPrice]
 * @property {object|null} [offer]
 * @property {boolean} isPrimary
 * @property {boolean} [isFavorite]
 * @property {string} [badge]
 * @property {'primary'|'reserved'|'related'} source
 */

/**
 * Baut Fahrzeugkarten für die Kundenakte aus Lead + vorgemerkten Modellen.
 * @returns {VehicleOpportunityCard[]}
 */
export function buildVehicleOpportunityCards({
  lead = null,
  wishFields = {},
  reservedModels = [],
  relatedLeads = [],
  offers = [],
} = {}) {
  const cards = [];
  const vehicleConfigurations = lead?.crm?.vehicleConfigurations ?? [];

  if (vehicleConfigurations.length > 0) {
    vehicleConfigurations.filter(Boolean).forEach((vc, index) => {
      const modelName = /^kia\b/i.test(vc.model ?? '')
        ? vc.model
        : `Kia ${vc.model ?? ''}`.trim();
      const paymentType = resolveEffectivePaymentType(
        vc.paymentType,
        wishFields.paymentType,
      );
      const termMonths = vc.leasingData?.termMonths
        ?? vc.financingData?.termMonths
        ?? wishFields.termMonths
        ?? null;
      const mileagePerYear = vc.leasingData?.mileagePerYear ?? wishFields.mileagePerYear ?? null;
      const hasCreatedOffer = vc.boardOffer?.status === 'offer_created';
      const desiredRate = vc.leasingData?.calculatedRate
        ?? vc.financingData?.calculatedRate
        ?? (hasCreatedOffer ? wishFields.desiredRate : null)
        ?? null;
      const desiredPrice = vc.cashPurchaseData?.calculatedPrice
        ?? (hasCreatedOffer ? wishFields.desiredPrice : null)
        ?? null;
      cards.push({
        id: vc.id ?? `vc-${index}`,
        leadId: lead?.id,
        modelKey: vc.modelKey ?? inferModelKey(vc.model),
        modelName: modelName || 'Kia',
        trimLabel: vc.trimLabel ?? wishFields.trimLabel ?? null,
        bodyType: 'suv',
        paymentType,
        termMonths,
        mileagePerYear,
        desiredRate,
        desiredPrice,
        offer: findOfferForVehicle(offers, { modelName, name: modelName }),
        isPrimary: index === 0,
        isFavorite: false,
        badge: index === 0 ? 'Empfehlung' : 'Weiterer Wunsch',
        source: 'configuration',
        configurationId: vc.id,
      });
    });
  } else if (reservedModels.length > 0) {
    reservedModels.filter(Boolean).forEach((model, index) => {
      const modelName = formatReservedModelName(model.name);
      cards.push({
        id: model.id ?? `reserved-${index}`,
        leadId: lead?.id,
        modelKey: model.modelKey ?? inferModelKey(model.name),
        modelName,
        trimLabel: model.trimLabel ?? wishFields.trimLabel ?? null,
        bodyType: model.bodyType ?? 'suv',
        paymentType: resolveEffectivePaymentType(wishFields.paymentType),
        termMonths: wishFields.termMonths ?? null,
        mileagePerYear: wishFields.mileagePerYear ?? null,
        desiredRate: wishFields.desiredRate ?? null,
        desiredPrice: wishFields.desiredPrice ?? null,
        offer: findOfferForVehicle(offers, { modelName, name: model.name }),
        isPrimary: Boolean(model.isPrimary || index === 0),
        isFavorite: Boolean(model.isFavorite),
        badge: formatReservedModelBadge(model, index),
        source: 'reserved',
      });
    });
  } else if (wishFields.model?.trim()) {
    const modelName = /^kia\b/i.test(wishFields.model)
      ? wishFields.model
      : `Kia ${wishFields.model}`;
    cards.push({
      id: lead?.id ?? 'primary-wish',
      leadId: lead?.id,
      modelKey: inferModelKey(wishFields.model),
      modelName,
      trimLabel: wishFields.trimLabel ?? null,
      bodyType: 'suv',
      paymentType: resolveEffectivePaymentType(wishFields.paymentType),
      termMonths: wishFields.termMonths ?? null,
      mileagePerYear: wishFields.mileagePerYear ?? null,
      desiredRate: wishFields.desiredRate ?? null,
      desiredPrice: wishFields.desiredPrice ?? null,
      offer: offers[0] ?? null,
      isPrimary: true,
      isFavorite: false,
      badge: null,
      source: 'primary',
    });
  }

  relatedLeads.forEach((rel) => {
    const model = rel.vehicle?.model;
    if (!model?.trim()) return;
    const modelName = /^kia\b/i.test(model) ? model : `Kia ${model}`;
    cards.push({
      id: rel.id,
      leadId: rel.id,
      modelKey: inferModelKey(model),
      modelName,
      trimLabel: rel.vehicle?.trim ?? null,
      bodyType: 'suv',
      paymentType: rel.paymentType ?? 'unknown',
      termMonths: rel.wish?.termMonths ?? null,
      mileagePerYear: rel.wish?.mileagePerYear ?? null,
      desiredRate: rel.desiredRate ?? null,
      desiredPrice: rel.wish?.desiredPrice ?? null,
      offer: rel.offerCode ? { code: rel.offerCode, status: 'draft' } : null,
      isPrimary: false,
      isFavorite: false,
      badge: 'Weiterer Wunsch',
      source: 'related',
    });
  });

  const vehicleOffers = lead?.crm?.vehicleOffers ?? {};
  return cards
    .filter(Boolean)
    .map((c) => enrichCardWithVehicleOffer(c, vehicleOffers))
    .map((c) => enrichCardWithBoardOffer(c, lead))
    .filter(Boolean);
}

function enrichCardWithBoardOffer(card = {}, lead = null) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const config = card.configurationId
    ? configs.find((entry) => entry.id === card.configurationId)
    : configs.find((entry) => entry.id === card.id);
  const boardOffer = config?.boardOffer ?? card.vehicleOffer?.boardOffer ?? null;
  if (!boardOffer && !config) return card;

  const payment = boardOffer?.payment ?? {};
  const paymentType = normalizeBoardPaymentType(config?.paymentType ?? card.paymentType);

  return {
    ...card,
    boardOffer,
    boardStatus: boardOffer?.status ?? card.vehicleOffer?.boardStatus ?? null,
    configurationId: config?.id ?? card.configurationId,
    colorId: config?.colorId ?? card.colorId,
    trimId: config?.trimId ?? card.trimId,
    selectedPackages: config?.selectedPackages ?? card.selectedPackages,
    downPayment: payment.downPayment ?? card.downPayment,
    finalRate: payment.finalRate ?? card.finalRate,
    listPrice: payment.listPrice ?? card.listPrice,
    discountPercent: payment.discountPercent ?? card.discountPercent,
    discountAmount: payment.discountAmount ?? card.discountAmount,
    desiredRate: payment.monthlyRate ?? (boardOffer?.status === 'offer_created' ? card.desiredRate : null),
    desiredPrice: payment.cashPrice ?? (boardOffer?.status === 'offer_created' ? card.desiredPrice : null),
    paymentType: paymentType && paymentType !== 'unknown' ? paymentType : card.paymentType,
    termMonths: payment.termMonths ?? card.termMonths,
    mileagePerYear: payment.mileagePerYear ?? card.mileagePerYear,
  };
}

function normalizeBoardPaymentType(paymentType = '') {
  if (paymentType === 'finance') return 'financing';
  return paymentType || 'leasing';
}

export function formatVehicleCardConditions(card = {}) {
  const pt = card.paymentType ?? 'unknown';
  const parts = [];

  if (pt === 'cash') {
    parts.push('Kauf');
  } else {
    if (card.termMonths) parts.push(`${card.termMonths} Monate`);
    if (card.mileagePerYear) {
      parts.push(`${Number(card.mileagePerYear).toLocaleString('de-DE')} km`);
    }
    if (!parts.length && pt !== 'unknown') {
      parts.push(paymentLabel(pt));
    }
  }

  return parts.join(' · ') || null;
}

/** Konditionen mit Mittelpunkt wie im Mockup */
export function formatVehicleCardConditionsDot(card = {}) {
  const pt = card.paymentType ?? 'unknown';
  const parts = [];
  if (pt !== 'cash' && card.termMonths) parts.push(`${card.termMonths} Monate`);
  if (pt !== 'cash' && card.mileagePerYear) {
    parts.push(`${Number(card.mileagePerYear).toLocaleString('de-DE')} km`);
  }
  return parts.join(' • ') || null;
}

export function formatVehicleCardPrice(card = {}) {
  const pt = card.paymentType ?? 'unknown';
  if (pt === 'cash' && card.desiredPrice) {
    return `${Number(card.desiredPrice).toLocaleString('de-DE')} € inkl. MwSt.`;
  }
  if (card.desiredRate) {
    const rate = `${Number(card.desiredRate).toLocaleString('de-DE')} € /Monat`;
    if (pt === 'finance') return `${rate} · Schlussrate offen`;
    return rate;
  }
  if (card.offer?.price) {
    return `${Number(card.offer.price).toLocaleString('de-DE')} €`;
  }
  if (pt !== 'unknown') return paymentLabel(pt);
  return null;
}

export function formatVehicleCardTitle(card) {
  const safe = card ?? {};
  const modelName = safe.modelName ?? 'Kia';
  const trim = safe.trimLabel?.trim();
  if (trim && !modelName.toLowerCase().includes(trim.toLowerCase())) {
    return `${modelName} ${trim}`;
  }
  return modelName;
}

/** Kurzlabel für CTAs, z. B. „EV4-Angebot senden“. */
export function formatVehicleActionPrefix(card = {}) {
  const title = formatVehicleCardTitle(card).replace(/^Kia\s+/i, '').trim();
  if (!title) return null;
  const parts = title.split(/\s+/);
  if (parts.length >= 2 && /^(Air|Earth|GT-Line|GT|Vision|Style|Winter|Connect)$/i.test(parts[1])) {
    return parts[0];
  }
  return parts.slice(0, 2).join(' ');
}

export function formatSelectionActionPrefix(group = {}) {
  const label = String(group?.modelLabel ?? group?.modelKey ?? '').replace(/^Kia\s+/i, '').trim();
  if (!label) return 'Auswahl';
  return label.split(/\s+/)[0];
}

/** Feste Status für „Auf dem Tisch“ – ruhige, klare Labels. */
export const TABLE_VEHICLE_STATUS = {
  idea: { label: 'Entwurf', tone: 'muted' },
  suggestion: { label: 'Entwurf', tone: 'muted' },
  configured: { label: 'Entwurf', tone: 'muted' },
  offer_prepared: { label: 'Entwurf', tone: 'muted' },
  sent: { label: 'Gesendet', tone: 'muted' },
  opened: { label: 'Geöffnet', tone: 'accent' },
  interested: { label: 'Interessiert', tone: 'accent' },
  question: { label: 'Frage offen', tone: 'warn' },
  rejected: { label: 'Abgelehnt', tone: 'muted' },
  closing_ready: { label: 'Abschlussbereit', tone: 'accent' },
};

function isCardClosingReady(card = {}, lead = null) {
  if (!lead) return false;
  const voStatus = card.vehicleOffer?.status ?? card.offer?.status;
  const pastOffer = [
    VEHICLE_OFFER_STATUS.SENT,
    VEHICLE_OFFER_STATUS.OPENED,
    VEHICLE_OFFER_STATUS.ACCEPTED,
  ].includes(voStatus);
  if (!pastOffer) return false;
  const pt = card.paymentType ?? lead?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, pt);
  if (!summary?.totalCount) return false;
  const selbstauskunft = getSelbstauskunft(lead?.crm?.cleverUnterlagen);
  const saOk = selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.completed.id
    || selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.checked.id;
  return summary.doneCount >= Math.max(1, summary.totalCount - 1) || saOk;
}

export function resolveVehicleStatus(card = {}, { lead = null } = {}) {
  const interaction = lead ? getCustomerOfferInteraction(lead, card.id) : null;
  const vehicleOffer = card.vehicleOffer ?? null;
  const closingReady = isCardClosingReady(card, lead);

  const badge = resolveBoardBadge(card, interaction, vehicleOffer, { closingReady });
  if (badge) {
    return {
      label: badge.label,
      tone: badge.tone,
      openQuestionCount: badge.openQuestionCount ?? 0,
    };
  }

  const voStatus = card.vehicleOffer?.status ?? card.offer?.status;

  if (closingReady) {
    return TABLE_VEHICLE_STATUS.closing_ready;
  }
  if (voStatus === VEHICLE_OFFER_STATUS.REJECTED) {
    return TABLE_VEHICLE_STATUS.rejected;
  }
  if (voStatus === VEHICLE_OFFER_STATUS.ACCEPTED) {
    return TABLE_VEHICLE_STATUS.interested;
  }
  if (voStatus === VEHICLE_OFFER_STATUS.OPENED) {
    return TABLE_VEHICLE_STATUS.opened;
  }
  if (voStatus === VEHICLE_OFFER_STATUS.SENT) {
    return TABLE_VEHICLE_STATUS.sent;
  }
  if (
    voStatus === VEHICLE_OFFER_STATUS.DRAFT
    || voStatus === VEHICLE_OFFER_STATUS.PDF_UPLOADED
    || voStatus === VEHICLE_OFFER_STATUS.LINK_READY
    || hasVehicleOffer(card)
    || voStatus === 'draft'
  ) {
    return TABLE_VEHICLE_STATUS.offer_prepared;
  }
  if (card.source === 'configuration') {
    return TABLE_VEHICLE_STATUS.configured;
  }
  if (card.badge === 'Vorschlag / prüfen' || /vorschlag/i.test(card.badge ?? '')) {
    return TABLE_VEHICLE_STATUS.suggestion;
  }
  return TABLE_VEHICLE_STATUS.idea;
}

export function formatPaymentBadge(paymentType = 'unknown') {
  const pt = paymentType ?? 'unknown';
  if (pt === 'cash') return { label: 'Kauf', tone: 'buy' };
  if (pt === 'leasing') return { label: 'Leasing', tone: 'lease' };
  if (pt === 'finance') return { label: 'Finanzierung', tone: 'lease' };
  if (pt === 'plugin-hybrid' || pt === 'hybrid') return { label: 'Hybrid', tone: 'lease' };
  return { label: paymentLabel(pt), tone: 'neutral' };
}

export function resolveVehicleFooter(card = {}, index = 0) {
  const vo = card.vehicleOffer;
  const openedAt = vo?.tracking?.lastOpenedAt ?? card.offer?.openedAt;
  const status = vo?.status ?? card.offer?.status;

  if ((status === 'opened' || status === VEHICLE_OFFER_STATUS.OPENED) && openedAt) {
    const d = new Date(openedAt);
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diffDays === 0) {
      return { label: `Gesehen heute ${time}`, tone: 'seen', icon: 'eye' };
    }
    if (diffDays === 1) {
      return { label: `Gesehen gestern ${time}`, tone: 'seen', icon: 'eye' };
    }
    return { label: `Gesehen ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`, tone: 'seen', icon: 'eye' };
  }
  if (status === 'sent') {
    return { label: 'Angebot gesendet', tone: 'seen', icon: 'eye' };
  }
  if (status === 'pdf_uploaded') {
    return { label: 'PDF hinterlegt', tone: 'alt', icon: 'clock' };
  }
  if (status === 'link_ready') {
    return { label: 'Link bereit zum Senden', tone: 'alt', icon: 'clock' };
  }
  if (card.isFavorite || (card.isPrimary && index === 0)) {
    return { label: 'Beliebteste Option', tone: 'favorite', icon: 'bulb' };
  }
  return { label: 'Alternative prüfen', tone: 'alt', icon: 'clock' };
}

export const KUNDENHELFER_CHIP_ICONS = {
  verheiratet: '💍',
  '2 Kinder': '👨‍👩‍👧',
  Eigenheim: '🏠',
  Hund: '🐕',
  'Einkommen ca. 3.000 €': '💶',
  'Kaffee schwarz': '☕',
  'mag rote Autos': '🚗',
  'Kofferraum wichtig': '🧳',
  'braucht Auto sofort': '⚡',
  'Unfall / Ersatzfahrzeug': '🛠️',
  'Leasing läuft aus': '📅',
  'entscheidet mit Partner': '👥',
  Gewerbekunde: '🏢',
  'bevorzugt WhatsApp': '💬',
  'Finanzierung offen': '🏦',
  'Inzahlungnahme vorhanden': '🔄',
  AHK: '🚛',
};

export function getKundenhelferChipIcon(chip = '') {
  return KUNDENHELFER_CHIP_ICONS[chip] ?? '•';
}

export function buildNextBestStepHint({
  customerName = '',
  vehicleCards = [],
  telHref = null,
  lead = null,
} = {}) {
  const firstName = getCustomerFirstName(customerName);
  const withOpened = vehicleCards.find((c) => c.offer?.status === 'opened');
  const withSent = vehicleCards.find((c) => c.offer?.status === 'sent');
  const primaryCard = withOpened ?? withSent ?? vehicleCards[0];
  const paymentType = primaryCard?.paymentType ?? lead?.paymentType;
  const unterlagenSummary = lead ? computeUnterlagenSummary(lead, paymentType) : null;
  const selbstauskunft = lead ? getSelbstauskunft(lead?.crm?.cleverUnterlagen) : null;
  const saComplete = selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.completed.id
    || selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.checked.id;

  if (withOpened || withSent) {
    if (saComplete && (selbstauskunft.uploadCount ?? 0) > 0) {
      return {
        text: 'Unterlagen sind da. Bankanfrage kann vorbereitet werden.',
        cta: 'Unterlagen öffnen',
        action: 'unterlagen',
      };
    }
    if (unterlagenSummary && unterlagenSummary.doneCount >= Math.max(2, unterlagenSummary.totalCount - 1)) {
      return {
        text: 'Unterlagen sehen gut aus. Bankanfrage kann vorbereitet werden.',
        cta: 'Unterlagen öffnen',
        action: 'unterlagen',
      };
    }
    if (withOpened) {
      const title = formatVehicleCardTitle(withOpened).replace(/^Kia\s*/i, '');
      return {
        text: `${firstName} hat das ${title}-Angebot kürzlich geöffnet. Ein kurzer Anruf erhöht die Chance deutlich.`,
        cta: 'Jetzt anrufen',
        canCall: Boolean(telHref),
      };
    }
    if (needsSelbstauskunft(paymentType)) {
      return {
        text: 'Bereit für den nächsten Schritt? Selbstauskunft-Link senden und Abschluss vorbereiten.',
        cta: 'Selbstauskunft-Link senden',
        action: 'unterlagen',
      };
    }
    return {
      text: 'Bereit für den nächsten Schritt? Unterlagen-Link senden und Abschluss vorbereiten.',
      cta: 'Unterlagen-Link senden',
      action: 'unterlagen',
    };
  }
  if (vehicleCards.length > 0) {
    return {
      text: `${vehicleCards.length} Option${vehicleCards.length > 1 ? 'en' : ''} liegen bereit. Jetzt kann daraus ein Angebot werden.`,
      cta: telHref ? 'Jetzt anrufen' : 'Kunde kontaktieren',
      canCall: Boolean(telHref),
    };
  }
  return {
    text: 'Ein passendes Auto auf dem Tisch macht das Gespräch leichter.',
    cta: telHref ? 'Jetzt anrufen' : 'Kunde ergänzen',
    canCall: Boolean(telHref),
  };
}

export function formatWhatsappHref(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function formatVehicleCardsReadyMessage(count, customerName = '') {
  if (count <= 0) return null;
  const name = customerName?.trim();
  if (count === 1) return 'Ein Auto liegt bereit.';
  if (name && name !== 'Kunde noch offen') {
    return `${count} Fahrzeuge für ${name} vorgemerkt.`;
  }
  return `${count} Optionen liegen bereit.`;
}

export function hasVehicleOffer(card = {}) {
  return Boolean(card.offer?.code || card.offer?.id);
}
