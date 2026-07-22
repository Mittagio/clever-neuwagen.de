/**
 * Optionale Anreicherung vor der Wunschübergabe-Kontaktstrecke.
 * Wiederverwendet bestehende Purchase-/Sonderkonditions-Optionen.
 */
import {
  CASH_TIMING_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FINANCE_BALLOON_OPTIONS,
  FINANCE_TERM_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
  PAYMENT_TYPE_CARDS,
} from '../dealer/purchaseTypeFormOptions.js';
import { SPECIAL_CONDITION_OPTIONS } from '../dealer/specialConditionOptions.js';

/** Wann brauchen Sie das Fahrzeug? */
export const VEHICLE_NEED_TIMING_OPTIONS = [
  { id: 'asap', label: 'Sobald wie möglich' },
  { id: '1m', label: 'Innerhalb 1 Monat' },
  { id: '3m', label: 'In 2–3 Monaten' },
  { id: 'open', label: 'Noch unklar' },
];

/** Kauf / Leasing / Finanzierung (+ Überspringen) */
export const ACQUISITION_OPTIONS = [
  ...PAYMENT_TYPE_CARDS.map((card) => ({
    id: card.id === 'cash' ? 'purchase' : card.id,
    label: card.id === 'cash' ? 'Kauf' : card.label,
    subline: card.subline,
  })),
  { id: 'open', label: 'Noch offen', subline: 'später klären' },
];

/** Sonderkonditionen bei Kauf – Kernliste für öffentlichen Intake */
export const PURCHASE_SPECIAL_OPTIONS = SPECIAL_CONDITION_OPTIONS.filter((option) => (
  ['privat', 'gewerbe', 'freiberufler', 'corporateBenefits', 'schwerbehindert', 'oeffentlicherDienst']
    .includes(option.id)
));

export {
  LEASING_TERM_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FINANCE_TERM_OPTIONS,
  FINANCE_BALLOON_OPTIONS,
  CASH_TIMING_OPTIONS,
};

/** Inzahlungnahme – öffentliche Labels + Notizzettel-Text */
export const HANDOFF_TRADE_IN_OPTIONS = [
  { id: 'yes', label: 'Ja', notepadLabel: 'Inzahlungnahme' },
  { id: 'maybe', label: 'Vielleicht', notepadLabel: 'Inzahlungnahme offen' },
  { id: 'no', label: 'Nein', notepadLabel: 'Ohne Inzahlungnahme' },
];

export function emptyWishHandoffEnrichment() {
  return {
    vehicleNeedTiming: null,
    acquisitionType: null,
    specialConditionId: null,
    tradeIn: null,
    leasing: {
      termId: null,
      mileageId: null,
      downPayment: null,
    },
    finance: {
      termId: null,
      downPayment: null,
      desiredRate: '',
      balloon: null,
    },
  };
}

/**
 * Vorschläge aus dem bisherigen Gespräch vorausfüllen.
 * @param {object} [needProfile]
 * @param {string[]} [notepadLabels]
 */
export function prefillWishHandoffEnrichment(needProfile = {}, notepadLabels = []) {
  const base = emptyWishHandoffEnrichment();
  const payment = needProfile?.budget?.paymentType;
  const blob = [...(notepadLabels ?? []), ...(needProfile?.understoodLabels ?? [])]
    .join(' ')
    .toLowerCase();

  if (payment === 'leasing' || /\bleasing\b/.test(blob)) {
    base.acquisitionType = 'leasing';
  } else if (payment === 'finance' || /\bfinanz/.test(blob)) {
    base.acquisitionType = 'finance';
  } else if (payment === 'cash' || /\bkauf\b|\bbar\b/.test(blob)) {
    base.acquisitionType = 'purchase';
  }

  if (needProfile.leaseDurationMonths) {
    const term = LEASING_TERM_OPTIONS.find((o) => o.months === needProfile.leaseDurationMonths);
    if (term) base.leasing.termId = term.id;
  }
  if (needProfile.annualKm) {
    const mileage = LEASING_MILEAGE_OPTIONS.find((o) => o.value === needProfile.annualKm);
    if (mileage) base.leasing.mileageId = mileage.id;
  }
  if (needProfile.budget?.maxMonthlyRate) {
    base.finance.desiredRate = String(needProfile.budget.maxMonthlyRate);
  }

  if (/\binzahlung|tausch|altwagen|gebrauchtwagen\b/.test(blob)) {
    base.tradeIn = 'yes';
  }

  return base;
}

function labelOf(options, id) {
  return options.find((o) => o.id === id)?.label ?? null;
}

/** Alle Labels, die der Enrichment-Schritt am Notizzettel verwaltet (ersetzen sich gegenseitig). */
export function wishHandoffManagedNotepadLabels() {
  return [
    ...VEHICLE_NEED_TIMING_OPTIONS.map((o) => o.label),
    ...ACQUISITION_OPTIONS.filter((o) => o.id !== 'open').map((o) => o.label),
    ...PURCHASE_SPECIAL_OPTIONS.map((o) => o.label),
    ...HANDOFF_TRADE_IN_OPTIONS.map((o) => o.notepadLabel),
    ...LEASING_TERM_OPTIONS.map((o) => o.label),
    ...LEASING_MILEAGE_OPTIONS.map((o) => o.label),
    ...DOWN_PAYMENT_OPTIONS.map((o) => o.label),
    ...FINANCE_TERM_OPTIONS.map((o) => o.label),
    ...FINANCE_BALLOON_OPTIONS.map((o) => o.label),
  ];
}

/**
 * Kompakte Notizzettel-Chips aus dem aktuellen Enrichment.
 * @param {ReturnType<typeof emptyWishHandoffEnrichment>} enrichment
 * @returns {string[]}
 */
export function buildWishHandoffNotepadLabels(enrichment = {}) {
  const labels = [];
  const timing = labelOf(VEHICLE_NEED_TIMING_OPTIONS, enrichment.vehicleNeedTiming);
  if (timing) labels.push(timing);

  const acquisition = labelOf(ACQUISITION_OPTIONS, enrichment.acquisitionType);
  if (acquisition && enrichment.acquisitionType !== 'open') {
    labels.push(acquisition);
  }

  if (enrichment.acquisitionType === 'purchase' && enrichment.specialConditionId) {
    const special = labelOf(PURCHASE_SPECIAL_OPTIONS, enrichment.specialConditionId);
    if (special) labels.push(special);
  }

  if (enrichment.acquisitionType === 'leasing') {
    const term = labelOf(LEASING_TERM_OPTIONS, enrichment.leasing?.termId);
    const km = labelOf(LEASING_MILEAGE_OPTIONS, enrichment.leasing?.mileageId);
    const dp = labelOf(DOWN_PAYMENT_OPTIONS, enrichment.leasing?.downPayment);
    if (term) labels.push(term);
    if (km) labels.push(km);
    if (dp) labels.push(dp);
  }

  if (enrichment.acquisitionType === 'finance') {
    const term = labelOf(FINANCE_TERM_OPTIONS, enrichment.finance?.termId);
    const dp = labelOf(DOWN_PAYMENT_OPTIONS, enrichment.finance?.downPayment);
    const balloon = labelOf(FINANCE_BALLOON_OPTIONS, enrichment.finance?.balloon);
    if (term) labels.push(term);
    if (dp) labels.push(dp);
    if (balloon) labels.push(balloon);
    const rate = Number(enrichment.finance?.desiredRate);
    if (Number.isFinite(rate) && rate > 0) {
      labels.push(`Wunschrate ${rate} €`);
    }
  }

  const trade = HANDOFF_TRADE_IN_OPTIONS.find((o) => o.id === enrichment.tradeIn);
  if (trade) labels.push(trade.notepadLabel);

  return labels;
}

/**
 * Bestehende Notizzettel-Labels mit Enrichment mergen:
 * Gesprächswünsche bleiben, Enrichment-Felder werden ersetzt (kein 36 + 48 Monate).
 * Ohne Enrichment-Auswahl bleibt die übergebene Baseline unverändert (Überspringen).
 * @param {string[]} existingLabels
 * @param {ReturnType<typeof emptyWishHandoffEnrichment>} enrichment
 */
export function mergeWishHandoffNotepadLabels(existingLabels = [], enrichment = {}) {
  const fromEnrichment = buildWishHandoffNotepadLabels(enrichment);
  const hasAnyEnrichmentChoice = Boolean(
    enrichment?.vehicleNeedTiming
    || enrichment?.acquisitionType
    || enrichment?.specialConditionId
    || enrichment?.tradeIn
    || enrichment?.leasing?.termId
    || enrichment?.leasing?.mileageId
    || enrichment?.leasing?.downPayment
    || enrichment?.finance?.termId
    || enrichment?.finance?.downPayment
    || enrichment?.finance?.balloon
    || (enrichment?.finance?.desiredRate && String(enrichment.finance.desiredRate).trim()),
  );

  if (!hasAnyEnrichmentChoice) {
    return [...(existingLabels ?? [])];
  }

  const managed = new Set(wishHandoffManagedNotepadLabels());
  const preserved = (existingLabels ?? []).filter((label) => {
    if (managed.has(label)) return false;
    if (/^Wunschrate\s+\d/.test(label)) return false;
    return true;
  });
  const seen = new Set(preserved);
  const merged = [...preserved];
  for (const label of fromEnrichment) {
    if (seen.has(label)) continue;
    seen.add(label);
    merged.push(label);
  }
  return merged;
}

/**
 * Menschliche Zusammenfassung für Verkäufer-Dossier.
 * @param {ReturnType<typeof emptyWishHandoffEnrichment>} enrichment
 * @returns {string[]}
 */
export function buildWishHandoffEnrichmentLines(enrichment = {}) {
  const lines = [];
  const need = labelOf(VEHICLE_NEED_TIMING_OPTIONS, enrichment.vehicleNeedTiming);
  if (need) lines.push(`Fahrzeugbedarf: ${need}`);

  const acquisition = labelOf(ACQUISITION_OPTIONS, enrichment.acquisitionType);
  if (acquisition && enrichment.acquisitionType !== 'open') {
    lines.push(`Anschaffung: ${acquisition}`);
  }

  if (enrichment.acquisitionType === 'purchase' && enrichment.specialConditionId) {
    const special = labelOf(PURCHASE_SPECIAL_OPTIONS, enrichment.specialConditionId);
    if (special) lines.push(`Kundengruppe: ${special}`);
  }

  if (enrichment.acquisitionType === 'leasing') {
    const term = labelOf(LEASING_TERM_OPTIONS, enrichment.leasing?.termId);
    const km = labelOf(LEASING_MILEAGE_OPTIONS, enrichment.leasing?.mileageId);
    const dp = labelOf(DOWN_PAYMENT_OPTIONS, enrichment.leasing?.downPayment);
    const parts = [term, km, dp].filter(Boolean);
    if (parts.length) lines.push(`Leasing: ${parts.join(' · ')}`);
  }

  if (enrichment.acquisitionType === 'finance') {
    const term = labelOf(FINANCE_TERM_OPTIONS, enrichment.finance?.termId);
    const dp = labelOf(DOWN_PAYMENT_OPTIONS, enrichment.finance?.downPayment);
    const balloon = labelOf(FINANCE_BALLOON_OPTIONS, enrichment.finance?.balloon);
    const rate = enrichment.finance?.desiredRate
      ? `Wunschrate ${enrichment.finance.desiredRate} €`
      : null;
    const parts = [term, dp, rate, balloon].filter(Boolean);
    if (parts.length) lines.push(`Finanzierung: ${parts.join(' · ')}`);
  }

  const trade = HANDOFF_TRADE_IN_OPTIONS.find((o) => o.id === enrichment.tradeIn);
  if (trade) lines.push(`Inzahlungnahme: ${trade.label}`);

  return lines;
}

/**
 * Enrichment → needProfile-Patch (bestehende Felder).
 * @param {object} needProfile
 * @param {ReturnType<typeof emptyWishHandoffEnrichment>} enrichment
 */
export function applyWishHandoffEnrichmentToNeedProfile(needProfile = {}, enrichment = {}) {
  const next = {
    ...needProfile,
    budget: { ...(needProfile.budget ?? {}) },
  };

  if (enrichment.acquisitionType === 'leasing') {
    next.budget.paymentType = 'leasing';
    next.budget.paymentExplicit = true;
    const term = LEASING_TERM_OPTIONS.find((o) => o.id === enrichment.leasing?.termId);
    const mileage = LEASING_MILEAGE_OPTIONS.find((o) => o.id === enrichment.leasing?.mileageId);
    if (term) next.leaseDurationMonths = term.months;
    if (mileage) next.annualKm = mileage.value;
  } else if (enrichment.acquisitionType === 'finance') {
    next.budget.paymentType = 'finance';
    next.budget.paymentExplicit = true;
    const term = FINANCE_TERM_OPTIONS.find((o) => o.id === enrichment.finance?.termId);
    if (term) next.leaseDurationMonths = term.months;
    const rate = Number(enrichment.finance?.desiredRate);
    if (Number.isFinite(rate) && rate > 0) {
      next.budget.maxMonthlyRate = rate;
    }
  } else if (enrichment.acquisitionType === 'purchase') {
    next.budget.paymentType = 'cash';
    next.budget.paymentExplicit = true;
  }

  if (enrichment.vehicleNeedTiming && enrichment.vehicleNeedTiming !== 'open') {
    next.deliveryPreference = enrichment.vehicleNeedTiming;
  }

  if (enrichment.specialConditionId) {
    next.specialConditionId = enrichment.specialConditionId;
  }

  if (enrichment.tradeIn) {
    next.tradeInInterest = enrichment.tradeIn;
  }

  next.wishHandoffEnrichment = enrichment;
  return next;
}
