/**
 * Kundenbild – Snapshot-Modell mit zwei Zonen:
 * 1) Kernkonditionen (immer sichtbar) – harte Deal-Werte
 * 2) Kundeninfos & Wünsche (klappbar) – soft, person-first
 * Soft-Chips nur aus Customer Truth; Offer-PDF nie in Soft mischen.
 */
import { getNeedProfileFromLead, modelDisplayLabel } from '../consultation/needProfileService.js';
import { getSellerInsightsFromLead } from './sellerInsights.js';
import { buildCustomerUnderstanding } from './customerUnderstanding.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';

/** Soft-Gruppen unter „Kundeninfos & Wünsche“ (Notizen zuletzt). */
export const SOFT_SNAPSHOT_GROUP = {
  KUNDE_ALLTAG: 'kundeAlltag',
  FAHRZEUGWUNSCH: 'fahrzeugwunsch',
  WICHTIG_AUSWAHL: 'wichtigAuswahl',
  BESTAND: 'bestand',
  NOTIZEN: 'notizen',
};

export const SOFT_SNAPSHOT_GROUP_TITLE = {
  [SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG]: 'Kunde & Alltag',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH]: 'Fahrzeugwunsch',
  [SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL]: 'Wichtig bei der Auswahl',
  [SOFT_SNAPSHOT_GROUP.BESTAND]: 'Bestandsfahrzeug',
  [SOFT_SNAPSHOT_GROUP.NOTIZEN]: 'Notizen',
};

/** @deprecated – Alias: Soft-Gruppen + Legacy-IDs für ältere Imports */
export const SNAPSHOT_GROUP = {
  BEDARF: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
  BESTAND: SOFT_SNAPSHOT_GROUP.BESTAND,
  BUDGET: 'budget',
  WUNSCH: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
  VERTRAG: 'vertrag',
  BUDGET_VERTRAG: 'budget',
  ...SOFT_SNAPSHOT_GROUP,
};

/** Tint-/Fakten-Kategorien (Budget ≠ Vertrag für Soft-Tint). */
export const SNAPSHOT_TINT = {
  ALLTAG: 'alltag',
  BUDGET: 'budget',
  VERTRAG: 'vertrag',
  FAHRZEUG: 'fahrzeug',
  INZAHLUNGNAHME: 'inzahlungnahme',
  WICHTIG: 'wichtig',
  NOTIZ: 'notiz',
};

export const SNAPSHOT_GROUP_TITLE = {
  ...SOFT_SNAPSHOT_GROUP_TITLE,
  [SNAPSHOT_GROUP.BEDARF]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG],
  [SNAPSHOT_GROUP.BUDGET]: 'Budget',
  [SNAPSHOT_GROUP.WUNSCH]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH],
  [SNAPSHOT_GROUP.VERTRAG]: 'Vertragskonditionen',
};

/** Primärer editKey je Soft-Gruppe (Fallback). */
export const SNAPSHOT_GROUP_EDIT_KEY = {
  [SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG]: 'bedarf',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH]: 'vehicleTrack',
  [SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL]: 'bedarf',
  [SOFT_SNAPSHOT_GROUP.BESTAND]: 'tradeIn',
  [SOFT_SNAPSHOT_GROUP.NOTIZEN]: 'bedarf',
  [SNAPSHOT_GROUP.BUDGET]: 'desiredRate',
  [SNAPSHOT_GROUP.VERTRAG]: 'termMonths',
};

/** Prioritäts-Labels für „Wichtig bei der Auswahl“. */
const SELECTION_PRIORITY_LABELS = {
  charging: 'Ladezeit wichtig',
  range: 'Reichweite',
  space: 'Platz',
  family: 'Familie',
  towing: 'AHK',
  design: 'Design',
  technology: 'Technik',
  budget: 'Budget wichtig',
};

/** Mini-Editor Keys (feld-spezifisch, kein generisches Offen-Sheet). */
export const SNAPSHOT_MINI_EDITOR = {
  DESIRED_RATE: 'desiredRate',
  CHILDREN: 'children',
  TERM_MONTHS: 'termMonths',
  MILEAGE: 'mileagePerYear',
  COLOR: 'preferredColor',
  PRIORITY_DELIVERY: 'delivery',
  TRADE_IN: 'tradeInYesNo',
  DOG: 'dog',
  PAYMENT_TYPE: 'paymentType',
  DOWN_PAYMENT: 'downPayment',
  LEASING_END: 'leasingEndDate',
};

export const SNAPSHOT_RATE_MODES = {
  APPROX: 'approx',
  MAX: 'max',
  TARGET: 'target',
};

export const SNAPSHOT_RATE_MODE_LABELS = {
  [SNAPSHOT_RATE_MODES.APPROX]: 'ungefähr',
  [SNAPSHOT_RATE_MODES.MAX]: 'maximal',
  [SNAPSHOT_RATE_MODES.TARGET]: 'Zielrate',
};

/** Max. Tokens in der eingeklappten Summary-Zeile (Rest als +N). */
export const SNAPSHOT_SUMMARY_MAX_TOKENS = 5;

/** ~2–3 Chip-Zeilen Mobile, Rest hinter „+ N weitere“. */
export const SNAPSHOT_EXPANDED_VISIBLE_CHIPS = 8;

const USAGE_LABELS = {
  erstwagen: 'Erstwagen',
  zweitwagen: 'Zweitwagen',
  zugfahrzeug: 'Zugfahrzeug',
  pendeln: 'Pendeln',
  urlaub: 'Urlaub',
  langstrecke: 'Langstrecke',
  kinderwagen: 'Kinderwagen',
  stadt: 'Stadt',
};

const EQUIPMENT_LABELS = {
  heat_pump: 'Wärmepumpe',
  camera_360: '360°-Kamera',
  head_up_display: 'HUD',
  matrix_led: 'Matrix-LED',
  v2l: 'V2L',
  tinting: 'Tönung',
  panorama_roof: 'Panoramadach',
  heated_seats: 'Sitzheizung',
  rear_seat_heat: 'Fond-Heizung',
  power_tailgate: 'Heckklappe el.',
  large_navi: 'Großes Navi',
  large_trunk: 'Großer Kofferraum',
};

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  financing: 'Finanzierung',
  threeWayFinancing: 'Finanzierung',
  cash: 'Kauf',
};

/**
 * @param {object} fact
 */
function fact(id, label, {
  editKey = null,
  relevanceKey = null,
  groupId,
  tint = null,
  miniEditor = null,
  summaryPriority = 50,
  icon = null,
} = {}) {
  const text = String(label ?? '').trim();
  if (!text) return null;
  const category = tint || SNAPSHOT_TINT.ALLTAG;
  return {
    id,
    label: text,
    editKey,
    relevanceKey: relevanceKey || editKey || id,
    groupId,
    tint: category,
    category,
    miniEditor,
    summaryPriority,
    icon: icon || category,
  };
}

function pushFact(list, item) {
  if (!item) return;
  if (list.some((f) => f.id === item.id || f.label === item.label)) return;
  list.push(item);
}

function formatEuroApprox(amount, rateMode = null) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  const base = `${Math.round(num).toLocaleString('de-DE')} €`;
  if (rateMode === SNAPSHOT_RATE_MODES.MAX) return `max. ${base}`;
  if (rateMode === SNAPSHOT_RATE_MODES.TARGET) return `Ziel ${base}`;
  return `ca. ${base}`;
}

function formatKm(km) {
  const num = Number(km);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num.toLocaleString('de-DE')} km`;
}

function formatMonths(months) {
  const num = Number(months);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num} Monate`;
}

function formatChildren(children) {
  if (children == null || children === false) return null;
  if (children === true) return 'Kinder';
  const n = Number(children);
  if (Number.isFinite(n) && n > 0) return n === 1 ? '1 Kind' : `${n} Kinder`;
  return 'Kinder';
}

function formatDownPayment(down, { compact = false } = {}) {
  const downNum = Number(down);
  if (!Number.isFinite(downNum) || downNum < 0) return null;
  if (downNum === 0) return compact ? '0 € AZ' : '0 € Anzahlung';
  const amount = `${downNum.toLocaleString('de-DE')} €`;
  return compact ? `${amount} AZ` : `${amount} Anzahlung`;
}

const MONTH_LABELS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** „2026-07“ / „2026-07-01“ → „Ende Juli 2026“ */
export function formatLeasingEndLabel(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (iso) {
    const year = iso[1];
    const monthIdx = Number(iso[2]) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `Ende ${MONTH_LABELS_DE[monthIdx]} ${year}`;
    }
  }
  if (/^ende\s+/i.test(text)) return text;
  return `Ende ${text}`;
}

function resolvePaymentType(lead = {}, profile = {}) {
  const raw = lead?.wish?.paymentType
    ?? lead?.paymentType
    ?? profile?.budget?.paymentType
    ?? null;
  if (!raw || raw === 'unknown') return null;
  return raw;
}

function resolveRateMode(lead = {}, profile = {}) {
  const raw = lead?.wish?.desiredRateMode
    ?? profile?.budget?.rateMode
    ?? null;
  if (raw && SNAPSHOT_RATE_MODE_LABELS[raw]) return raw;
  return SNAPSHOT_RATE_MODES.APPROX;
}

function isMagicOfferSource(source = null) {
  const from = String(source?.createdFrom ?? source ?? '').toLowerCase();
  return from.includes('magic_offer') || from.includes('offer_pdf') || from.includes('offer_calc');
}

function isOfferWorkingItem(item = null) {
  if (!item) return false;
  return item.kind === 'offer'
    || item?.card?.monthlyRate != null
    || item?.monthlyRate != null
    || Boolean(item?.card?.termMonths || item?.termMonths);
}

function pushOfferNumeric(set, value) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) set.add(Math.round(num));
}

/**
 * Kommerzielle Offer-Konditionen aus Configs / Offers / Working Context.
 * Dient der Leak-Erkennung – nie als Customer-Truth-Quelle.
 */
export function collectOfferCommercialTerms(lead = {}, workingContextItems = []) {
  const rates = new Set();
  const termMonths = new Set();
  const mileages = new Set();
  const downPayments = new Set();
  const paymentTypes = new Set();
  const endDates = new Set();

  const ingestCommercialRates = (card = {}) => {
    pushOfferNumeric(rates, card.monthlyRate);
    pushOfferNumeric(rates, card.leasingData?.calculatedRate);
    pushOfferNumeric(rates, card.leasingData?.monthlyRate);
    pushOfferNumeric(rates, card.vehicleOffer?.monthlyRate);
    pushOfferNumeric(rates, card.vehicleOffer?.payment?.monthlyRate);
    pushOfferNumeric(rates, card.boardOffer?.payment?.monthlyRate);
    pushOfferNumeric(rates, card.payment?.monthlyRate);
    pushOfferNumeric(rates, card.payment?.calculatedRate);
  };

  /** Laufzeit/km/AZ/Ende nur aus Magic/PDF oder explizitem Offer-Working-Context. */
  const ingestOfferConditions = (card = {}, { force = false, source = null } = {}) => {
    const fromOffer = force
      || isMagicOfferSource(source)
      || isMagicOfferSource(card?.source)
      || isMagicOfferSource(card?.vehicleOffer?.source);
    if (!fromOffer) return;
    pushOfferNumeric(termMonths, card.termMonths ?? card.leasingData?.termMonths ?? card.payment?.termMonths);
    pushOfferNumeric(mileages, card.mileagePerYear ?? card.annualMileage ?? card.payment?.mileagePerYear);
    pushOfferNumeric(downPayments, card.downPayment ?? card.payment?.downPayment ?? card.leasingData?.downPayment);
    const pay = card.paymentType ?? card.payment?.type ?? card.leasingData?.paymentType;
    if (pay && pay !== 'unknown') paymentTypes.add(String(pay));
    const end = card.leasingEndDate ?? card.contractEndDate ?? card.payment?.leasingEndDate;
    if (end) endDates.add(String(end).trim().slice(0, 7));
  };

  for (const config of lead?.crm?.vehicleConfigurations ?? []) {
    ingestCommercialRates(config);
    ingestOfferConditions(config, { source: config.source });
    const commercial = Number(config.monthlyRate ?? config.leasingData?.calculatedRate);
    const desiredOnConfig = Number(config.desiredRate);
    if (
      Number.isFinite(desiredOnConfig)
      && desiredOnConfig > 0
      && (
        isMagicOfferSource(config.source)
        || isMagicOfferSource(config.vehicleOffer?.source)
        || (Number.isFinite(commercial) && Math.round(commercial) === Math.round(desiredOnConfig))
      )
    ) {
      pushOfferNumeric(rates, desiredOnConfig);
    }
  }

  for (const offer of lead?.crm?.offers ?? []) {
    ingestCommercialRates(offer);
    ingestOfferConditions(offer, { force: true, source: offer.source });
    const commercial = Number(offer.monthlyRate ?? offer.payment?.monthlyRate);
    const desiredOnOffer = Number(offer.desiredRate);
    if (
      Number.isFinite(desiredOnOffer)
      && desiredOnOffer > 0
      && (
        isMagicOfferSource(offer.source)
        || (Number.isFinite(commercial) && Math.round(commercial) === Math.round(desiredOnOffer))
      )
    ) {
      pushOfferNumeric(rates, desiredOnOffer);
    }
  }

  for (const item of workingContextItems ?? []) {
    if (!isOfferWorkingItem(item)) continue;
    const card = item.card || item;
    ingestCommercialRates(card);
    ingestOfferConditions(card, { force: true, source: item.source || card.source });
    pushOfferNumeric(rates, item.monthlyRate);
    pushOfferNumeric(rates, item.desiredRate);
    pushOfferNumeric(rates, card.desiredRate);
    pushOfferNumeric(termMonths, item.termMonths ?? card.termMonths);
    pushOfferNumeric(mileages, item.mileagePerYear ?? card.mileagePerYear);
    pushOfferNumeric(downPayments, item.downPayment ?? card.downPayment);
    const pay = item.paymentType ?? card.paymentType;
    if (pay) paymentTypes.add(String(pay));
    const end = item.leasingEndDate ?? card.leasingEndDate;
    if (end) endDates.add(String(end).trim().slice(0, 7));
  }

  return { rates, termMonths, mileages, downPayments, paymentTypes, endDates };
}

/** @deprecated – Wrapper, nutzt collectOfferCommercialTerms */
export function collectOfferCommercialRates(lead = {}, workingContextItems = []) {
  return collectOfferCommercialTerms(lead, workingContextItems).rates;
}

/**
 * Nur bestätigter Kundenwunsch – Offer-PDF-Raten (z. B. 132 €) nicht als Wunschrate,
 * auch wenn sie in wish.desiredRate / Budget / Top-Level gespiegelt wurden.
 */
export function resolveConfirmedWishRate(lead = {}, profile = {}, options = {}) {
  const { rates: offerRates } = collectOfferCommercialTerms(lead, options.workingContextItems);

  const pickConfirmed = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (offerRates.has(Math.round(num))) return null;
    return num;
  };

  return pickConfirmed(lead?.wish?.desiredRate)
    ?? pickConfirmed(profile?.budget?.maxMonthlyRate)
    ?? pickConfirmed(lead?.desiredRate);
}

/**
 * Wert ist nur Angebots-/PDF-Spiegelung → kein Kundenbild-Chip.
 * Ohne offenen Offer-Kontext gelten Wish-Werte als bestätigt.
 */
function isOfferOnlyCommercialValue(kind, value, offerTerms) {
  if (value == null || value === '') return false;
  const hasOfferContext = (
    offerTerms.rates.size > 0
    || offerTerms.termMonths.size > 0
    || offerTerms.mileages.size > 0
    || offerTerms.downPayments.size > 0
    || offerTerms.paymentTypes.size > 0
    || offerTerms.endDates.size > 0
  );
  if (!hasOfferContext) return false;

  if (kind === 'termMonths' || kind === 'mileage' || kind === 'downPayment') {
    const num = Number(value);
    if (!Number.isFinite(num)) return false;
    const set = kind === 'termMonths'
      ? offerTerms.termMonths
      : kind === 'mileage'
        ? offerTerms.mileages
        : offerTerms.downPayments;
    return set.has(Math.round(num));
  }
  if (kind === 'paymentType') {
    return offerTerms.paymentTypes.has(String(value));
  }
  if (kind === 'endDate') {
    const key = String(value).trim().slice(0, 7);
    return offerTerms.endDates.has(key);
  }
  return false;
}

/**
 * Primäres Offer-/Working-Context-Card für Deal-Kernkonditionen.
 */
function resolvePrimaryOfferCard(workingContextItems = [], lead = {}) {
  const offers = (workingContextItems ?? []).filter((item) => isOfferWorkingItem(item));
  const primary = offers[0] || null;
  let card = primary?.card || null;
  let titleBase = null;
  if (primary) {
    titleBase = String(primary.shortLabel || primary.label || '')
      .replace(/\s*·.*$/, '')
      .trim();
  }
  if (!card) {
    const configs = lead?.crm?.vehicleConfigurations ?? [];
    const fromPdf = configs.find((c) => (
      isMagicOfferSource(c.source) || isMagicOfferSource(c.vehicleOffer?.source)
    ));
    card = fromPdf || null;
  }
  return { card, primary, titleBase };
}

/**
 * Arbeitskontext-Zeile (legacy) – Offer-PDF-Konditionen, keine Soft-Truth.
 * @returns {{ title: string, line: string, parts: string[] }|null}
 */
export function buildWorkingContextStrip(workingContextItems = [], lead = {}) {
  const { card, primary, titleBase } = resolvePrimaryOfferCard(workingContextItems, lead);
  if (!card && !primary) return null;

  const model = String(
    card?.modelName || card?.model || card?.modelKey || titleBase || 'Angebot',
  ).replace(/^Kia\s+/i, '').trim();
  const offerTitle = /angebot/i.test(model) ? model : `${model}-Angebot`;

  const parts = [offerTitle];
  const term = Number(card?.termMonths ?? primary?.termMonths);
  if (Number.isFinite(term) && term > 0) parts.push(`${term} Monate`);
  const km = Number(card?.mileagePerYear ?? primary?.mileagePerYear);
  if (Number.isFinite(km) && km > 0) parts.push(`${km.toLocaleString('de-DE')} km`);
  const down = card?.downPayment ?? primary?.downPayment;
  if (down != null && String(down).trim() !== '') {
    const downNum = Number(down);
    if (Number.isFinite(downNum) && downNum >= 0) {
      parts.push(`${downNum.toLocaleString('de-DE')} € AZ`);
    }
  }

  if (parts.length <= 1 && primary?.shortLabel) {
    return {
      title: 'Aktueller Arbeitskontext',
      line: primary.shortLabel,
      parts: [primary.shortLabel],
    };
  }
  if (parts.length <= 1) return null;

  return {
    title: 'Aktueller Arbeitskontext',
    line: parts.join(' · '),
    parts,
  };
}

/**
 * Kern-Feld: Wunsch wenn bestätigt, sonst Offer/Deal (sichtbar fürs Gespräch).
 * @returns {{ value: *, source: 'wish'|'deal' }|null}
 */
function resolveKernCommercialValue(kind, wishValue, offerTerms, dealValue) {
  const hasWish = wishValue != null && String(wishValue).trim() !== '';
  if (hasWish) {
    const offerOnly = isOfferOnlyCommercialValue(kind, wishValue, offerTerms);
    return { value: wishValue, source: offerOnly ? 'deal' : 'wish' };
  }
  if (dealValue != null && String(dealValue).trim() !== '') {
    return { value: dealValue, source: 'deal' };
  }
  return null;
}

function resolveExistingVehicleLabel(lead = {}) {
  const tradeIn = getTradeIn(lead);
  if (tradeIn.vehicle?.trim()) {
    const base = tradeIn.vehicle.trim();
    return /(?:\(|\b)(?:gw|gebraucht)/i.test(base) ? base : `${base} (GW)`;
  }
  const existing = lead?.crm?.existingVehicle;
  if (existing?.label?.trim()) {
    const base = existing.label.trim();
    return /(?:\(|\b)(?:gw|gebraucht)/i.test(base) ? base : `${base} (GW)`;
  }
  const makeModel = [existing?.make, existing?.model].filter(Boolean).join(' ').trim();
  if (makeModel) return `${makeModel} (GW)`;
  return null;
}

function collectConfirmedSellerLabels(lead = {}) {
  const insights = getSellerInsightsFromLead(lead);
  const labels = [];
  for (const insight of insights) {
    const fromInsight = insight.understoodLabels?.length
      ? insight.understoodLabels
      : [insight.text].filter(Boolean);
    for (const label of fromInsight) {
      const text = String(label ?? '').trim();
      if (text) labels.push(text);
    }
  }
  return labels;
}

function buildKundeAlltagFacts(profile = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];
  const childrenLabel = formatChildren(profile.children);
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 10,
      icon: 'alltag',
    }));
    usedLabels.add(childrenLabel.toLowerCase());
  }

  const hasFamily = profile.priorities?.includes('family')
    || Boolean(profile.children)
    || (profile.persons ?? 0) >= 5;
  if (hasFamily && !childrenLabel) {
    pushFact(facts, fact('family', 'Familie', {
      editKey: 'family',
      groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 15,
      icon: 'alltag',
    }));
    usedLabels.add('familie');
  }

  if (profile.dog) {
    pushFact(facts, fact('dog', 'Hund', {
      editKey: 'dog',
      groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.DOG,
      summaryPriority: 12,
      icon: 'alltag',
    }));
    usedLabels.add('hund');
  }

  if (profile.chargingAtHome === 'yes') {
    pushFact(facts, fact('chargingAtHome', 'Haus', {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 36,
    }));
    usedLabels.add('haus');
    usedLabels.add('laden zuhause');
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 40,
    }));
    usedLabels.add(label.toLowerCase());
  }

  for (const label of sellerLabels) {
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (/leasing|finanz|kauf|budget|rate|km|monat|anzahlung/i.test(label)) continue;
    if (/favorit|ablehn|liefer|inzahlung|gebraucht|\(gw\)|rückläufer|bestands/i.test(label)) continue;
    if (/ladezeit|reichweite|wichtig|entscheid/i.test(label)) continue;
    if (/wärmepumpe|hud|kamera|ahk|anhänger|gt-line|800\s*v/i.test(label)) continue;
    if (/kind|hund|familie|haus|kaffee|wohnen|schwarz|partner|hobby|golf|pferd/i.test(label)) {
      pushFact(facts, fact(`seller:${label}`, label, {
        editKey: 'bedarf',
        groupId: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG,
        tint: SNAPSHOT_TINT.ALLTAG,
        summaryPriority: 45,
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

function buildWichtigAuswahlFacts(profile = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];

  for (const key of profile.priorities ?? []) {
    if (key === 'family' || key === 'towing' || key === 'budget') continue;
    const label = SELECTION_PRIORITY_LABELS[key];
    if (!label) continue;
    if (usedLabels.has(label.toLowerCase())) continue;
    pushFact(facts, fact(`priority:${key}`, label, {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL,
      tint: SNAPSHOT_TINT.WICHTIG,
      summaryPriority: key === 'charging' ? 22 : key === 'range' ? 24 : 26,
    }));
    usedLabels.add(label.toLowerCase());
  }

  if (
    (profile.priorities?.includes('space') || profile.bodyType === 'suv' || (profile.persons ?? 0) >= 7)
    && !usedLabels.has('platz')
    && !usedLabels.has('suv / platz')
  ) {
    const spaceLabel = (profile.persons ?? 0) >= 7
      ? '7 Sitze'
      : profile.bodyType === 'suv'
        ? 'SUV / Platz'
        : 'Platz';
    pushFact(facts, fact('space', spaceLabel, {
      editKey: 'space',
      groupId: SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL,
      tint: SNAPSHOT_TINT.WICHTIG,
      summaryPriority: 26,
    }));
    usedLabels.add(spaceLabel.toLowerCase());
  }

  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    if (!usedLabels.has('langstrecke') && !usedLabels.has('reichweite')) {
      pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
        editKey: 'usage',
        groupId: SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL,
        tint: SNAPSHOT_TINT.WICHTIG,
        summaryPriority: 28,
      }));
      usedLabels.add('langstrecke');
    }
  }

  for (const label of sellerLabels) {
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (/ladezeit|reichweite|platz|entscheid|wichtig|priorit/i.test(label)
      && !/leasing|finanz|rate|km|monat/i.test(label)) {
      pushFact(facts, fact(`seller-wichtig:${label}`, label, {
        editKey: 'bedarf',
        groupId: SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL,
        tint: SNAPSHOT_TINT.WICHTIG,
        summaryPriority: 25,
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

/**
 * Immer sichtbare Kernkonditionen – Wunsch bevorzugt, sonst aktueller Deal.
 */
export function buildKernKonditionen(lead = {}, profile = {}, options = {}) {
  const workingContextItems = options.workingContextItems ?? [];
  const offerTerms = collectOfferCommercialTerms(lead, workingContextItems);
  const { card, primary } = resolvePrimaryOfferCard(workingContextItems, lead);
  const chips = [];
  const sources = new Set();

  const dealPayment = card?.paymentType ?? primary?.paymentType
    ?? card?.payment?.type ?? card?.leasingData?.paymentType ?? null;
  const dealTerm = card?.termMonths ?? primary?.termMonths
    ?? card?.leasingData?.termMonths ?? card?.payment?.termMonths ?? null;
  const dealKm = card?.mileagePerYear ?? primary?.mileagePerYear
    ?? card?.annualMileage ?? card?.payment?.mileagePerYear ?? null;
  const dealDown = card?.downPayment ?? primary?.downPayment
    ?? card?.payment?.downPayment ?? card?.leasingData?.downPayment ?? null;
  const dealEnd = card?.leasingEndDate ?? primary?.leasingEndDate
    ?? card?.contractEndDate ?? card?.payment?.leasingEndDate ?? null;

  const paymentResolved = resolveKernCommercialValue(
    'paymentType',
    resolvePaymentType(lead, profile),
    offerTerms,
    dealPayment && dealPayment !== 'unknown' ? dealPayment : null,
  );
  if (paymentResolved && PAYMENT_LABELS[paymentResolved.value]) {
    sources.add(paymentResolved.source);
    pushFact(chips, fact('paymentType', PAYMENT_LABELS[paymentResolved.value], {
      editKey: 'paymentType',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE,
      summaryPriority: 1,
      icon: 'vertrag',
    }));
  }

  const termResolved = resolveKernCommercialValue(
    'termMonths',
    lead?.wish?.termMonths ?? profile?.leaseDurationMonths ?? null,
    offerTerms,
    dealTerm,
  );
  const termLabel = termResolved ? formatMonths(termResolved.value) : null;
  if (termLabel) {
    sources.add(termResolved.source);
    pushFact(chips, fact('termMonths', termLabel, {
      editKey: 'termMonths',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.TERM_MONTHS,
      summaryPriority: 2,
      icon: 'vertrag',
    }));
  }

  const kmResolved = resolveKernCommercialValue(
    'mileage',
    lead?.wish?.mileagePerYear ?? profile?.annualKm ?? null,
    offerTerms,
    dealKm,
  );
  const kmLabel = kmResolved ? formatKm(kmResolved.value) : null;
  if (kmLabel) {
    sources.add(kmResolved.source);
    pushFact(chips, fact('mileagePerYear', kmLabel, {
      editKey: 'mileagePerYear',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.MILEAGE,
      summaryPriority: 3,
      icon: 'vertrag',
    }));
  }

  const downResolved = resolveKernCommercialValue(
    'downPayment',
    lead?.wish?.downPayment ?? profile?.budget?.downPayment ?? null,
    offerTerms,
    dealDown,
  );
  const downLabel = downResolved
    ? formatDownPayment(downResolved.value, { compact: true })
    : null;
  if (downLabel) {
    sources.add(downResolved.source);
    pushFact(chips, fact('downPayment', downLabel, {
      editKey: 'downPayment',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT,
      summaryPriority: 4,
      icon: 'vertrag',
    }));
  }

  const endResolved = resolveKernCommercialValue(
    'endDate',
    lead?.wish?.leasingEndDate ?? lead?.leasingEndDate ?? lead?.crm?.leasingEndDate ?? null,
    offerTerms,
    dealEnd,
  );
  const endLabel = endResolved ? formatLeasingEndLabel(endResolved.value) : null;
  if (endLabel) {
    sources.add(endResolved.source);
    pushFact(chips, fact('leasingEndDate', endLabel, {
      editKey: 'leasingEndDate',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.LEASING_END,
      summaryPriority: 5,
      icon: 'vertrag',
    }));
  }

  const rate = resolveConfirmedWishRate(lead, profile, options);
  const rateMode = resolveRateMode(lead, profile);
  const rateLabel = formatEuroApprox(rate, rateMode);
  if (rateLabel) {
    sources.add('wish');
    pushFact(chips, fact('rate', rateLabel, {
      editKey: 'desiredRate',
      relevanceKey: 'desiredRate',
      groupId: 'kern',
      tint: SNAPSHOT_TINT.BUDGET,
      miniEditor: SNAPSHOT_MINI_EDITOR.DESIRED_RATE,
      summaryPriority: 6,
      icon: 'budget',
    }));
  }

  // Optionales Fahrzeug im Kern (bestätigter Wunsch)
  const vehicleChip = buildConfirmedVehicleWishChip(lead, profile);
  if (vehicleChip) {
    sources.add('wish');
    pushFact(chips, { ...vehicleChip, groupId: 'kern', summaryPriority: 7 });
  }

  const lineParts = chips
    .filter((c) => c.id !== 'rate' && c.id !== 'vehicleWish' && !String(c.id).startsWith('track-fav'))
    .map((c) => c.label);
  // Rate nicht in der Kernzeile – separat als Chip; Fahrzeug optional als Zusatz
  const vehiclePart = chips.find((c) => c.id === 'vehicleWish' || String(c.id).startsWith('track-fav'));
  const source = sources.has('wish') && !sources.has('deal')
    ? 'wish'
    : sources.has('deal') && !sources.has('wish')
      ? 'deal'
      : sources.size
        ? 'mixed'
        : 'none';

  return {
    title: source === 'deal' ? 'Aktueller Deal' : 'Kernkonditionen',
    source,
    line: lineParts.join(' · '),
    parts: lineParts,
    chips,
    vehicleLabel: vehiclePart?.label || null,
    hasData: chips.length > 0,
  };
}

function buildBestandFacts(lead = {}, profile = {}, usedLabels = new Set()) {
  const facts = [];
  const existingLabel = resolveExistingVehicleLabel(lead);
  if (existingLabel) {
    pushFact(facts, fact('existingVehicle', existingLabel, {
      editKey: 'tradeIn',
      relevanceKey: 'existingVehicle',
      groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 16,
      icon: 'car',
    }));
    usedLabels.add(existingLabel.toLowerCase());
  }

  const tradeIn = getTradeIn(lead);
  const hasTradeIn = Boolean(
    tradeIn.vehicle?.trim()
    || tradeIn.datValue != null
    || lead?.crm?.existingVehicle?.tradeInCandidate,
  );
  if (hasTradeIn) {
    pushFact(facts, fact('tradeIn', 'Inzahlungnahme', {
      editKey: 'tradeIn',
      groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 48,
    }));
    usedLabels.add('inzahlungnahme');
  }

  if (profile.residualTakeover || profile.takeoverPlanned || /rückläufer|anschluss/i.test(profile.timelineLabel ?? '')) {
    const label = profile.timelineLabel?.trim() || 'Rückläufer';
    pushFact(facts, fact('returner', label, {
      editKey: 'tradeIn',
      groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 46,
    }));
    usedLabels.add(label.toLowerCase());
  }

  return facts;
}

function resolveTrimLabel(lead = {}, profile = {}) {
  const fromWish = String(lead?.wish?.equipment ?? '').trim();
  if (fromWish) return fromWish;
  const fromVehicle = String(lead?.vehicle?.trim ?? '').trim();
  if (fromVehicle) return fromVehicle;
  for (const wishId of profile.equipmentWishes ?? []) {
    if (EQUIPMENT_LABELS[wishId]) continue;
    const text = String(wishId ?? '').trim();
    if (text && /line|spirit|platinum|edition|ausstattung/i.test(text)) return text;
  }
  return null;
}

/** Bestätigter Fahrzeugwunsch-Chip (Modell · Trim) – für Kern optional + Soft. */
function buildConfirmedVehicleWishChip(lead = {}, profile = {}) {
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  let modelLabel = null;
  if (favorite) {
    modelLabel = favorite.displayName || favorite.modelLabel || null;
  } else {
    const modelKey = profile.selectedModelKey || profile.modelHint;
    if (modelKey) modelLabel = modelDisplayLabel(modelKey);
  }
  const trimLabel = resolveTrimLabel(lead, profile);

  if (modelLabel && trimLabel) {
    const modelCore = String(modelLabel).replace(/\s*[·|].*$/, '').trim();
    const alreadyHasTrim = new RegExp(trimLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      .test(modelLabel);
    const combined = alreadyHasTrim ? modelLabel : `${modelCore} · ${trimLabel}`;
    return fact('vehicleWish', combined, {
      editKey: 'vehicleTrack',
      relevanceKey: 'favoriteVehicle',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    });
  }
  if (modelLabel) {
    return fact(favorite ? `track-fav:${favorite.id}` : 'modelHint', modelLabel, {
      editKey: 'vehicleTrack',
      relevanceKey: favorite ? 'favoriteVehicle' : 'preferredModel',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    });
  }
  if (trimLabel) {
    return fact('trim', trimLabel, {
      editKey: 'equipment',
      relevanceKey: 'trim',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    });
  }
  return null;
}

function buildFahrzeugwunschFacts(lead = {}, profile = {}, usedLabels = new Set()) {
  const facts = [];
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  const vehicleChip = buildConfirmedVehicleWishChip(lead, profile);
  if (vehicleChip) {
    pushFact(facts, vehicleChip);
    usedLabels.add(vehicleChip.label.toLowerCase());
  }

  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  const modelLabel = vehicleChip?.label || null;
  const openTracks = tracks.filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.OPEN
    || t.status === VEHICLE_TRACK_STATUS.DEFERRED
  ));
  if (openTracks.length && !favorite && !modelLabel) {
    const labels = openTracks
      .slice(0, 3)
      .map((t) => t.displayName || t.modelLabel)
      .filter(Boolean);
    if (labels.length) {
      pushFact(facts, fact('tracks', labels.join(' · '), {
        editKey: 'vehicleTrack',
        groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
        tint: SNAPSHOT_TINT.FAHRZEUG,
        summaryPriority: 50,
        icon: 'car',
      }));
    }
  }

  const colors = [...new Set(
    tracks.map((t) => t.config?.vehicleTrack?.preferredColor).filter(Boolean),
  )];
  for (const color of colors.slice(0, 2)) {
    pushFact(facts, fact(`color:${color}`, String(color), {
      editKey: 'vehicleTrack',
      relevanceKey: 'preferredColor',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.COLOR,
      summaryPriority: 20,
      icon: 'car',
    }));
    usedLabels.add(String(color).toLowerCase());
  }

  if (profile.towbar || profile.towing === 'yes' || profile.towing === 'braked'
    || (profile.towCapacityKg ?? 0) >= 750
    || profile.priorities?.includes('towing')) {
    pushFact(facts, fact('towbar', 'AHK', {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 42,
      icon: 'car',
    }));
    usedLabels.add('ahk');
  }

  // Nur bestätigte Ausstattung als Chips (kein großer Modal-Default)
  for (const wishId of profile.equipmentWishes ?? []) {
    const label = EQUIPMENT_LABELS[wishId] || (
      /800\s*v/i.test(String(wishId)) ? String(wishId).trim() : null
    );
    if (!label) continue;
    if (/line|spirit|platinum|edition/i.test(label)) continue;
    pushFact(facts, fact(`equip:${wishId}`, label, {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 55,
      icon: 'car',
    }));
    usedLabels.add(label.toLowerCase());
  }

  for (const tech of profile.technology ?? []) {
    const text = String(tech ?? '').trim();
    if (!text) continue;
    pushFact(facts, fact(`tech:${text}`, text, {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 54,
      icon: 'car',
    }));
    usedLabels.add(text.toLowerCase());
  }

  const delivery = lead?.wish?.desiredDeliveryDate || lead?.deliveryTime || '';
  if (String(delivery).trim()) {
    pushFact(facts, fact('delivery', `Lieferzeit ${String(delivery).trim()}`, {
      editKey: 'delivery',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 44,
    }));
  } else if (tracks.some((t) => (
    t.config?.vehicleTrack?.deliveryTimeImportance === 'high'
    || t.config?.vehicleTrack?.deliveryTimeImportance === true
  ))) {
    pushFact(facts, fact('delivery', 'Lieferzeit wichtig', {
      editKey: 'delivery',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 44,
    }));
  }

  const rejections = tracks.filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.LOST && (t.rejectionReasonLabel || t.rejectionReason)
  ));
  for (const track of rejections.slice(0, 3)) {
    const reason = track.rejectionReasonLabel || 'abgelehnt';
    pushFact(facts, fact(`reject:${track.id}`, `${track.modelLabel}: ${reason}`, {
      editKey: 'vehicleTrack',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 60,
    }));
  }

  return facts;
}

/** Freie Notizen – nur was nicht in Kategorien passt. */
function buildNotizenFacts(lead = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];

  for (const label of sellerLabels) {
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (/leasing|finanz|kauf|budget|rate|\bkm\b|monat|anzahlung/i.test(label)) continue;
    if (label.length < 3) continue;
    pushFact(facts, fact(`note:${label}`, label, {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.NOTIZEN,
      tint: SNAPSHOT_TINT.NOTIZ,
      summaryPriority: 70,
    }));
    usedLabels.add(lower);
  }

  const conversationNotes = lead?.crm?.kundenhelfer?.conversationNotes;
  if (Array.isArray(conversationNotes)) {
    for (const note of conversationNotes.slice(0, 4)) {
      const text = String(note?.text ?? note?.body ?? note ?? '').trim();
      if (!text || text.length < 3) continue;
      const short = text.length > 48 ? `${text.slice(0, 46)}…` : text;
      const lower = short.toLowerCase();
      if (usedLabels.has(lower)) continue;
      pushFact(facts, fact(`cnote:${short}`, short, {
        editKey: 'bedarf',
        groupId: SOFT_SNAPSHOT_GROUP.NOTIZEN,
        tint: SNAPSHOT_TINT.NOTIZ,
        summaryPriority: 72,
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

/**
 * Flat chip list in category order (for overflow +N).
 * @param {object[]} groups
 */
export function flattenSnapshotChips(groups = []) {
  return groups.flatMap((g) => (g.facts || []).map((f) => ({
    ...f,
    groupId: g.id,
    groupTitle: g.title,
    category: f.category || f.tint || SNAPSHOT_TINT.ALLTAG,
    tint: f.tint || f.category || SNAPSHOT_TINT.ALLTAG,
  })));
}

/**
 * Visible vs overflow chips for expanded mobile view.
 * @param {object[]} chips
 * @param {number} [maxVisible]
 * @param {boolean} [expanded]
 */
export function splitExpandedChips(chips = [], maxVisible = SNAPSHOT_EXPANDED_VISIBLE_CHIPS, expanded = false) {
  if (expanded || chips.length <= maxVisible) {
    return { visible: chips, overflow: 0, hidden: [] };
  }
  return {
    visible: chips.slice(0, maxVisible),
    overflow: chips.length - maxVisible,
    hidden: chips.slice(maxVisible),
  };
}

/**
 * Summary-Tokens: globale Human-first Priorität (Kinder · Hund · Rate · GW · Wunsch).
 * Rest als +N. Chip-Reihenfolge bleibt gruppenbasiert.
 * @param {object[]} groupsOrFacts
 * @param {number} [maxTokens]
 */
export function buildSnapshotSummary(groupsOrFacts = [], maxTokens = SNAPSHOT_SUMMARY_MAX_TOKENS) {
  const facts = groupsOrFacts[0]?.facts
    ? groupsOrFacts.flatMap((g) => g.facts || [])
    : [...groupsOrFacts];
  const ranked = [...facts].sort((a, b) => (
    (a.summaryPriority ?? 50) - (b.summaryPriority ?? 50)
  ));
  const tokens = ranked.slice(0, Math.max(0, maxTokens));
  const overflow = Math.max(0, ranked.length - tokens.length);
  return {
    tokens,
    overflow,
    line: [
      ...tokens.map((t) => t.label),
      overflow > 0 ? `+${overflow}` : null,
    ].filter(Boolean).join(' · '),
  };
}

/** @deprecated – wireframe card lines; kept for compatibility */
export function buildGroupSummaryLines(facts = []) {
  const labels = facts.map((f) => String(f.label || '').trim()).filter(Boolean);
  return labels.length ? [labels.join(' · ')] : [];
}

function annotateFacts(facts = [], relevantSet, highlightSet) {
  return facts.map((f) => {
    const relevant = relevantSet.size > 0 && (
      relevantSet.has(f.relevanceKey)
      || relevantSet.has(f.editKey)
      || relevantSet.has(f.id)
    );
    const highlighted = highlightSet.size > 0 && (
      highlightSet.has(String(f.label).toLowerCase())
      || highlightSet.has(String(f.id).toLowerCase())
      || [...highlightSet].some((h) => String(f.label).toLowerCase().includes(h))
    );
    return {
      ...f,
      relevant: relevant || highlighted,
      highlighted,
    };
  });
}

/**
 * @param {object} lead
 * @param {{
 *   relevantKeys?: string[],
 *   workingContextItems?: object[],
 *   maxSummaryTokens?: number,
 *   highlightLabels?: string[],
 * }} [options]
 */
export function buildCustomerSnapshotModel(lead = {}, options = {}) {
  const workingContextItems = options.workingContextItems ?? [];
  const profile = getNeedProfileFromLead(lead) ?? {};
  const sellerLabels = collectConfirmedSellerLabels(lead);
  const understanding = buildCustomerUnderstanding(lead);
  const usedLabels = new Set();

  const kern = buildKernKonditionen(lead, profile, { workingContextItems });

  const kundeAlltagFacts = buildKundeAlltagFacts(profile, sellerLabels, usedLabels);
  const fahrzeugFacts = buildFahrzeugwunschFacts(lead, profile, usedLabels);
  const wichtigFacts = buildWichtigAuswahlFacts(profile, sellerLabels, usedLabels);
  const bestandFacts = buildBestandFacts(lead, profile, usedLabels);
  const notizenFacts = buildNotizenFacts(lead, sellerLabels, usedLabels);

  const softGroupsSpec = [
    { id: SOFT_SNAPSHOT_GROUP.KUNDE_ALLTAG, facts: kundeAlltagFacts },
    { id: SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH, facts: fahrzeugFacts },
    { id: SOFT_SNAPSHOT_GROUP.WICHTIG_AUSWAHL, facts: wichtigFacts },
    { id: SOFT_SNAPSHOT_GROUP.BESTAND, facts: bestandFacts },
    { id: SOFT_SNAPSHOT_GROUP.NOTIZEN, facts: notizenFacts },
  ];

  const relevantSet = new Set(
    (options.relevantKeys ?? [])
      .map((k) => String(k ?? '').trim())
      .filter(Boolean),
  );
  const highlightSet = new Set(
    (options.highlightLabels ?? [])
      .map((l) => String(l ?? '').trim().toLowerCase())
      .filter(Boolean),
  );

  const hasAnySoftFacts = softGroupsSpec.some(
    (g) => g.id !== SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH && g.facts.length > 0,
  ) || fahrzeugFacts.length > 0;

  const softGroups = softGroupsSpec
    .filter((g) => (
      g.facts.length > 0
      || (g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH && hasAnySoftFacts)
    ))
    .map((g) => {
      const facts = annotateFacts(g.facts, relevantSet, highlightSet);
      return {
        id: g.id,
        title: SOFT_SNAPSHOT_GROUP_TITLE[g.id] || SNAPSHOT_GROUP_TITLE[g.id],
        editKey: SNAPSHOT_GROUP_EDIT_KEY[g.id] || facts[0]?.editKey || null,
        relevant: facts.some((f) => f.relevant),
        showEquipmentCta: g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGWUNSCH,
        facts,
      };
    });

  const softFacts = softGroups.flatMap((g) => g.facts);
  const softSummary = buildSnapshotSummary(
    softGroups,
    options.maxSummaryTokens ?? SNAPSHOT_SUMMARY_MAX_TOKENS,
  );
  const softChips = flattenSnapshotChips(softGroups);
  const kernChips = annotateFacts(kern.chips, relevantSet, highlightSet);
  const workingContext = buildWorkingContextStrip(workingContextItems, lead);

  // Soft-only: kein Duplikat der Kernzeile als Arbeitskontext, wenn Kern schon Deal zeigt
  const showWorkingStrip = Boolean(workingContext?.line)
    && !(kern.hasData && (kern.source === 'deal' || kern.source === 'mixed'));

  const hasSoft = softFacts.length > 0
    || softGroups.some((g) => g.showEquipmentCta);
  const hasKern = Boolean(kern.hasData);

  return {
    meta: {
      hasData: hasSoft || hasKern,
      hasSoft,
      hasKern,
      factCount: softFacts.length + kernChips.length,
      source: understanding?.meta?.source ?? ((hasSoft || hasKern) ? 'lead' : 'none'),
      updatedAt: understanding?.meta?.updatedAt ?? profile.updatedAt ?? lead?.updatedAt ?? null,
    },
    kern: {
      ...kern,
      chips: kernChips,
    },
    soft: {
      title: 'Kundeninfos & Wünsche',
      summary: softSummary,
      groups: softGroups,
      chips: softChips,
      hasData: hasSoft,
    },
    /** @deprecated use soft.summary */
    summary: softSummary,
    /** Soft-Gruppen (Notizen zuletzt) */
    groups: softGroups,
    /** Soft-Chips – keine Kernkonditionen */
    chips: softChips,
    softChips,
    kernChips,
    workingContext: showWorkingStrip ? workingContext : null,
  };
}
