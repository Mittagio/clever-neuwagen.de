/**
 * Kundenbild – kanonische Informationshierarchie:
 * Header: Name · Fahrzeugtrack · Zahlungsart · Kontaktstatus
 * Kern: Laufzeit · Jahreskilometer · Anzahlung · Vertragsende (nur bestätigt)
 * Soft „Kundenwissen“ (nur nicht-leere Gruppen):
 *   1 Mensch & Alltag · 2 Fahrzeugpräferenz · 3 Ausstattung & Technik
 *   4 Bestandsfahrzeug · 5 Persönlich
 * Strukturierte Fakten nie als Freinotizen; Offer/PDF überschreibt Customer Truth nicht.
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

/** Soft-Gruppen unter „Kundenwissen“ – kanonische Taxonomie. Legacy-Keys als Alias. */
export const SOFT_SNAPSHOT_GROUP = {
  /** HUMAN_AND_USAGE */
  MENSCH_ALLTAG: 'menschAlltag',
  /** VEHICLE_PREFERENCE */
  FAHRZEUGPRAEFERENZ: 'fahrzeugpraeferenz',
  /** EQUIPMENT_AND_TECH */
  AUSSTATTUNG_TECHNIK: 'ausstattungTechnik',
  /** EXISTING_VEHICLE */
  BESTAND: 'bestand',
  /** PERSONAL_NOTE */
  PERSOENLICH: 'persoenlich',
  /** @deprecated → FAHRZEUGPRAEFERENZ (Anzeige-Split) */
  ANFORDERUNGEN: 'fahrzeugpraeferenz',
  /** @deprecated → MENSCH_ALLTAG */
  KUNDE_ALLTAG: 'menschAlltag',
  /** @deprecated → FAHRZEUGPRAEFERENZ */
  FAHRZEUGWUNSCH: 'fahrzeugpraeferenz',
  /** @deprecated → AUSSTATTUNG_TECHNIK */
  WICHTIG_AUSWAHL: 'ausstattungTechnik',
  /** @deprecated → PERSOENLICH */
  NOTIZEN: 'persoenlich',
};

export const SOFT_SNAPSHOT_GROUP_TITLE = {
  [SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG]: 'Mensch & Alltag',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ]: 'Fahrzeugpräferenz',
  [SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK]: 'Ausstattung & Technik',
  [SOFT_SNAPSHOT_GROUP.BESTAND]: 'Bestandsfahrzeug',
  [SOFT_SNAPSHOT_GROUP.PERSOENLICH]: 'Persönlich',
};

/** Render-Reihenfolge Soft-Gruppen (nur nicht-leere). */
export const SOFT_SNAPSHOT_GROUP_ORDER = Object.freeze([
  SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
  SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
  SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
  SOFT_SNAPSHOT_GROUP.BESTAND,
  SOFT_SNAPSHOT_GROUP.PERSOENLICH,
]);

/** Ausstattungs-Priorität (optional). */
export const EQUIPMENT_WISH_PRIORITY = Object.freeze({
  PREFERRED: 'preferred',
  IMPORTANT: 'important',
  REQUIRED: 'required',
});

export const EQUIPMENT_WISH_PRIORITY_LABEL = Object.freeze({
  [EQUIPMENT_WISH_PRIORITY.REQUIRED]: 'muss',
  [EQUIPMENT_WISH_PRIORITY.IMPORTANT]: 'wichtig',
  [EQUIPMENT_WISH_PRIORITY.PREFERRED]: null,
});

/** @deprecated – Alias: Soft-Gruppen + Legacy-IDs für ältere Imports */
export const SNAPSHOT_GROUP = {
  BEDARF: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
  BESTAND: SOFT_SNAPSHOT_GROUP.BESTAND,
  BUDGET: 'budget',
  WUNSCH: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
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
  [SNAPSHOT_GROUP.BEDARF]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG],
  [SNAPSHOT_GROUP.BUDGET]: 'Budget',
  [SNAPSHOT_GROUP.WUNSCH]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ],
  [SNAPSHOT_GROUP.VERTRAG]: 'Vertragskonditionen',
};

/** Primärer editKey je Soft-Gruppe (Fallback). */
export const SNAPSHOT_GROUP_EDIT_KEY = {
  [SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG]: 'bedarf',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ]: 'vehicleTrack',
  [SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK]: 'equipment',
  [SOFT_SNAPSHOT_GROUP.BESTAND]: 'tradeIn',
  [SOFT_SNAPSHOT_GROUP.PERSOENLICH]: 'bedarf',
  [SNAPSHOT_GROUP.BUDGET]: 'desiredRate',
  [SNAPSHOT_GROUP.VERTRAG]: 'termMonths',
};

/** Kernkonditionen: nur diese bestätigten Vertragsfelder. */
export const KERN_SNAPSHOT_FACT_IDS = Object.freeze([
  'termMonths',
  'mileagePerYear',
  'downPayment',
  'leasingEndDate',
]);

const COLOR_WORD_RE = /^(grau|blau|wei[sß]{1,2}|schwarz|rot|silber|gr[üu]n|beige|bronze|orange|gelb|pearl|ivory|cream|green|blue|grey|gray|white|black|red|silver)$/i;
const DRIVE_WORD_RE = /^(elektro|elektrisch|automatik|schaltgetriebe|benziner|diesel|hybrid|plug-?in|allrad|fwd|rwd|awd)$/i;
const ACTIVITY_NOTE_RE = /beratungsgespr[äa]ch|verkaufsgespr[äa]ch|telefonat|\btermin\b|probefahrt|übergabe|\bgespr[äa]ch\b\s*·/i;
const DATE_IN_TEXT_RE = /\d{1,2}\.\d{1,2}\.\d{2,4}/;
const MODEL_TRIM_RE = /\bev\s*[0-9]\b|\bsportage\b|\bceed\b|\bniro\b|\bsorento\b|\bpicanto\b|\bstonic\b|\bproceed\b|gt-?\s*line|\bspirit\b|\bplatinum\b|\bedition\b|\binteressant\b/i;
const COMMERCIAL_NOTE_RE = /leasing|finanzierung|\bkauf\b|budget|\brate\b|\b\d+\s*monate?\b|\bkm\b|anzahlung|jahreskilometer|vertragsende|down\s*payment/i;
const EQUIPMENT_NOTE_RE = /totwinkel|spurhalte|verkehrszeichen|blind\s*spot|lane\s*keep|w[äa]rmepumpe|\bhud\b|kamera|ahk|anh[äa]nger|panorama|sitzheizung|matrix|ausstattung|kofferraum|head-?up|800\s*v|ladeleistung|assistent|tempomat|notbrems|parkassistent|keyless|induktiv/i;
const BESTAND_NOTE_RE = /inzahlung|gebraucht|\(gw\)|bestands|r[üu]ckl[äa]ufer|trade-?\s*in/i;
const HUMAN_USAGE_NOTE_RE = /^(familie|kinder|\d+\s*kinder?|hund|haustier|haus|wohnung|platz|langstrecke|pendeln|erstwagen|zweitwagen)$/i;
const PRIORITY_SUFFIX_RE = /\s*[·|]\s*(muss|wichtig|nice|preferred|important|required)\s*$/i;
const REQUIRED_PHRASE_RE = /m[uü]ssen\s+drin|muss\s+drin|pflicht|zwingend|unbedingt\s+drin/i;
const IMPORTANT_PHRASE_RE = /\bwichtig\b|\bpriorit/i;
const PREFERRED_PHRASE_RE = /w[äa]re\s+sch[öo]n|nice\s*to\s*have|wenn\s+m[öo]glich/i;

/**
 * Liest optionale Priorität aus Label-Suffix oder Seller-Phrase.
 * @returns {'preferred'|'important'|'required'}
 */
export function parseEquipmentWishPriority(label = '', contextText = '') {
  const text = String(label ?? '').trim();
  const suffix = text.match(PRIORITY_SUFFIX_RE);
  if (suffix) {
    const token = suffix[1].toLowerCase();
    if (token === 'muss' || token === 'required') return EQUIPMENT_WISH_PRIORITY.REQUIRED;
    if (token === 'wichtig' || token === 'important') return EQUIPMENT_WISH_PRIORITY.IMPORTANT;
    return EQUIPMENT_WISH_PRIORITY.PREFERRED;
  }
  const blob = `${text} ${contextText || ''}`.toLowerCase();
  if (REQUIRED_PHRASE_RE.test(blob)) return EQUIPMENT_WISH_PRIORITY.REQUIRED;
  if (PREFERRED_PHRASE_RE.test(blob)) return EQUIPMENT_WISH_PRIORITY.PREFERRED;
  if (IMPORTANT_PHRASE_RE.test(blob)) return EQUIPMENT_WISH_PRIORITY.IMPORTANT;
  return EQUIPMENT_WISH_PRIORITY.PREFERRED;
}

/** Basis-Label ohne Prioritäts-Suffix. */
export function stripEquipmentPrioritySuffix(label = '') {
  return String(label ?? '').replace(PRIORITY_SUFFIX_RE, '').trim();
}

/** Anzeige-Label inkl. optionaler Priorität (preferred → ohne Suffix). */
export function formatEquipmentWishLabel(baseLabel = '', priority = EQUIPMENT_WISH_PRIORITY.PREFERRED) {
  const base = stripEquipmentPrioritySuffix(baseLabel);
  if (!base) return '';
  const suffix = EQUIPMENT_WISH_PRIORITY_LABEL[priority] ?? null;
  return suffix ? `${base} · ${suffix}` : base;
}

/**
 * Klassifiziert Seller-/Notiz-Labels für Display-Migration.
 * structured → kanonischer Slot (nie Freinotiz); activity → Chat/Termine; free → Persönlich.
 * @returns {{ kind: 'empty'|'activity'|'structured'|'free', slot?: string, remapLabel?: string|null, priority?: string|null, groupId?: string }}
 */
export function classifySnapshotNoteLabel(label = '') {
  const raw = String(label ?? '').trim();
  if (!raw) return { kind: 'empty' };
  const priorityFromSuffix = PRIORITY_SUFFIX_RE.test(raw)
    ? parseEquipmentWishPriority(raw)
    : null;
  const text = stripEquipmentPrioritySuffix(raw);
  const lower = text.toLowerCase();

  if (
    ACTIVITY_NOTE_RE.test(text)
    || (DATE_IN_TEXT_RE.test(text) && /gespr[äa]ch|termin|uhr|besuch|beratung/i.test(text))
  ) {
    return { kind: 'activity', slot: 'activity' };
  }

  if (COMMERCIAL_NOTE_RE.test(text)) {
    return { kind: 'structured', slot: 'commercial', remapLabel: null };
  }

  if (DRIVE_WORD_RE.test(lower) || /\bantrieb\b|\bgetriebe\b/i.test(text)) {
    const remap = lower.charAt(0).toUpperCase() + lower.slice(1);
    return {
      kind: 'structured',
      slot: 'drive',
      remapLabel: remap,
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
    };
  }

  if (COLOR_WORD_RE.test(lower) || (/^farbe\b|lackierung/i.test(text) && text.length < 28)) {
    const remap = COLOR_WORD_RE.test(lower)
      ? lower.charAt(0).toUpperCase() + lower.slice(1)
      : text;
    return {
      kind: 'structured',
      slot: 'color',
      remapLabel: remap,
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
    };
  }

  if (MODEL_TRIM_RE.test(text) && !/kaffee|frau|kommt|samstag|entscheid/i.test(text)) {
    return {
      kind: 'structured',
      slot: 'vehicleTrack',
      remapLabel: null,
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
    };
  }

  if (EQUIPMENT_NOTE_RE.test(text)) {
    const priority = priorityFromSuffix || parseEquipmentWishPriority(raw);
    return {
      kind: 'structured',
      slot: 'equipment',
      remapLabel: text,
      priority,
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
    };
  }

  if (BESTAND_NOTE_RE.test(text)) {
    return {
      kind: 'structured',
      slot: 'bestand',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
    };
  }

  if (HUMAN_USAGE_NOTE_RE.test(lower) || /^\d+\s*kinder?\b/i.test(text)) {
    return {
      kind: 'structured',
      slot: 'human',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
    };
  }

  if (/termin|probefahrt|übergabe/i.test(text) && DATE_IN_TEXT_RE.test(text)) {
    return { kind: 'activity', slot: 'activity' };
  }

  return {
    kind: 'free',
    groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICH,
  };
}

export function isActivitySnapshotNote(label = '') {
  return classifySnapshotNoteLabel(label).kind === 'activity';
}

export function isStructuredSnapshotNote(label = '') {
  return classifySnapshotNoteLabel(label).kind === 'structured';
}

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
  blind_spot: 'Totwinkelassistent',
  lane_assist: 'Spurhalteassistent',
  traffic_sign: 'Verkehrszeichenerkennung',
  towbar: 'AHK',
};

const FUEL_DISPLAY = {
  electric: 'Elektro',
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  phev: 'Plug-in-Hybrid',
  diesel: 'Diesel',
  benzin: 'Benziner',
  verbrenner: 'Benziner',
};

const TRANSMISSION_DISPLAY = {
  automatic: 'Automatik',
  manual: 'Schalter',
  automatik: 'Automatik',
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
  priority = null,
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
    ...(priority ? { priority } : {}),
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

function resolveProfileChildren(profile = {}) {
  if (profile.children != null && profile.children !== false) return profile.children;
  const fromHousehold = profile.household?.childrenCount;
  if (fromHousehold != null && fromHousehold !== false) return fromHousehold;
  return null;
}

function buildMenschAlltagFacts(profile = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];
  const childrenLabel = formatChildren(resolveProfileChildren(profile));
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 10,
      icon: 'alltag',
    }));
    usedLabels.add(childrenLabel.toLowerCase());
    usedLabels.add('familie');
    usedLabels.add('kinder');
  }

  const hasFamily = profile.priorities?.includes('family')
    || Boolean(resolveProfileChildren(profile))
    || (profile.persons ?? 0) >= 5;
  if (hasFamily && !childrenLabel) {
    pushFact(facts, fact('family', 'Familie', {
      editKey: 'family',
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
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
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
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
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 14,
    }));
    usedLabels.add('haus');
    usedLabels.add('laden zuhause');
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
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 16,
    }));
    usedLabels.add(spaceLabel.toLowerCase());
  }

  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    if (!usedLabels.has('langstrecke') && !usedLabels.has('reichweite')) {
      pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
        editKey: 'usage',
        groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
        tint: SNAPSHOT_TINT.ALLTAG,
        summaryPriority: 17,
      }));
      usedLabels.add('langstrecke');
    }
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 18,
    }));
    usedLabels.add(label.toLowerCase());
  }

  return facts;
}

/** Entscheidende Auswahl-Prioritäten (Ladezeit/Reichweite) → Ausstattung & Technik. */
function buildDecisiveRequirementFacts(profile = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];

  for (const key of profile.priorities ?? []) {
    if (key === 'family' || key === 'towing' || key === 'budget' || key === 'space') continue;
    const label = SELECTION_PRIORITY_LABELS[key];
    if (!label) continue;
    if (usedLabels.has(label.toLowerCase())) continue;
    pushFact(facts, fact(`priority:${key}`, label, {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      tint: SNAPSHOT_TINT.WICHTIG,
      // Summary: nach Bestand, vor Fahrzeugpräferenz
      summaryPriority: key === 'charging' ? 25 : key === 'range' ? 26 : 28,
    }));
    usedLabels.add(label.toLowerCase());
  }

  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured') continue;
    if (classified.slot === 'color' || classified.slot === 'drive' || classified.slot === 'equipment') {
      continue;
    }
    if (classified.slot === 'vehicleTrack' || classified.slot === 'commercial' || classified.slot === 'bestand') {
      continue;
    }
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (/ladezeit|reichweite|wichtig|priorit/i.test(label)
      && !/leasing|finanz|rate|km|monat|platz/i.test(label)) {
      pushFact(facts, fact(`seller-wichtig:${label}`, label, {
        editKey: 'bedarf',
        groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
        tint: SNAPSHOT_TINT.WICHTIG,
        summaryPriority: 27,
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

/**
 * Strukturierte Seller-Labels → Fahrzeugpräferenz oder Ausstattung.
 * Modell/Trim/Activity/Commercial werden ausgeschlossen (Header/Kern/Chat).
 */
function buildRemappedStructuredFacts(sellerLabels = [], usedLabels = new Set()) {
  const preferenceFacts = [];
  const equipmentFacts = [];
  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured') continue;
    if (
      classified.slot === 'vehicleTrack'
      || classified.slot === 'commercial'
      || classified.slot === 'bestand'
      || classified.slot === 'human'
    ) {
      usedLabels.add(label.toLowerCase());
      continue;
    }
    if (classified.slot !== 'color' && classified.slot !== 'drive' && classified.slot !== 'equipment') {
      usedLabels.add(label.toLowerCase());
      continue;
    }
    const remap = String(classified.remapLabel || stripEquipmentPrioritySuffix(label)).trim();
    if (!remap) {
      usedLabels.add(label.toLowerCase());
      continue;
    }
    const lower = remap.toLowerCase();
    if (usedLabels.has(lower)) continue;

    if (classified.slot === 'equipment') {
      const priority = classified.priority || parseEquipmentWishPriority(label);
      const display = formatEquipmentWishLabel(remap, priority);
      pushFact(equipmentFacts, fact(`equip-note:${remap}`, display, {
        editKey: 'equipment',
        relevanceKey: 'equipment',
        groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
        tint: SNAPSHOT_TINT.WICHTIG,
        summaryPriority: priority === EQUIPMENT_WISH_PRIORITY.REQUIRED
          ? 28
          : priority === EQUIPMENT_WISH_PRIORITY.IMPORTANT
            ? 48
            : 55,
        icon: 'car',
        priority,
      }));
    } else {
      const idPrefix = classified.slot === 'color' ? 'color' : 'drive';
      pushFact(preferenceFacts, fact(`${idPrefix}:${remap}`, remap, {
        editKey: classified.slot === 'color' ? 'vehicleTrack' : 'equipment',
        relevanceKey: classified.slot === 'color' ? 'preferredColor' : classified.slot,
        groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
        tint: SNAPSHOT_TINT.FAHRZEUG,
        miniEditor: classified.slot === 'color' ? SNAPSHOT_MINI_EDITOR.COLOR : null,
        summaryPriority: classified.slot === 'color' ? 35 : 36,
        icon: 'car',
      }));
    }
    usedLabels.add(lower);
    usedLabels.add(label.toLowerCase());
    usedLabels.add(stripEquipmentPrioritySuffix(label).toLowerCase());
  }
  return { preferenceFacts, equipmentFacts };
}

/**
 * Nur bestätigter Kundenwunsch für Kern – kein Offer/PDF-Fallback.
 * @returns {{ value: *, source: 'wish' }|null}
 */
function resolveConfirmedKernWishValue(kind, wishValue, offerTerms) {
  if (wishValue == null || String(wishValue).trim() === '') return null;
  if (isOfferOnlyCommercialValue(kind, wishValue, offerTerms)) return null;
  return { value: wishValue, source: 'wish' };
}

/**
 * Immer sichtbare Kernkonditionen – nur Laufzeit · km · AZ · Vertragsende.
 * Zahlungsart + Fahrzeugtrack liegen im Header; Offer/PDF überschreibt nicht.
 */
export function buildKernKonditionen(lead = {}, profile = {}, options = {}) {
  const workingContextItems = options.workingContextItems ?? [];
  const offerTerms = collectOfferCommercialTerms(lead, workingContextItems);
  const chips = [];
  const sources = new Set();

  const termResolved = resolveConfirmedKernWishValue(
    'termMonths',
    lead?.wish?.termMonths ?? profile?.leaseDurationMonths ?? null,
    offerTerms,
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

  const kmResolved = resolveConfirmedKernWishValue(
    'mileage',
    lead?.wish?.mileagePerYear ?? profile?.annualKm ?? null,
    offerTerms,
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

  const downResolved = resolveConfirmedKernWishValue(
    'downPayment',
    lead?.wish?.downPayment ?? profile?.budget?.downPayment ?? null,
    offerTerms,
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

  const endResolved = resolveConfirmedKernWishValue(
    'endDate',
    lead?.wish?.leasingEndDate ?? lead?.leasingEndDate ?? lead?.crm?.leasingEndDate ?? null,
    offerTerms,
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

  const lineParts = chips.map((c) => c.label);

  return {
    title: 'Kernkonditionen',
    source: sources.size ? 'wish' : 'none',
    line: lineParts.join(' · '),
    parts: lineParts,
    chips,
    vehicleLabel: null,
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
      summaryPriority: 22,
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
      summaryPriority: 23,
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
      summaryPriority: 24,
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

/** Bestätigter Fahrzeugwunsch-Chip – nur für Header-Dedupe, nicht Soft/Kern. */
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
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 34,
      icon: 'car',
    });
  }
  if (modelLabel) {
    return fact(favorite ? `track-fav:${favorite.id}` : 'modelHint', modelLabel, {
      editKey: 'vehicleTrack',
      relevanceKey: favorite ? 'favoriteVehicle' : 'preferredModel',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 34,
      icon: 'car',
    });
  }
  if (trimLabel) {
    return fact('trim', trimLabel, {
      editKey: 'equipment',
      relevanceKey: 'trim',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 34,
      icon: 'car',
    });
  }
  return null;
}

/**
 * Header-Fakten (Fahrzeugtrack + Zahlungsart) – zur Deduplizierung gegen Soft/Kern.
 */
export function resolveHeaderDedupeLabels(lead = {}, profile = {}) {
  const labels = new Set();
  const payment = resolvePaymentType(lead, profile);
  if (payment && PAYMENT_LABELS[payment]) {
    labels.add(PAYMENT_LABELS[payment].toLowerCase());
  }
  const vehicleChip = buildConfirmedVehicleWishChip(lead, profile);
  if (vehicleChip?.label) {
    labels.add(vehicleChip.label.toLowerCase());
    for (const part of String(vehicleChip.label).split(/\s*[·|/]\s*/)) {
      const p = part.trim().toLowerCase();
      if (p) labels.add(p);
    }
  }
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  for (const track of tracks) {
    const name = String(track.displayName || track.modelLabel || '').trim().toLowerCase();
    if (name) labels.add(name);
  }
  return labels;
}

/**
 * Fahrzeugpräferenz – Farbe, Antrieb, Getriebe, Karosserie/Design.
 * Kein Fahrzeugtrack/Trim (Header), keine Kernkonditionen.
 */
function buildFahrzeugpraeferenzFacts(
  lead = {},
  profile = {},
  usedLabels = new Set(),
  remappedPreferenceFacts = [],
) {
  const facts = [];
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));

  // Modell/Trim nur als usedLabels markieren (Header), nie als Soft-Chip
  const vehicleChip = buildConfirmedVehicleWishChip(lead, profile);
  if (vehicleChip?.label) {
    usedLabels.add(vehicleChip.label.toLowerCase());
    for (const part of String(vehicleChip.label).split(/\s*[·|/]\s*/)) {
      const p = part.trim().toLowerCase();
      if (p) usedLabels.add(p);
    }
  }

  const colors = [...new Set([
    ...tracks.map((t) => t.config?.vehicleTrack?.preferredColor).filter(Boolean),
    profile.colorPreference,
    profile.colorHint,
  ].filter(Boolean))];
  for (const color of colors.slice(0, 2)) {
    const colorLabel = String(color).trim();
    const display = COLOR_WORD_RE.test(colorLabel)
      ? colorLabel.charAt(0).toUpperCase() + colorLabel.slice(1).toLowerCase()
      : colorLabel;
    pushFact(facts, fact(`color:${display}`, display, {
      editKey: 'vehicleTrack',
      relevanceKey: 'preferredColor',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.COLOR,
      summaryPriority: 35,
      icon: 'car',
    }));
    usedLabels.add(display.toLowerCase());
  }

  const fuelLabel = FUEL_DISPLAY[profile.fuel] || null;
  if (fuelLabel && !usedLabels.has(fuelLabel.toLowerCase())) {
    pushFact(facts, fact('fuel', fuelLabel, {
      editKey: 'equipment',
      relevanceKey: 'drive',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 36,
      icon: 'car',
    }));
    usedLabels.add(fuelLabel.toLowerCase());
  }

  const transmissionLabel = TRANSMISSION_DISPLAY[profile.transmission] || null;
  if (transmissionLabel && !usedLabels.has(transmissionLabel.toLowerCase())) {
    pushFact(facts, fact('transmission', transmissionLabel, {
      editKey: 'equipment',
      relevanceKey: 'drive',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 36,
      icon: 'car',
    }));
    usedLabels.add(transmissionLabel.toLowerCase());
  }

  for (const remapped of remappedPreferenceFacts) {
    pushFact(facts, remapped);
  }

  const delivery = lead?.wish?.desiredDeliveryDate || lead?.deliveryTime || '';
  if (String(delivery).trim()) {
    pushFact(facts, fact('delivery', `Lieferzeit ${String(delivery).trim()}`, {
      editKey: 'delivery',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 38,
    }));
  } else if (tracks.some((t) => (
    t.config?.vehicleTrack?.deliveryTimeImportance === 'high'
    || t.config?.vehicleTrack?.deliveryTimeImportance === true
  ))) {
    pushFact(facts, fact('delivery', 'Lieferzeit wichtig', {
      editKey: 'delivery',
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 38,
    }));
  }

  return facts;
}

/**
 * Ausstattung & Technik – inkl. entscheidender Anforderungen und Priorität.
 */
function buildAusstattungTechnikFacts(
  lead = {},
  profile = {},
  sellerLabels = [],
  usedLabels = new Set(),
  remappedEquipmentFacts = [],
) {
  const facts = [];

  for (const f of buildDecisiveRequirementFacts(profile, sellerLabels, usedLabels)) {
    pushFact(facts, f);
  }

  for (const remapped of remappedEquipmentFacts) {
    pushFact(facts, remapped);
  }

  if (profile.towbar || profile.towing === 'yes' || profile.towing === 'braked'
    || (profile.towCapacityKg ?? 0) >= 750
    || profile.priorities?.includes('towing')) {
    pushFact(facts, fact('towbar', 'AHK', {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 50,
      icon: 'car',
    }));
    usedLabels.add('ahk');
  }

  const priorities = profile.equipmentWishPriorities || {};
  for (const wishId of profile.equipmentWishes ?? []) {
    const raw = String(wishId ?? '').trim();
    if (!raw) continue;
    const mapped = EQUIPMENT_LABELS[raw] || (
      /800\s*v/i.test(raw) || EQUIPMENT_NOTE_RE.test(raw) ? stripEquipmentPrioritySuffix(raw) : null
    );
    if (!mapped) continue;
    if (/line|spirit|platinum|edition/i.test(mapped)) continue;
    const priority = priorities[raw]
      || priorities[mapped]
      || parseEquipmentWishPriority(raw);
    const display = formatEquipmentWishLabel(mapped, priority);
    if (usedLabels.has(mapped.toLowerCase())) continue;
    pushFact(facts, fact(`equip:${mapped}`, display, {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: priority === EQUIPMENT_WISH_PRIORITY.REQUIRED
        ? 28
        : priority === EQUIPMENT_WISH_PRIORITY.IMPORTANT
          ? 48
          : 55,
      icon: 'car',
      priority,
    }));
    usedLabels.add(mapped.toLowerCase());
  }

  for (const tech of profile.technology ?? []) {
    const text = String(tech ?? '').trim();
    if (!text) continue;
    const classified = classifySnapshotNoteLabel(text);
    if (classified.kind === 'structured' && classified.slot === 'vehicleTrack') {
      usedLabels.add(text.toLowerCase());
      continue;
    }
    if (classified.kind === 'structured' && (classified.slot === 'color' || classified.slot === 'drive')) {
      usedLabels.add(text.toLowerCase());
      continue;
    }
    const base = stripEquipmentPrioritySuffix(classified.remapLabel || text);
    if (usedLabels.has(base.toLowerCase())) continue;
    const priority = classified.priority || parseEquipmentWishPriority(text);
    const display = formatEquipmentWishLabel(base, priority);
    pushFact(facts, fact(`tech:${base}`, display, {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: priority === EQUIPMENT_WISH_PRIORITY.REQUIRED ? 28 : 54,
      icon: 'car',
      priority,
    }));
    usedLabels.add(base.toLowerCase());
  }

  return facts;
}

/** Persönlich – nur unstrukturierte Notizen; Activity/strukturiert ausgeschlossen. */
function buildPersoenlichFacts(lead = {}, sellerLabels = [], usedLabels = new Set()) {
  const facts = [];

  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'free') continue;
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (label.length < 3) continue;
    pushFact(facts, fact(`note:${label}`, label, {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICH,
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
      const classified = classifySnapshotNoteLabel(short);
      if (classified.kind !== 'free') {
        usedLabels.add(short.toLowerCase());
        continue;
      }
      const lower = short.toLowerCase();
      if (usedLabels.has(lower)) continue;
      pushFact(facts, fact(`cnote:${short}`, short, {
        editKey: 'bedarf',
        groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICH,
        tint: SNAPSHOT_TINT.NOTIZ,
        summaryPriority: 72,
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

function omitFactsByDedupe(facts = [], omitLabels = new Set(), omitIds = new Set()) {
  return facts.filter((f) => {
    if (omitIds.has(f.id)) return false;
    const lower = String(f.label || '').toLowerCase();
    if (omitLabels.has(lower)) return false;
    if (KERN_SNAPSHOT_FACT_IDS.includes(f.id)) return false;
    if (f.id === 'paymentType' || f.id === 'vehicleWish' || f.id === 'trim'
      || String(f.id).startsWith('track-fav') || f.id === 'modelHint' || f.id === 'tracks') {
      return false;
    }
    return true;
  });
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
  const headerLabels = resolveHeaderDedupeLabels(lead, profile);

  const kern = buildKernKonditionen(lead, profile, { workingContextItems });
  const kernOmitLabels = new Set([
    ...headerLabels,
    ...kern.chips.map((c) => String(c.label).toLowerCase()),
  ]);
  const kernOmitIds = new Set(kern.chips.map((c) => c.id));

  for (const label of headerLabels) usedLabels.add(label);

  // Strukturierte Remaps einmalig (Farbe/Antrieb → Präferenz, Equipment → Ausstattung)
  const remapped = buildRemappedStructuredFacts(sellerLabels, usedLabels);
  const menschFacts = buildMenschAlltagFacts(profile, sellerLabels, usedLabels);
  const praeferenzFacts = buildFahrzeugpraeferenzFacts(
    lead,
    profile,
    usedLabels,
    remapped.preferenceFacts,
  );
  const ausstattungFacts = buildAusstattungTechnikFacts(
    lead,
    profile,
    sellerLabels,
    usedLabels,
    remapped.equipmentFacts,
  );
  const bestandFacts = buildBestandFacts(lead, profile, usedLabels);
  const persoenlichFacts = buildPersoenlichFacts(lead, sellerLabels, usedLabels);

  const softGroupsSpec = [
    {
      id: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG,
      facts: omitFactsByDedupe(menschFacts, kernOmitLabels, kernOmitIds),
    },
    {
      id: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      facts: omitFactsByDedupe(praeferenzFacts, kernOmitLabels, kernOmitIds),
    },
    {
      id: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      facts: omitFactsByDedupe(ausstattungFacts, kernOmitLabels, kernOmitIds),
    },
    {
      id: SOFT_SNAPSHOT_GROUP.BESTAND,
      facts: omitFactsByDedupe(bestandFacts, kernOmitLabels, kernOmitIds),
    },
    {
      id: SOFT_SNAPSHOT_GROUP.PERSOENLICH,
      facts: omitFactsByDedupe(persoenlichFacts, kernOmitLabels, kernOmitIds),
    },
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

  const softGroups = softGroupsSpec
    .filter((g) => g.facts.length > 0)
    .map((g) => {
      const facts = annotateFacts(g.facts, relevantSet, highlightSet);
      return {
        id: g.id,
        title: SOFT_SNAPSHOT_GROUP_TITLE[g.id] || SNAPSHOT_GROUP_TITLE[g.id],
        editKey: SNAPSHOT_GROUP_EDIT_KEY[g.id] || facts[0]?.editKey || null,
        relevant: facts.some((f) => f.relevant),
        showEquipmentCta: g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
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

  // Working Context = Angebots-Kontext, überschreibt Customer Truth nicht
  const showWorkingStrip = Boolean(workingContext?.line);

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
      title: 'Kundenwissen',
      summary: softSummary,
      groups: softGroups,
      chips: softChips,
      hasData: hasSoft,
    },
    /** @deprecated use soft.summary */
    summary: softSummary,
    /** Soft-Gruppen (Mensch · Präferenz · Ausstattung · Bestand · Persönlich) */
    groups: softGroups,
    /** Soft-Chips – keine Header-/Kern-Duplikate */
    chips: softChips,
    softChips,
    kernChips,
    workingContext: showWorkingStrip ? workingContext : null,
  };
}
