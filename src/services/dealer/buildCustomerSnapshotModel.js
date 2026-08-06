/**
 * Kundenbild – kompaktes Snapshot-Modell aus bestätigter Customer Truth.
 * Nur Lead-Daten (needProfile, sellerInsights, wish, tradeIn, tracks).
 * Working Context / Offer-PDF-Konditionen fließen nicht als Wunsch ein.
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

/** Display-Gruppen (feste Chip-Reihenfolge: Mensch → Bestand → Budget → Wunsch → Vertrag). */
export const SNAPSHOT_GROUP = {
  BEDARF: 'bedarf',
  BESTAND: 'bestand',
  BUDGET: 'budget',
  WUNSCH: 'wunsch',
  VERTRAG: 'vertrag',
  /** @deprecated use BUDGET – Alias für ältere Imports */
  BUDGET_VERTRAG: 'budget',
};

/** Tint-/Fakten-Kategorien (Budget ≠ Vertrag für Soft-Tint). */
export const SNAPSHOT_TINT = {
  ALLTAG: 'alltag',
  BUDGET: 'budget',
  VERTRAG: 'vertrag',
  FAHRZEUG: 'fahrzeug',
  INZAHLUNGNAHME: 'inzahlungnahme',
};

export const SNAPSHOT_GROUP_TITLE = {
  [SNAPSHOT_GROUP.BEDARF]: 'Mensch und Nutzung',
  [SNAPSHOT_GROUP.BESTAND]: 'Bestandsfahrzeug',
  [SNAPSHOT_GROUP.BUDGET]: 'Budget',
  [SNAPSHOT_GROUP.WUNSCH]: 'Fahrzeugwunsch',
  [SNAPSHOT_GROUP.VERTRAG]: 'Vertragskonditionen',
};

/** Primärer editKey je Display-Gruppe (Fallback). */
export const SNAPSHOT_GROUP_EDIT_KEY = {
  [SNAPSHOT_GROUP.BEDARF]: 'bedarf',
  [SNAPSHOT_GROUP.BESTAND]: 'tradeIn',
  [SNAPSHOT_GROUP.BUDGET]: 'desiredRate',
  [SNAPSHOT_GROUP.WUNSCH]: 'vehicleTrack',
  [SNAPSHOT_GROUP.VERTRAG]: 'termMonths',
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
 * Arbeitskontext-Zeile unter Kundenbild (Offer-PDF-Konditionen, keine Truth).
 * @returns {{ title: string, line: string, parts: string[] }|null}
 */
export function buildWorkingContextStrip(workingContextItems = [], lead = {}) {
  const offers = (workingContextItems ?? []).filter((item) => isOfferWorkingItem(item));
  const primary = offers[0] || null;

  // Fallback: frisches Magic-/PDF-Angebot auf dem Lead ohne Composer-Anhang
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

function buildBedarfFacts(profile = {}, sellerLabels = []) {
  const facts = [];
  const childrenLabel = formatChildren(profile.children);
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 10,
      icon: 'alltag',
    }));
  }

  // „Familie“ nur ohne konkreten Kinder-Chip (sonst redundant in der Summary)
  const hasFamily = profile.priorities?.includes('family')
    || Boolean(profile.children)
    || (profile.persons ?? 0) >= 5;
  if (hasFamily && !childrenLabel) {
    pushFact(facts, fact('family', 'Familie', {
      editKey: 'family',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 15,
      icon: 'alltag',
    }));
  }

  if (profile.dog) {
    pushFact(facts, fact('dog', 'Hund', {
      editKey: 'dog',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.DOG,
      summaryPriority: 12,
      icon: 'alltag',
    }));
  }

  if (profile.chargingAtHome === 'yes') {
    pushFact(facts, fact('chargingAtHome', 'Laden zuhause', {
      editKey: 'bedarf',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 36,
    }));
  }

  if (profile.priorities?.includes('space') || profile.bodyType === 'suv') {
    pushFact(facts, fact('space', profile.bodyType === 'suv' ? 'SUV / Platz' : 'Platz', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 35,
    }));
  } else if ((profile.persons ?? 0) >= 7) {
    pushFact(facts, fact('space', '7 Sitze', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 35,
    }));
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 40,
    }));
  }
  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 40,
    }));
  }

  for (const wishId of profile.equipmentWishes ?? []) {
    const label = EQUIPMENT_LABELS[wishId];
    if (!label) continue;
    pushFact(facts, fact(`equip:${wishId}`, label, {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 55,
    }));
  }

  for (const label of sellerLabels) {
    if (/leasing|finanz|kauf|budget|rate|km|monat|anzahlung/i.test(label)) continue;
    if (/favorit|ablehn|farbe|liefer/i.test(label)) continue;
    if (/inzahlung|gebraucht|\(gw\)|rückläufer|bestands/i.test(label)) continue;
    if (facts.some((f) => f.label.toLowerCase() === label.toLowerCase())) continue;
    if (/kind|hund|familie|platz|sitz|anhänger|urlaub|pendel|langstrecke|koffer|wärmepumpe|hud|kamera|haus/i.test(label)) {
      pushFact(facts, fact(`seller:${label}`, label, {
        editKey: 'bedarf',
        groupId: SNAPSHOT_GROUP.BEDARF,
        tint: SNAPSHOT_TINT.ALLTAG,
        summaryPriority: 45,
      }));
    }
  }

  return facts;
}

function buildBudgetFacts(lead = {}, profile = {}, options = {}) {
  const facts = [];
  const offerTerms = collectOfferCommercialTerms(lead, options.workingContextItems);
  const rate = resolveConfirmedWishRate(lead, profile, options);
  const rateMode = resolveRateMode(lead, profile);
  const rateLabel = formatEuroApprox(rate, rateMode);
  if (rateLabel) {
    pushFact(facts, fact('rate', rateLabel, {
      editKey: 'desiredRate',
      relevanceKey: 'desiredRate',
      groupId: SNAPSHOT_GROUP.BUDGET,
      tint: SNAPSHOT_TINT.BUDGET,
      miniEditor: SNAPSHOT_MINI_EDITOR.DESIRED_RATE,
      summaryPriority: 14,
      icon: 'budget',
    }));
  }

  // Anzahlung nur als Budget-Chip wenn bestätigt und nicht Offer-Spiegel
  const down = lead?.wish?.downPayment ?? profile?.budget?.downPayment;
  if (
    down != null
    && String(down).trim() !== ''
    && !isOfferOnlyCommercialValue('downPayment', down, offerTerms)
  ) {
    const short = formatDownPayment(down, { compact: false });
    if (short) {
      pushFact(facts, fact('downPayment', short, {
        editKey: 'downPayment',
        groupId: SNAPSHOT_GROUP.BUDGET,
        tint: SNAPSHOT_TINT.BUDGET,
        miniEditor: SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT,
        summaryPriority: 34,
        icon: 'budget',
      }));
    }
  }

  return facts;
}

/**
 * Vertragskonditionen nur bei bestätigtem Kundenwunsch.
 * Werte, die nur aus offenem PDF/Angebot stammen → Working Context Strip.
 */
function buildVertragFacts(lead = {}, profile = {}, options = {}) {
  const facts = [];
  const offerTerms = collectOfferCommercialTerms(lead, options.workingContextItems);

  const payment = resolvePaymentType(lead, profile);
  if (
    payment
    && PAYMENT_LABELS[payment]
    && !isOfferOnlyCommercialValue('paymentType', payment, offerTerms)
  ) {
    pushFact(facts, fact('paymentType', PAYMENT_LABELS[payment], {
      editKey: 'paymentType',
      groupId: SNAPSHOT_GROUP.VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE,
      summaryPriority: 55,
      icon: 'vertrag',
    }));
  }

  const term = Number(lead?.wish?.termMonths ?? profile?.leaseDurationMonths);
  const termLabel = formatMonths(term);
  if (
    termLabel
    && !isOfferOnlyCommercialValue('termMonths', term, offerTerms)
  ) {
    pushFact(facts, fact('termMonths', termLabel, {
      editKey: 'termMonths',
      groupId: SNAPSHOT_GROUP.VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.TERM_MONTHS,
      summaryPriority: 56,
      icon: 'vertrag',
    }));
  }

  const km = Number(lead?.wish?.mileagePerYear ?? profile?.annualKm);
  const kmLabel = formatKm(km);
  if (
    kmLabel
    && !isOfferOnlyCommercialValue('mileage', km, offerTerms)
  ) {
    pushFact(facts, fact('mileagePerYear', kmLabel, {
      editKey: 'mileagePerYear',
      groupId: SNAPSHOT_GROUP.VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.MILEAGE,
      summaryPriority: 57,
      icon: 'vertrag',
    }));
  }

  const end = lead?.wish?.leasingEndDate
    ?? lead?.leasingEndDate
    ?? lead?.crm?.leasingEndDate
    ?? null;
  if (end && String(end).trim() && !isOfferOnlyCommercialValue('endDate', end, offerTerms)) {
    const endLabel = formatLeasingEndLabel(end);
    if (endLabel) {
      pushFact(facts, fact('leasingEndDate', endLabel, {
        editKey: 'leasingEndDate',
        groupId: SNAPSHOT_GROUP.VERTRAG,
        tint: SNAPSHOT_TINT.VERTRAG,
        miniEditor: SNAPSHOT_MINI_EDITOR.LEASING_END,
        summaryPriority: 58,
        icon: 'vertrag',
      }));
    }
  }

  return facts;
}

function buildBestandFacts(lead = {}, profile = {}) {
  const facts = [];
  const existingLabel = resolveExistingVehicleLabel(lead);
  if (existingLabel) {
    pushFact(facts, fact('existingVehicle', existingLabel, {
      editKey: 'tradeIn',
      relevanceKey: 'existingVehicle',
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 16,
      icon: 'car',
    }));
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
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 48,
    }));
  }

  if (profile.residualTakeover || profile.takeoverPlanned || /rückläufer|anschluss/i.test(profile.timelineLabel ?? '')) {
    pushFact(facts, fact('returner', profile.timelineLabel?.trim() || 'Rückläufer', {
      editKey: 'tradeIn',
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 46,
    }));
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

function buildWunschFacts(lead = {}, profile = {}) {
  const facts = [];
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
  // Modell + Trim zusammen: „EV2 · GT-Line“ (nicht zwei Chips)
  if (modelLabel && trimLabel) {
    const modelCore = String(modelLabel).replace(/\s*[·|].*$/, '').trim();
    const alreadyHasTrim = new RegExp(trimLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      .test(modelLabel);
    const combined = alreadyHasTrim ? modelLabel : `${modelCore} · ${trimLabel}`;
    pushFact(facts, fact('vehicleWish', combined, {
      editKey: 'vehicleTrack',
      relevanceKey: 'favoriteVehicle',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    }));
  } else if (modelLabel) {
    pushFact(facts, fact(favorite ? `track-fav:${favorite.id}` : 'modelHint', modelLabel, {
      editKey: 'vehicleTrack',
      relevanceKey: favorite ? 'favoriteVehicle' : 'preferredModel',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    }));
  } else if (trimLabel) {
    pushFact(facts, fact('trim', trimLabel, {
      editKey: 'equipment',
      relevanceKey: 'trim',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 18,
      icon: 'car',
    }));
  }

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
        groupId: SNAPSHOT_GROUP.WUNSCH,
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
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.COLOR,
      summaryPriority: 52,
      icon: 'car',
    }));
  }

  if (profile.towbar || profile.towing === 'yes' || (profile.towCapacityKg ?? 0) >= 750) {
    pushFact(facts, fact('towbar', 'AHK', {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 42,
      icon: 'car',
    }));
  }

  const delivery = lead?.wish?.desiredDeliveryDate || lead?.deliveryTime || '';
  if (String(delivery).trim()) {
    pushFact(facts, fact('delivery', `Lieferzeit ${String(delivery).trim()}`, {
      editKey: 'delivery',
      groupId: SNAPSHOT_GROUP.WUNSCH,
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
      groupId: SNAPSHOT_GROUP.WUNSCH,
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
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 60,
    }));
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
  // Working Context: Leak-Erkennung + Arbeitskontext-Strip – nie Truth-Quelle für Chips
  const workingContextItems = options.workingContextItems ?? [];

  const profile = getNeedProfileFromLead(lead) ?? {};
  const sellerLabels = collectConfirmedSellerLabels(lead);
  const understanding = buildCustomerUnderstanding(lead);
  const rateOptions = { workingContextItems };

  const bedarfFacts = buildBedarfFacts(profile, sellerLabels);
  const bestandFacts = buildBestandFacts(lead, profile);
  const budgetFacts = buildBudgetFacts(lead, profile, rateOptions);
  const wunschFacts = buildWunschFacts(lead, profile);
  const vertragFacts = buildVertragFacts(lead, profile, rateOptions);

  const groupsSpec = [
    { id: SNAPSHOT_GROUP.BEDARF, facts: bedarfFacts },
    { id: SNAPSHOT_GROUP.BESTAND, facts: bestandFacts },
    { id: SNAPSHOT_GROUP.BUDGET, facts: budgetFacts },
    { id: SNAPSHOT_GROUP.WUNSCH, facts: wunschFacts },
    { id: SNAPSHOT_GROUP.VERTRAG, facts: vertragFacts },
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

  const groups = groupsSpec
    .filter((g) => g.facts.length > 0)
    .map((g) => {
      const facts = g.facts.map((f) => {
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
      return {
        id: g.id,
        title: SNAPSHOT_GROUP_TITLE[g.id],
        editKey: SNAPSHOT_GROUP_EDIT_KEY[g.id] || facts[0]?.editKey || null,
        relevant: facts.some((f) => f.relevant),
        facts,
      };
    });

  const allFacts = groups.flatMap((g) => g.facts);
  const summary = buildSnapshotSummary(
    groups,
    options.maxSummaryTokens ?? SNAPSHOT_SUMMARY_MAX_TOKENS,
  );
  const chips = flattenSnapshotChips(groups);
  const workingContext = buildWorkingContextStrip(workingContextItems, lead);

  return {
    meta: {
      hasData: allFacts.length > 0,
      factCount: allFacts.length,
      source: understanding?.meta?.source ?? (allFacts.length ? 'lead' : 'none'),
      updatedAt: understanding?.meta?.updatedAt ?? profile.updatedAt ?? lead?.updatedAt ?? null,
    },
    summary,
    groups,
    chips,
    workingContext,
  };
}
