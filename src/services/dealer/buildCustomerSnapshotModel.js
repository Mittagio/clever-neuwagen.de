/**
 * Kundenbild – kanonische Informationshierarchie:
 * Header: Name · Fahrzeugtrack · Kontaktstatus
 * Kern „Budget & Konditionen“: Zahlungsart · Laufzeit · km · AZ · Vertragsende
 * Soft „Kundenwissen“ = Zusammenfassung, kein Formular:
 *   Default: 3–5 Summary-Tokens als light Chips (+ Overflow/+N, „Alles anzeigen“)
 *   Panel: Themenzeilen (Persönlich · Entscheidung · Fahrzeugwunsch · Wichtig · …)
 *   Erfassung primär Composer-NL / Merken (Zero-Loss); kein Kontakt-Missing in Soft
 *   Provenance: Desktop title/hover; Mobile im Expanded-Detail
 * Fahrzeug & Bestand (GW/Vertrag/Inzahlungnahme) bleibt im Lead-Modell,
 * erscheint aber nicht als sichtbarer Kundenwissen-Bucket.
 * Unfall/Ersatz → Persönliches (Warum gesucht wird).
 * Current Truth: ein aktueller Slot-Wert; ältere Werte → historical (nicht als Chip).
 * Strukturierte Fakten nie als Freinotizen. Offer-Raten ≠ Wunschrate;
 * Deal-Konditionen (Laufzeit/km/AZ) dürfen aus Wish oder aktivem Offer-Kontext kommen.
 */
import { getNeedProfileFromLead, modelDisplayLabel } from '../consultation/needProfileService.js';
import {
  canonicalHandoffEquipmentLabel,
  isHandoffEquipmentLabel,
} from '../consultation/wishHandoffEquipment.js';
import { getSellerInsightsFromLead } from './sellerInsights.js';
import { buildCustomerUnderstanding } from './customerUnderstanding.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { safeSnapshotFactLabel } from '../cleverSeller/normalizeFactDisplayLabel.js';

/** Soft-Gruppen unter „Kundenwissen“ – kanonische Taxonomie. Legacy-Keys als Alias. */
export const SOFT_SNAPSHOT_GROUP = {
  /** PERSONAL – Persönliches (Person + Situation, inkl. Unfall/Ersatz) */
  PERSOENLICHES: 'persoenliches',
  /** VEHICLE_WISH – Fahrzeugwunsch (neues Auto: Antrieb/Farbe/Getriebe/…) */
  FAHRZEUGPRAEFERENZ: 'fahrzeugpraeferenz',
  /** EQUIPMENT – Ausstattung (+ Kaufkriterien mit Muss/Wichtig/Wunsch) */
  AUSSTATTUNG_TECHNIK: 'ausstattungTechnik',
  /** Soft trivia / Zero-Loss parking – nur wenn Facts vorhanden */
  SONSTIGES: 'sonstiges',
  /**
   * Off-UI: GW / Vertrag / Inzahlungnahme (Lead-Modell, nicht Kundenwissen-Matrix).
   * @deprecated as visible Kundenwissen bucket
   */
  BESTAND: 'bestand',
  /** @deprecated → PERSOENLICHES */
  MENSCH_ALLTAG: 'persoenliches',
  /** @deprecated → SONSTIGES */
  PERSOENLICH: 'sonstiges',
  /** @deprecated → FAHRZEUGPRAEFERENZ */
  ANFORDERUNGEN: 'fahrzeugpraeferenz',
  /** @deprecated → PERSOENLICHES */
  KUNDE_ALLTAG: 'persoenliches',
  /** Alias: Fahrzeugwunsch */
  FAHRZEUGWUNSCH: 'fahrzeugpraeferenz',
  /** @deprecated → AUSSTATTUNG_TECHNIK */
  WICHTIG_AUSWAHL: 'ausstattungTechnik',
  /** @deprecated → SONSTIGES */
  NOTIZEN: 'sonstiges',
};

export const SOFT_SNAPSHOT_GROUP_TITLE = {
  [SOFT_SNAPSHOT_GROUP.PERSOENLICHES]: 'Persönliches',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ]: 'Fahrzeugwunsch',
  [SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK]: 'Ausstattung',
  [SOFT_SNAPSHOT_GROUP.SONSTIGES]: 'Sonstiges',
};

/** Ruhige Panel-Themenzeilen (Anzeige, kein Formular-Gerüst). */
export const SOFT_PANEL_TOPIC_TITLE = Object.freeze({
  persoenlich: 'Persönlich',
  entscheidung: 'Entscheidung',
  fahrzeugwunsch: 'Fahrzeugwunsch',
  wichtig: 'Wichtig',
  sonstiges: 'Sonstiges',
});

/** Render-Reihenfolge Soft-Gruppen. Nur mit Facts sichtbar. Bestand off-UI. */
export const SOFT_SNAPSHOT_GROUP_ORDER = Object.freeze([
  SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
  SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
  SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
  SOFT_SNAPSHOT_GROUP.SONSTIGES,
]);

/**
 * @deprecated Kernel waren früher leeres Gerüst; Kundenwissen zeigt nur Groups mit Facts.
 * Beibehalten für Legacy-Imports.
 */
export const SOFT_SNAPSHOT_CORE_GROUPS = Object.freeze([
  SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
  SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
  SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
]);

/** Entscheidung / Mitentscheider – aus Persönlichem in eigenes Panel-Thema. */
const DECISION_SOFT_FACT_RE = /entscheidet|mit\s+(seiner\s+|ihrer\s+)?(partner|frau|mann|freundin|freund)\b|gemeinsam\s+entscheid|mitentscheider/i;

/**
 * Soft-Gruppe → Kundenhelfer-/Picker-Einstieg (Plus-Chip).
 * `equipment` = Soft-Sektion Ausstattung; sonst Life-Kategorie mit vordefinierten Chips.
 */
export const SOFT_GROUP_ADD_CATEGORY = Object.freeze({
  [SOFT_SNAPSHOT_GROUP.PERSOENLICHES]: 'familie',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ]: 'auto',
  [SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK]: 'equipment',
  [SOFT_SNAPSHOT_GROUP.SONSTIGES]: 'sonstiges',
});

/** Fact-Zustände für Current Truth / History. */
export const SNAPSHOT_FACT_STATE = Object.freeze({
  CONFIRMED: 'confirmed',
  INFERRED: 'inferred',
  CONFLICTING: 'conflicting',
  HISTORICAL: 'historical',
});

/** Ausstattungs-Priorität: Muss · Wichtig · Wunsch. */
export const EQUIPMENT_WISH_PRIORITY = Object.freeze({
  PREFERRED: 'preferred',
  IMPORTANT: 'important',
  REQUIRED: 'required',
});

export const EQUIPMENT_WISH_PRIORITY_LABEL = Object.freeze({
  [EQUIPMENT_WISH_PRIORITY.REQUIRED]: 'muss',
  [EQUIPMENT_WISH_PRIORITY.IMPORTANT]: 'wichtig',
  /** Explizites Wunsch; Default ohne Suffix bleibt null in formatEquipmentWishLabel */
  [EQUIPMENT_WISH_PRIORITY.PREFERRED]: 'wunsch',
});

/** @deprecated – Alias: Soft-Gruppen + Legacy-IDs für ältere Imports */
export const SNAPSHOT_GROUP = {
  BEDARF: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
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
  [SNAPSHOT_GROUP.BEDARF]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.PERSOENLICHES],
  [SNAPSHOT_GROUP.BUDGET]: 'Budget',
  [SNAPSHOT_GROUP.WUNSCH]: SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ],
  [SNAPSHOT_GROUP.VERTRAG]: 'Vertragskonditionen',
};

/** Primärer editKey je Soft-Gruppe (Fallback). */
export const SNAPSHOT_GROUP_EDIT_KEY = {
  [SOFT_SNAPSHOT_GROUP.PERSOENLICHES]: 'bedarf',
  [SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ]: 'vehicleTrack',
  [SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK]: 'equipment',
  [SOFT_SNAPSHOT_GROUP.SONSTIGES]: 'bedarf',
  [SOFT_SNAPSHOT_GROUP.BESTAND]: 'tradeIn',
  [SNAPSHOT_GROUP.BUDGET]: 'desiredRate',
  [SNAPSHOT_GROUP.VERTRAG]: 'termMonths',
};

/** Konditionen: Zahlungsart + Vertragsfelder (fehlend = Placeholder). */
export const KERN_SNAPSHOT_FACT_IDS = Object.freeze([
  'paymentType',
  'termMonths',
  'mileagePerYear',
  'downPayment',
  'leasingEndDate',
]);

/** Kia-/Alltags-Farben inkl. Sonderlacke (Terracotta). */
const COLOR_TOKEN_CORE = 'grau|blau|wei[sß]{1,2}|schwarz|rot|silber|gr[üu]n|beige|bronze|orange|gelb|pearl|ivory|cream|green|blue|grey|gray|white|black|red|silver|terracotta|magma|runway';
const COLOR_TOKEN_RE = new RegExp(`\\b(${COLOR_TOKEN_CORE})\\b`, 'i');
const COLOR_WORD_RE = new RegExp(`^(${COLOR_TOKEN_CORE})$`, 'i');
/** „in schwarz“, „in terracotta“ in Timeline-/Nachrichtentext. */
const IN_COLOR_RE = new RegExp(`\\bin\\s+(${COLOR_TOKEN_CORE})\\b`, 'i');
/** Getränk + Farbe (Kaffee schwarz) ≠ Fahrzeugfarbe. */
const BEVERAGE_COLOR_RE = /\b(kaffee|tee|espresso|milchkaffee|cappuccino)\b/i;
const COLOR_CONTEXT_RE = /wunschfarbe|farbton|lackierung|\bfarbe\b/i;
const DRIVE_WORD_RE = /^(elektro|elektrisch|automatik|schaltgetriebe|benziner|diesel|hybrid|plug-?in|allrad|fwd|rwd|awd)$/i;
const DRIVE_IN_TEXT_RE = /\b(allrad|awd|fwd|rwd|automatik|schaltgetriebe|elektro|elektrisch|hybrid|plug-?in|benziner|diesel)\b/i;
const ACTIVITY_NOTE_RE = /beratungsgespr[äa]ch|verkaufsgespr[äa]ch|telefonat|\btermin\b|probefahrt|übergabe|\bgespr[äa]ch\b\s*·/i;
/**
 * Timeline-/System-Bestätigungen – nie Soft/Sonstiges.
 * Deckt u. a. „Wunschkonditionen aktualisiert“, „Clever Kundenhelfer aktualisiert“,
 * Multi-Source-Apply-Prozesslabels („Kunde angelegt“, „Angebotsauftrag vorbereitet“).
 */
const HISTORY_NOISE_RE = /^(clever empfahl|clever-empfehlung|angebot |anruf\b|pdf\b|rückruf|✓|kunde hat|geöffnet|angesehen|nachricht |clever hat aufgenommen|wunschkonditionen aktualisiert|clever kundenhelfer aktualisiert|kundenbild aktualisiert|wunschrate aktualisiert|farbe aktualisiert|leasingende aktualisiert|bestandsfahrzeug aktualisiert|kinder aktualisiert|hund aktualisiert|rate aktualisiert)/i;
/** Apply-/Intake-Prozessstatus – nie Soft-Summary (Confirm/Activity behalten Status). */
const APPLY_PROCESS_NOISE_RE = /kunde angelegt|kunde verknüpft|angebotsauftrag vorbereitet|multi-source-intake|kundenakte aus (?:multi-source|composer)|vertrag bereits vorhanden|neue kundenakte|bereits vorhandene übernahme|altvertrag erfasst|bestehende kundenakte ergänzt|offener angebotsauftrag|idempotenz|bereits übernommen|inbound über composer|kunde aus anfrage angelegt/i;
/** Kurze System-Bestätigung „… aktualisiert“ / „… aktualisiert: …“ – kein Kundenfakt. */
const SYSTEM_UPDATE_UPDATE_RE = /^(?:[a-zäöüÄÖÜß0-9][\wäöüÄÖÜß\-]*(?:\s+[a-zäöüÄÖÜß0-9][\wäöüÄÖÜß\-]*){0,4})\s+aktualisiert(?:\s*:.*)?\.?$/i;
/** Kompakt-Bestätigung ohne Chip-Liste („Für X aufgenommen“) – kein Soft-Fakt. */
const HISTORY_BARE_CONFIRM_RE = /^für\s+.+\s+aufgenommen\.?$/i;
/**
 * Inbound-/Formular-Boilerplate – nie Soft-Summary-Chip
 * („Quelle: https://…“, Kontaktanfrage, Mail-Header-Reste).
 */
const INTAKE_FORM_NOISE_RE = /^(?:quelle\s*:|https?:\/\/|www\.)|kontaktanfrage|kontaktformular|es ist eine kontaktanfrage|urspr[uü]ngliche nachricht|weitergeleitete nachricht|begin forwarded message|^(?:von|from|gesendet|sent|an|to|betreff|subject)\s*:/i;
/** Kontakt-Identität (Tel/Mail/Name) – Header/Kundendaten, nicht Kundenwissen-Summary. */
const CONTACT_EMAIL_LABEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const CONTACT_PHONE_LABEL_RE = /^(?:\+?\d[\d\s/().-]{6,}\d)$/;
/** Nur echte Anrede+Name (Kapitalisierung) – nicht „Frau entscheidet mit“. */
const CONTACT_NAME_WITH_SALUTATION_RE = /^(?:Herr|Frau|Hr\.|Fr\.)\s+[A-ZÄÖÜ][a-zäöüß'-]+(?:\s+[A-ZÄÖÜ][a-zäöüß'-]+){0,3}$/;

/** True wenn Label Timeline-/System-Rauschen ist (nie Soft-Fakt). */
export function isSnapshotSystemNoiseLabel(label = '') {
  const text = String(label ?? '').trim();
  if (!text) return true;
  if (HISTORY_NOISE_RE.test(text) || HISTORY_BARE_CONFIRM_RE.test(text)) return true;
  if (APPLY_PROCESS_NOISE_RE.test(text)) return true;
  if (INTAKE_FORM_NOISE_RE.test(text)) return true;
  if (text.length <= 72 && SYSTEM_UPDATE_UPDATE_RE.test(text)) return true;
  return false;
}

function normalizeSoftPhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Kontakt-Identität (Name/Tel/Mail) – gehört in Header, nie Soft-Summary.
 * @param {string} label
 * @param {object} [lead]
 */
export function isSnapshotContactIdentityLabel(label = '', lead = {}) {
  const text = String(label ?? '').trim();
  if (!text) return true;
  if (CONTACT_EMAIL_LABEL_RE.test(text)) return true;
  if (CONTACT_PHONE_LABEL_RE.test(text) && normalizeSoftPhoneDigits(text).length >= 8) return true;
  if (CONTACT_NAME_WITH_SALUTATION_RE.test(text)) return true;

  const contact = lead?.contact || {};
  const email = String(contact.email || lead?.email || '').trim().toLowerCase();
  if (email && text.toLowerCase() === email) return true;

  const phoneDigits = normalizeSoftPhoneDigits(contact.phone || lead?.phone || '');
  const labelDigits = normalizeSoftPhoneDigits(text);
  if (phoneDigits.length >= 8 && labelDigits.length >= 8) {
    if (
      phoneDigits === labelDigits
      || phoneDigits.endsWith(labelDigits.slice(-8))
      || labelDigits.endsWith(phoneDigits.slice(-8))
    ) {
      return true;
    }
  }

  const fullName = String(contact.name || lead?.name || '').trim().toLowerCase();
  const first = String(contact.firstName || '').trim().toLowerCase();
  const last = String(contact.lastName || '').trim().toLowerCase();
  const composed = [first, last].filter(Boolean).join(' ');
  const lower = text.toLowerCase().replace(/^(?:herr|frau|hr\.|fr\.)\s+/i, '').trim();
  if (fullName && (lower === fullName || text.toLowerCase() === fullName)) return true;
  if (composed && lower === composed) return true;
  // Nur Vorname („Marcel“) wenn Nachname in der Akte bekannt – kein Soft-Chip
  if (first && last && lower === first) return true;
  // Vorname allein, wenn Kontakt bereits einen Anzeigenamen trägt (kein Soft „Marcel“)
  if (first && lower === first && fullName && !/^neuer\s+kunde$/i.test(fullName)) return true;
  // Vorname aus composed contact.name („Marcel Grube“) – kein Soft nur „Marcel“
  if (
    fullName
    && /\s/.test(fullName)
    && !/^neuer\s+kunde$/i.test(fullName)
    && lower === fullName.split(/\s+/)[0]
  ) {
    return true;
  }
  if (last && lower === last && last.length >= 3) return true;
  return false;
}
const DATE_IN_TEXT_RE = /\d{1,2}\.\d{1,2}\.\d{2,4}/;
const MODEL_TRIM_RE = /\bev\s*[0-9]\b|\bsportage\b|\bceed\b|\bniro\b|\bsorento\b|\bpicanto\b|\bstonic\b|\bproceed\b|\bxceed\b|gt-?\s*line|\bx-?\s*line|\bspirit\b|\bplatinum\b|\bedition\b|\bvision\b|\bair\b|\bearth\b|\bcore\b|\bdrivewise\b|\bstyle\b|\bconnect\b|\bwinter\b|\binteressant\b/i;
const COMMERCIAL_NOTE_RE = /leasing|finanzierung|\bkauf\b|budget|\brate\b|\b\d+\s*monate?\b|\bkm\b|anzahlung|jahreskilometer|vertragsende|down\s*payment/i;
const EQUIPMENT_NOTE_RE = /totwinkel|spurhalte|verkehrszeichen|blind\s*spot|lane\s*keep|w[äa]rmepumpe|\bhud\b|kamera|ahk|anh[äa]nger|panorama|sitzheizung|matrix|ausstattung|kofferraum|head-?up|800\s*v|ladeleistung|assistent|tempomat|notbrems|parkassistent|keyless|induktiv/i;
/** Bestands-/GW-Fakten (Lead-Modell, nicht Kundenwissen-UI). */
const BESTAND_NOTE_RE = /inzahlung|gebraucht|\(gw\)|bestands|r[üu]ckl[äa]ufer|trade-?\s*in|abl[öo]se|r[üu]ckgabe|vertragsende|vertrag\s*bis/i;
const HUMAN_USAGE_NOTE_RE = /^(familie|kinder|\d+\s*kinder?|\d+\s*hund(e)?|\d+\s*katze(n)?|hund|katze|haustier|haus|wohnung|eigenheim|platz|langstrecke|pendeln|erstwagen|zweitwagen|schichtdienst|arbeitsweg|autobahn|pflege|beruf)$/i;
const HUMAN_URGENCY_RE = /braucht\s+auto\s+sofort|auto\s+sofort|sofort\s+auto\b|dringend\s+auto/i;
/** Unfall/Ersatz erklärt die Suche → Persönliches, nicht Bestand. */
const UNFALL_PERSONAL_RE = /unfall\s*\/\s*ersatzfahrzeug|\bersatzfahrzeug\b|\bunfallschaden\b|\bfahrzeugwechsel\s+wegen\s+unfall\b|\bunfall\b/i;
const HUMAN_SITUATION_RE = /frau\s+entscheidet|entscheidet\s+mit(\s+partner)?|bevorzugt\s+samstag|samstag\s+bevorzugt|arbeitsweg|autobahn|schichtdienst|\bpflege\b|\bberuf\b|eigenheim|\bwohnung\b/i;
const PRIORITY_SUFFIX_RE = /\s*[·|]\s*(muss|wichtig|wunsch|nice|preferred|important|required)\s*$/i;
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

/** True wenn Priorität explizit am Label/Kontext markiert ist (nicht Default). */
export function hasExplicitEquipmentPriority(label = '', contextText = '') {
  const text = String(label ?? '').trim();
  if (PRIORITY_SUFFIX_RE.test(text)) return true;
  const blob = `${text} ${contextText || ''}`.toLowerCase();
  return REQUIRED_PHRASE_RE.test(blob)
    || PREFERRED_PHRASE_RE.test(blob)
    || IMPORTANT_PHRASE_RE.test(blob);
}

/** Basis-Label ohne Prioritäts-Suffix. */
export function stripEquipmentPrioritySuffix(label = '') {
  const text = safeSnapshotFactLabel(label);
  if (!text) return '';
  return text.replace(PRIORITY_SUFFIX_RE, '').trim();
}

/**
 * Anzeige-Label inkl. optionaler Priorität.
 * muss/wichtig immer; wunsch nur bei explizitem preferred (nicht als Default-Rauschen).
 */
export function formatEquipmentWishLabel(
  baseLabel = '',
  priority = EQUIPMENT_WISH_PRIORITY.PREFERRED,
  { explicitPreferred = false } = {},
) {
  const base = stripEquipmentPrioritySuffix(baseLabel);
  if (!base) return '';
  if (priority === EQUIPMENT_WISH_PRIORITY.REQUIRED) {
    return `${base} · ${EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.REQUIRED]}`;
  }
  if (priority === EQUIPMENT_WISH_PRIORITY.IMPORTANT) {
    return `${base} · ${EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.IMPORTANT]}`;
  }
  if (explicitPreferred) {
    return `${base} · ${EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.PREFERRED]}`;
  }
  return base;
}

/**
 * Klassifiziert Seller-/Notiz-Labels für Display-Migration.
 * structured → kanonischer Slot (nie Freinotiz); activity → Chat/Termine; free → Sonstiges.
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

  // System-/Timeline-Rauschen zuerst – nie Free/Sonstiges
  if (isSnapshotSystemNoiseLabel(text) || isSnapshotSystemNoiseLabel(raw)) {
    return { kind: 'activity', slot: 'activity' };
  }

  // Kontakt-Identität (Tel/Mail/Anrede+Name) – nie Soft/Sonstiges
  if (isSnapshotContactIdentityLabel(text) || isSnapshotContactIdentityLabel(raw)) {
    return { kind: 'activity', slot: 'activity' };
  }

  if (
    ACTIVITY_NOTE_RE.test(text)
    || (DATE_IN_TEXT_RE.test(text) && /gespr[äa]ch|termin|uhr|besuch|beratung/i.test(text))
  ) {
    return { kind: 'activity', slot: 'activity' };
  }

  // Wunsch: Kundenservice in der Rate – Soft, nicht Konditionen-Rauschen
  if (/kundenservice.{0,48}(?:leasing)?rate|(?:service|wartung).{0,32}in\s+der\s+(?:leasing)?rate/i.test(text)) {
    return {
      kind: 'free',
      slot: 'serviceWish',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.SONSTIGES,
    };
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

  // Farbe: exakt „schwarz“, „in schwarz“, „Wunschfarbe schwarz“ / „Farbe: grau“
  // (nicht „Kaffee schwarz“). Vor MODEL_TRIM, sonst verlieren Clever-Nachrichten die Farbe.
  const inColorToken = text.match(IN_COLOR_RE)?.[1];
  const colorToken = text.match(COLOR_TOKEN_RE)?.[1];
  if (
    !BEVERAGE_COLOR_RE.test(text)
    && (
      COLOR_WORD_RE.test(lower)
      || Boolean(inColorToken)
      || (colorToken && COLOR_CONTEXT_RE.test(text) && text.length < 64)
    )
  ) {
    const rawColor = (
      COLOR_WORD_RE.test(lower)
        ? lower
        : String(inColorToken || colorToken).toLowerCase()
    ).replace(/weiss/g, 'weiß');
    const remap = rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
    return {
      kind: 'structured',
      slot: 'color',
      remapLabel: remap,
      groupId: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
    };
  }

  // Altes Auto / GW als Kundenfakt (vor MODEL_TRIM, sonst „Picanto“ → Header-Track)
  if (/^altes\s+auto\b/i.test(text) || /^\(gw\)/i.test(text)) {
    return {
      kind: 'structured',
      slot: 'human',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
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

  // Picker-Chips (Komfort/Technik/…) vor Freinotiz – exakter Katalog-Match
  const handoffEquip = canonicalHandoffEquipmentLabel(text);
  if (handoffEquip || isHandoffEquipmentLabel(text) || EQUIPMENT_NOTE_RE.test(text)) {
    const priority = priorityFromSuffix || parseEquipmentWishPriority(raw);
    return {
      kind: 'structured',
      slot: 'equipment',
      remapLabel: handoffEquip || text,
      priority,
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
    };
  }

  // Unfall/Ersatz → Persönliches (Warum gesucht wird)
  if (UNFALL_PERSONAL_RE.test(text)) {
    return {
      kind: 'structured',
      slot: 'human',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
    };
  }

  // GW / Inzahlungnahme: strukturiert behalten, aber nicht in Kundenwissen-UI
  if (BESTAND_NOTE_RE.test(text)) {
    return {
      kind: 'structured',
      slot: 'bestand',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
    };
  }

  if (
    HUMAN_URGENCY_RE.test(text)
    || HUMAN_USAGE_NOTE_RE.test(lower)
    || HUMAN_SITUATION_RE.test(text)
    || /^\d+\s*kinder?\b/i.test(text)
  ) {
    return {
      kind: 'structured',
      slot: 'human',
      remapLabel: text,
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
    };
  }

  if (/termin|probefahrt|übergabe/i.test(text) && DATE_IN_TEXT_RE.test(text)) {
    return { kind: 'activity', slot: 'activity' };
  }

  return {
    kind: 'free',
    groupId: SOFT_SNAPSHOT_GROUP.SONSTIGES,
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
  cash: 'Bar',
};

/**
 * Chip-Optik / Provenance: portal · landing · customer* → customer;
 * seller bleibt seller; document/clever bleiben; Rest → seller-neutral.
 * @param {string|null|undefined} raw
 * @returns {'customer'|'seller'|'document'|'clever'|null}
 */
export function normalizeKnowledgeChipSource(raw = null) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return null;
  if (
    key === 'customer'
    || key === 'portal'
    || key === 'landing'
    || key === 'landingpage'
    || key === 'customeradvisor'
    || key === 'customer_advisor'
    || key === 'advisor'
    || key === 'frag_clever'
    || key === 'fragclever'
    || key === 'need_profile'
    || key === 'needprofile'
    || key === 'beratung'
  ) {
    return 'customer';
  }
  if (key === 'seller' || key === 'verkaeufer' || key === 'verkäufer') return 'seller';
  if (key === 'document' || key === 'dokument' || key === 'pdf') return 'document';
  if (
    key === 'clever'
    || key === 'openai_interpretation'
    || key === 'customer_message'
    || key === 'inbound'
    || key === 'composer_inbound'
  ) {
    return 'clever';
  }
  // wish/offer/kern und Unbekanntes: ruhig seller-neutral (keine Customer-Optik)
  return 'seller';
}

/**
 * Kanalzeile für Kunden-Provenance (Hover), z. B. Landingpage / Portal.
 * @param {object} [lead]
 * @param {string|null} [explicitChannel]
 */
export function resolveCustomerSourceChannelLabel(lead = {}, explicitChannel = null) {
  const raw = String(explicitChannel ?? lead?.source ?? lead?.crm?.source ?? '').trim();
  const key = raw.toLowerCase();
  if (!key && !explicitChannel) return null;
  if (key === 'landing' || key === 'landingpage') return 'Landingpage';
  if (key === 'portal' || key === 'customeradvisor' || key === 'customer_advisor') return 'Portal';
  if (key === 'advisor' || key === 'frag_clever' || key === 'fragclever' || key === 'berater') {
    return 'Frag Clever';
  }
  if (key === 'configurator') return 'Konfigurator';
  if (explicitChannel) return String(explicitChannel);
  return null;
}

function formatChipProvenanceDate(iso = null, { withTime = false } = {}) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (!withTime) return date;
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

/**
 * Hover-/Tap-Provenance (deutsch). Kein permanentes Badge.
 * Format: „… · TT.MM.JJJJ“ bzw. Clever-Vermutung ohne Datum.
 * @param {object} chip
 */
export function buildKnowledgeChipProvenanceTitle(chip = {}) {
  const style = normalizeKnowledgeChipSource(chip.source);
  const actor = String(chip.actorName || chip.sellerName || '').trim();
  const at = chip.updatedAt || chip.createdAt || null;
  const date = formatChipProvenanceDate(at, { withTime: false });
  const history = Array.isArray(chip.historicalValues) && chip.historicalValues.length
    ? `Früher: ${chip.historicalValues.join(' · ')}`
    : null;

  const withDate = (head) => (date ? `${head} · ${date}` : head);
  // Clever: nur explizit confirmed → „aus Gespräch“; sonst Vermutung
  const cleverConfirmed = chip.confirmed === true;

  let primary = null;
  if (style === 'customer') {
    primary = withDate('Vom Kunden angegeben');
  } else if (style === 'document') {
    primary = withDate('Aus Dokument');
  } else if (style === 'clever') {
    primary = cleverConfirmed
      ? withDate('Von Clever aus Gespräch erkannt')
      : 'Von Clever erkannt · noch nicht bestätigt';
  } else if (style === 'seller' || chip.source) {
    primary = withDate(actor ? `Von ${actor} ergänzt` : 'Vom Verkäufer ergänzt');
  }

  return [primary, history].filter(Boolean).join('\n') || undefined;
}

/** True wenn Label Entscheidungs-/Mitentscheider-Fakt ist. */
export function isDecisionSoftFactLabel(label = '') {
  return DECISION_SOFT_FACT_RE.test(String(label ?? '').trim());
}

/**
 * Ruhige Panel-Themenzeilen aus Soft-Groups (nur mit Facts).
 * Persönliches wird in Persönlich + Entscheidung gesplittet.
 * @param {object[]} groups
 * @returns {{ id: string, title: string, facts: object[], line: string }[]}
 */
export function buildSoftPanelTopics(groups = []) {
  const byId = new Map((groups || []).map((g) => [g.id, g]));
  const personalFacts = (byId.get(SOFT_SNAPSHOT_GROUP.PERSOENLICHES)?.facts || [])
    .filter((f) => !f.empty && safeSnapshotFactLabel(f.label));
  const decisionFacts = personalFacts.filter((f) => isDecisionSoftFactLabel(f.label));
  const persoenlichFacts = personalFacts.filter((f) => !isDecisionSoftFactLabel(f.label));
  const vehicleFacts = (byId.get(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ)?.facts || [])
    .filter((f) => !f.empty && safeSnapshotFactLabel(f.label));
  const importantFacts = (byId.get(SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK)?.facts || [])
    .filter((f) => !f.empty && safeSnapshotFactLabel(f.label));
  const otherFacts = (byId.get(SOFT_SNAPSHOT_GROUP.SONSTIGES)?.facts || [])
    .filter((f) => !f.empty && safeSnapshotFactLabel(f.label));

  const topics = [
    { id: 'persoenlich', title: SOFT_PANEL_TOPIC_TITLE.persoenlich, facts: persoenlichFacts },
    { id: 'entscheidung', title: SOFT_PANEL_TOPIC_TITLE.entscheidung, facts: decisionFacts },
    { id: 'fahrzeugwunsch', title: SOFT_PANEL_TOPIC_TITLE.fahrzeugwunsch, facts: vehicleFacts },
    { id: 'wichtig', title: SOFT_PANEL_TOPIC_TITLE.wichtig, facts: importantFacts },
    { id: 'sonstiges', title: SOFT_PANEL_TOPIC_TITLE.sonstiges, facts: otherFacts },
  ];

  return topics
    .filter((t) => t.facts.length > 0)
    .map((t) => ({
      ...t,
      line: t.facts
        .map((f) => stripEquipmentPrioritySuffix(f.label) || safeSnapshotFactLabel(f.label))
        .filter(Boolean)
        .join(' · '),
    }));
}

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
  state = SNAPSHOT_FACT_STATE.CONFIRMED,
  source = null,
  actorType = null,
  actorId = null,
  actorName = null,
  sellerName = null,
  createdAt = null,
  updatedAt = null,
  sourceChannel = null,
  historicalValues = null,
  confirmed = null,
  empty = false,
} = {}) {
  const text = safeSnapshotFactLabel(label);
  if (!text) return null;
  const category = tint || SNAPSHOT_TINT.ALLTAG;
  const normalizedSource = normalizeKnowledgeChipSource(source) || source || null;
  const resolvedActorName = actorName || sellerName || null;
  const isClever = normalizedSource === 'clever';
  const resolvedConfirmed = typeof confirmed === 'boolean'
    ? confirmed
    : isClever
      ? false
      : (
        state !== SNAPSHOT_FACT_STATE.INFERRED
        && state !== SNAPSHOT_FACT_STATE.CONFLICTING
      );
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
    state,
    confirmed: resolvedConfirmed,
    ...(empty ? { empty: true } : {}),
    ...(priority ? { priority } : {}),
    ...(normalizedSource ? { source: normalizedSource } : {}),
    ...(actorType ? { actorType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(resolvedActorName ? { actorName: resolvedActorName, sellerName: resolvedActorName } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(sourceChannel ? { sourceChannel } : {}),
    ...(historicalValues?.length ? { historicalValues } : {}),
  };
}

/** Kunden-Provenance für needProfile-Facts. */
function customerFactProvenance(lead = {}, profile = {}) {
  const channel = resolveCustomerSourceChannelLabel(lead);
  const at = profile.updatedAt || lead?.crm?.needProfile?.updatedAt || lead?.updatedAt || lead?.createdAt || null;
  return {
    source: 'customer',
    actorType: 'customer',
    sourceChannel: channel,
    createdAt: at,
    updatedAt: at,
  };
}

/** Seller-/Clever-Provenance aus Label-Map (letztes Matching gewinnt). */
function sellerFactProvenance(label = '', provenanceByLabel = new Map()) {
  const meta = provenanceByLabel.get(String(label ?? '').trim().toLowerCase()) || null;
  const source = normalizeKnowledgeChipSource(meta?.source) || 'seller';
  return {
    source,
    actorType: source === 'clever' ? 'clever' : 'seller',
    actorId: meta?.actorId || null,
    actorName: meta?.actorName || null,
    createdAt: meta?.createdAt || null,
    updatedAt: meta?.updatedAt || null,
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
 * Monatsraten aus Offer/PDF nicht als Kunden-Wunschrate behandeln.
 * Laufzeit/km/AZ/Ende sind Deal-Konditionen und dürfen im Kern sichtbar sein.
 */
function isOfferOnlyCommercialValue(kind, value, offerTerms) {
  if (value == null || value === '') return false;
  if (kind !== 'rate' && kind !== 'desiredRate') return false;
  if (!offerTerms.rates.size) return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  return offerTerms.rates.has(Math.round(num));
}

function pickSingleOfferTerm(set) {
  if (!(set instanceof Set) || set.size !== 1) return null;
  return [...set][0];
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

/**
 * Entpackt Timeline-Bodies: Clever-Nachricht-Quote / Kunden-Nachricht-Prefix.
 * @param {string} text
 * @returns {string}
 */
export function unwrapHistoryKnowledgePayload(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const quoted = raw.match(/[„"]([^"„”]+)[“"]/);
  if (quoted?.[1]) return String(quoted[1]).trim();
  return raw
    .replace(/^Nachricht vom Kunden:\s*/i, '')
    .replace(/^Clever Nachricht gesendet:\s*/i, '')
    .replace(/^[„"]|[“"]$/g, '')
    .trim() || raw;
}

function formatSoftColorLabel(token = '') {
  const raw = String(token ?? '').trim().toLowerCase().replace(/weiss/g, 'weiß');
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatSoftDriveLabel(token = '') {
  const raw = String(token ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'awd') return 'Allrad';
  if (raw === 'plug-in' || raw === 'plugin') return 'Plug-in';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Atomare Soft-Facts aus Timeline-/Nachrichten-Zeilen
 * (z. B. „… ev5 gt line in schwarz“ → Schwarz; Allrad).
 * @param {string} text
 * @returns {string[]}
 */
export function harvestHistoryKnowledgeAtoms(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const isCleverOrQuoted = /^Clever Nachricht/i.test(raw)
    || /^Nachricht vom Kunden/i.test(raw)
    || /[„"]/.test(raw);
  // Reine System-Zeilen ohne Quote/Payload nie harvesten
  if (isSnapshotSystemNoiseLabel(raw) && !isCleverOrQuoted) return [];

  const payload = unwrapHistoryKnowledgePayload(raw);
  if (!payload) return [];

  const atoms = [];
  const seen = new Set();
  const pushAtom = (value) => {
    const label = String(value ?? '').trim();
    if (!label || label.length < 2 || label.length > 80) return;
    if (isSnapshotSystemNoiseLabel(label)) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    atoms.push(label);
  };

  if (!BEVERAGE_COLOR_RE.test(payload)) {
    const inColor = payload.match(IN_COLOR_RE)?.[1];
    const wunschfarbe = payload.match(
      new RegExp(`(?:wunschfarbe|farbton|lackierung|\\bfarbe\\b)\\s*[:=]?\\s*(${COLOR_TOKEN_CORE})\\b`, 'i'),
    )?.[1];
    const colorToken = inColor || wunschfarbe;
    if (colorToken) {
      pushAtom(formatSoftColorLabel(colorToken));
    } else if (COLOR_WORD_RE.test(payload.trim())) {
      pushAtom(formatSoftColorLabel(payload.trim()));
    }
  }

  const driveToken = payload.match(DRIVE_IN_TEXT_RE)?.[1];
  if (driveToken && !/gt\s*line|ev\s*\d/i.test(driveToken)) {
    pushAtom(formatSoftDriveLabel(driveToken));
  }

  // Kurze, bereits strukturierte Notizen (ohne Fahrzeugtrack/Commercial).
  // Free-Notes nur aus echten Timeline-Notizen – nie aus Clever-Nachricht-Quotes
  // (sonst landet Fließtext wie „schrieb ihm … sofort verfügbar“ in Soft).
  const shortPayload = payload.length <= 80 ? payload : '';
  if (shortPayload) {
    const stripped = shortPayload
      .replace(/\s+gemerkt\.?$/i, '')
      .replace(/^gemerkt:\s*/i, '')
      .trim();
    if (stripped && !isSnapshotSystemNoiseLabel(stripped)) {
      const classified = classifySnapshotNoteLabel(stripped);
      if (classified.kind === 'structured') {
        if (
          classified.slot !== 'commercial'
          && classified.slot !== 'vehicleTrack'
          && classified.slot !== 'activity'
        ) {
          pushAtom(classified.remapLabel || stripped);
        }
      } else if (
        !isCleverOrQuoted
        && classified.kind === 'free'
        && stripped.length <= 64
      ) {
        pushAtom(stripped);
      }
    }
  }

  return atoms;
}

/**
 * Knowledge-Spans aus Timeline/History – sonst wirkt Kundenwissen leer,
 * obwohl z. B. „Wunschfarbe schwarz“ nur als Aktivität sichtbar ist.
 * @param {object} lead
 * @returns {string[]}
 */
export function collectHistoryKnowledgeLabels(lead = {}) {
  const entries = [
    ...(Array.isArray(lead?.history) ? lead.history : []),
    ...(Array.isArray(lead?.crm?.activities) ? lead.crm.activities : []),
  ];
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (!text || text.length < 2 || text.length > 80) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  for (const entry of entries.slice(0, 48)) {
    const text = String(entry?.meta?.insightText || entry?.text || '').trim();
    if (!text) continue;

    const isCleverOrQuoted = /^Clever Nachricht/i.test(text)
      || /^Nachricht vom Kunden/i.test(text)
      || /[„"]/.test(text);
    if (isSnapshotSystemNoiseLabel(text) && !isCleverOrQuoted) continue;

    // Atom-Harvest zuerst (Clever-Nachricht / „in schwarz“ / Allrad)
    for (const atom of harvestHistoryKnowledgeAtoms(text)) {
      push(atom);
    }

    const aufgenommen = text.match(/aufgenommen\s*:\s*(.+)$/i);
    if (aufgenommen) {
      for (const part of aufgenommen[1].split(/\s*[·|,;]\s*/)) {
        if (!isSnapshotSystemNoiseLabel(part)) push(part);
      }
      continue;
    }

    // Lange Clever-Nachrichten: nur Atome, kein Full-Text als Soft
    if (isCleverOrQuoted || text.length > 80) continue;

    const stripped = text
      .replace(/\s+gemerkt\.?$/i, '')
      .replace(/^gemerkt:\s*/i, '')
      .trim();
    if (isSnapshotSystemNoiseLabel(stripped)) continue;
    const classified = classifySnapshotNoteLabel(stripped);
    if (classified.kind === 'activity' || classified.kind === 'empty') continue;
    if (classified.kind === 'structured' && (
      classified.slot === 'commercial' || classified.slot === 'vehicleTrack'
    )) {
      continue;
    }
    if (classified.kind === 'free' && stripped.length > 64) continue;
    if (classified.slot === 'color' && classified.remapLabel) {
      push(classified.remapLabel);
    } else {
      push(stripped);
    }
  }
  return out;
}

/**
 * @deprecated Kontakt-Vollständigkeit gehört in den Header/Systemstatus,
 * nicht in Kundenwissen. Beibehalten nur für Legacy-Aufrufe.
 * @param {object} lead
 */
export function buildContactFallbackChips(lead = {}) {
  const phone = String(lead?.contact?.phone || lead?.phone || '').trim();
  const email = String(lead?.contact?.email || lead?.email || '').trim();
  return [
    fact('contact-phone', phone || 'Telefon fehlt', {
      editKey: 'contact',
      relevanceKey: 'phone',
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 90,
      icon: 'persoenlich',
      empty: !phone,
      source: phone ? 'customer' : 'seller',
    }),
    fact('contact-email', email || 'E-Mail fehlt', {
      editKey: 'contact',
      relevanceKey: 'email',
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 91,
      icon: 'persoenlich',
      empty: !email,
      source: email ? 'customer' : 'seller',
    }),
  ];
}

/**
 * Bestätigte Seller-/Kundenhelfer-Labels inkl. Provenance (letzter Eintrag gewinnt).
 * @returns {{ labels: string[], provenanceByLabel: Map<string, object> }}
 */
function collectConfirmedSellerLabelBundle(lead = {}) {
  const insights = getSellerInsightsFromLead(lead);
  const labels = [];
  const seen = new Set();
  const provenanceByLabel = new Map();

  const rememberProvenance = (value, meta = {}) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    const source = normalizeKnowledgeChipSource(meta.source) || 'seller';
    provenanceByLabel.set(key, {
      source,
      actorType: source === 'clever' ? 'clever' : 'seller',
      actorId: meta.actorId || null,
      actorName: meta.actorName || null,
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
    });
  };

  const pushUnique = (value, meta = {}) => {
    const text = safeSnapshotFactLabel(value);
    if (!text || isSnapshotSystemNoiseLabel(text)) return;
    if (isSnapshotContactIdentityLabel(text, lead)) return;
    // Activity/System nie als Seller-Label in Soft schleusen
    if (classifySnapshotNoteLabel(text).kind === 'activity') return;
    const key = text.toLowerCase();
    rememberProvenance(text, meta);
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(text);
  };

  for (const insight of insights) {
    const meta = {
      source: insight.source || 'seller',
      actorId: insight.sellerId || null,
      actorName: insight.sellerName || null,
      createdAt: insight.createdAt || null,
      updatedAt: insight.updatedAt || insight.createdAt || null,
    };
    const rawText = String(insight.text ?? '').trim();
    // Ausstattungs-Picker: insight.text ist die Wahrheit (mergeText kann Labels verfälschen)
    if (rawText && isHandoffEquipmentLabel(rawText)) {
      pushUnique(canonicalHandoffEquipmentLabel(rawText) || rawText, meta);
      continue;
    }
    // Merken: insight.text oft spezifischer als understoodLabels („1 Hund“ > „Hund“)
    const rawIsSpecificHuman = Boolean(
      rawText && (isChildrenFactLabel(rawText) || isDogFactLabel(rawText)),
    );
    if (rawIsSpecificHuman) {
      pushUnique(rawText, meta);
    }
    // Soft-Wunsch „Kundenservice in der Leasingrate“ – mergeText würde nur „Leasing“ behalten
    const rawServiceWish = rawText
      ? classifySnapshotNoteLabel(rawText)
      : null;
    if (rawText && rawServiceWish?.slot === 'serviceWish') {
      pushUnique(rawText, meta);
    }
    const fromInsight = insight.understoodLabels?.length
      ? insight.understoodLabels
      : [rawText].filter(Boolean);
    for (const label of fromInsight) {
      const display = safeSnapshotFactLabel(label);
      if (!display) continue;
      // Generisches Familie/Hund nicht neben spezifischem Merken-Label
      if (rawIsSpecificHuman && isChildrenFactLabel(rawText) && /^familie$/i.test(display)) {
        continue;
      }
      if (rawIsSpecificHuman && isDogFactLabel(rawText) && /^hund$/i.test(display)) {
        continue;
      }
      // Generisches „Leasing“ nicht neben spezifischem Service-in-Rate-Wunsch
      if (rawServiceWish?.slot === 'serviceWish' && /^leasing$/i.test(display)) {
        continue;
      }
      pushUnique(display, meta);
    }
  }

  // Kundenhelfer-Notizen (Komma/Zeile) – Zero-Loss in Soft-Buckets (VK-seitig)
  const notesRaw = lead?.crm?.kundenhelfer?.notes;
  if (notesRaw) {
    for (const part of String(notesRaw).split(/[,;\n]+/)) {
      pushUnique(part, { actorName: null });
    }
  }

  // Timeline-Wissen (Zero-Loss): nicht nur in der Aktivität „stecken lassen“
  for (const label of collectHistoryKnowledgeLabels(lead)) {
    pushUnique(label, { source: 'seller', actorName: null });
  }

  return { labels, provenanceByLabel };
}

function collectConfirmedSellerLabels(lead = {}) {
  return collectConfirmedSellerLabelBundle(lead).labels;
}

function isChildrenFactLabel(label = '') {
  return /^\d+\s*kinder?$|^1\s*kind$|^kinder$/i.test(String(label ?? '').trim());
}

function isDogFactLabel(label = '') {
  return /^\d+\s*hunde?$|^hund$/i.test(String(label ?? '').trim());
}

/**
 * Current Truth für Hund: Seller-Labels (z. B. „1 Hund“) vor needProfile.dog („Hund“).
 */
function resolveCurrentDogTruth(
  profile = {},
  sellerLabels = [],
  provenanceByLabel = new Map(),
  lead = {},
) {
  const sellerDogs = [];
  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured' || classified.slot !== 'human') continue;
    const display = String(classified.remapLabel || label).trim();
    if (!isDogFactLabel(display)) continue;
    sellerDogs.push(display);
  }

  if (sellerDogs.length) {
    const specific = sellerDogs.filter((l) => /^\d+\s*hunde?$/i.test(l));
    const pool = specific.length ? specific : sellerDogs;
    const current = pool[pool.length - 1];
    return {
      label: current,
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
      historicalValues: [],
      ...sellerFactProvenance(current, provenanceByLabel),
    };
  }
  if (profile.dog) {
    return {
      label: 'Hund',
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
      historicalValues: [],
      ...customerFactProvenance(lead, profile),
    };
  }
  return null;
}

/**
 * Current Truth für Kinder: letzter Seller-Wert gewinnt; ältere → historicalValues.
 * needProfile zählt als früherer Stand, wenn Seller später korrigiert.
 * Source folgt dem aktuellen Wert (Seller-Korrektur → seller-Optik).
 */
function resolveCurrentChildrenTruth(
  profile = {},
  sellerLabels = [],
  provenanceByLabel = new Map(),
  lead = {},
) {
  const profileLabel = formatChildren(resolveProfileChildren(profile));
  const sellerChildren = [];
  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured' || classified.slot !== 'human') continue;
    const display = String(classified.remapLabel || label).trim();
    if (!isChildrenFactLabel(display) && !/^familie$/i.test(display)) continue;
    if (/^familie$/i.test(display)) continue;
    if (isChildrenFactLabel(display)) sellerChildren.push(display);
  }

  if (sellerChildren.length) {
    const current = sellerChildren[sellerChildren.length - 1];
    const historical = [
      ...(profileLabel && profileLabel.toLowerCase() !== current.toLowerCase() ? [profileLabel] : []),
      ...sellerChildren.slice(0, -1).filter((l) => l.toLowerCase() !== current.toLowerCase()),
    ];
    return {
      label: current,
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
      historicalValues: [...new Set(historical)],
      ...sellerFactProvenance(current, provenanceByLabel),
    };
  }
  if (profileLabel) {
    return {
      label: profileLabel,
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
      historicalValues: [],
      ...customerFactProvenance(lead, profile),
    };
  }
  return null;
}

function resolveProfileChildren(profile = {}) {
  if (profile.children != null && profile.children !== false) return profile.children;
  const fromHousehold = profile.household?.childrenCount;
  if (fromHousehold != null && fromHousehold !== false) return fromHousehold;
  return null;
}

function buildMenschAlltagFacts(
  profile = {},
  sellerLabels = [],
  usedLabels = new Set(),
  {
    lead = {},
    provenanceByLabel = new Map(),
  } = {},
) {
  const facts = [];
  const customerProv = customerFactProvenance(lead, profile);
  const childrenTruth = resolveCurrentChildrenTruth(
    profile,
    sellerLabels,
    provenanceByLabel,
    lead,
  );
  const childrenLabel = childrenTruth?.label || null;
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 10,
      icon: 'alltag',
      state: childrenTruth.state,
      historicalValues: childrenTruth.historicalValues,
      source: childrenTruth.source,
      actorType: childrenTruth.actorType,
      actorId: childrenTruth.actorId,
      actorName: childrenTruth.actorName,
      createdAt: childrenTruth.createdAt,
      updatedAt: childrenTruth.updatedAt,
      sourceChannel: childrenTruth.sourceChannel,
    }));
    usedLabels.add(childrenLabel.toLowerCase());
    usedLabels.add('familie');
    usedLabels.add('kinder');
    for (const old of childrenTruth.historicalValues ?? []) {
      usedLabels.add(String(old).toLowerCase());
    }
  }

  const hasFamily = profile.priorities?.includes('family')
    || Boolean(resolveProfileChildren(profile))
    || (profile.persons ?? 0) >= 5;
  if (hasFamily && !childrenLabel) {
    pushFact(facts, fact('family', 'Familie', {
      editKey: 'family',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 15,
      icon: 'alltag',
      ...customerProv,
    }));
    usedLabels.add('familie');
  }

  const dogTruth = resolveCurrentDogTruth(
    profile,
    sellerLabels,
    provenanceByLabel,
    lead,
  );
  if (dogTruth?.label) {
    pushFact(facts, fact('dog', dogTruth.label, {
      editKey: 'dog',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.DOG,
      summaryPriority: 12,
      icon: 'alltag',
      state: dogTruth.state,
      historicalValues: dogTruth.historicalValues,
      source: dogTruth.source,
      actorType: dogTruth.actorType,
      actorId: dogTruth.actorId,
      actorName: dogTruth.actorName,
      createdAt: dogTruth.createdAt,
      updatedAt: dogTruth.updatedAt,
      sourceChannel: dogTruth.sourceChannel,
    }));
    usedLabels.add(String(dogTruth.label).toLowerCase());
    usedLabels.add('hund');
  }

  if (profile.chargingAtHome === 'yes') {
    pushFact(facts, fact('chargingAtHome', 'Haus', {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 14,
      ...customerProv,
    }));
    usedLabels.add('haus');
    usedLabels.add('laden zuhause');
  } else if (
    profile.household?.housingType === 'own_house'
    && !usedLabels.has('haus')
    && !usedLabels.has('eigenes haus')
    && !usedLabels.has('eigenheim')
  ) {
    pushFact(facts, fact('housing', 'Haus', {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 14,
      ...customerProv,
    }));
    usedLabels.add('haus');
    usedLabels.add('eigenes haus');
    usedLabels.add('eigenheim');
  } else if (
    (profile.household?.housingType === 'apartment'
      || profile.household?.housingType === 'wohnung')
    && !usedLabels.has('wohnung')
  ) {
    pushFact(facts, fact('housing', 'Wohnung', {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 14,
      ...customerProv,
    }));
    usedLabels.add('wohnung');
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
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 16,
      ...customerProv,
    }));
    usedLabels.add(spaceLabel.toLowerCase());
  }

  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    if (!usedLabels.has('langstrecke') && !usedLabels.has('reichweite')) {
      pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
        editKey: 'usage',
        groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
        tint: SNAPSHOT_TINT.ALLTAG,
        summaryPriority: 17,
        ...customerProv,
      }));
      usedLabels.add('langstrecke');
    }
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 18,
      ...customerProv,
    }));
    usedLabels.add(label.toLowerCase());
  }

  return facts;
}

/** Entscheidende Auswahl-Prioritäten (Ladezeit/Reichweite) → Ausstattung. */
function buildDecisiveRequirementFacts(
  profile = {},
  sellerLabels = [],
  usedLabels = new Set(),
  {
    lead = {},
    provenanceByLabel = new Map(),
  } = {},
) {
  const facts = [];
  const customerProv = customerFactProvenance(lead, profile);

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
      ...customerProv,
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
        ...sellerFactProvenance(label, provenanceByLabel),
      }));
      usedLabels.add(lower);
    }
  }

  return facts;
}

/**
 * Seller-Labels mit slot=human → Persönliches.
 * Kinder laufen über resolveCurrentChildrenTruth (ein Current-Chip).
 * needProfile bleibt unangetastet; Merken schreibt oft nur sellerInsights.
 */
function buildHumanSellerFacts(
  sellerLabels = [],
  usedLabels = new Set(),
  provenanceByLabel = new Map(),
) {
  const pending = [];
  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured' || classified.slot !== 'human') continue;
    const display = String(classified.remapLabel || label).trim();
    if (!display) continue;
    const lower = display.toLowerCase();
    if (usedLabels.has(lower) || usedLabels.has(String(label).toLowerCase())) continue;
    if (pending.some((p) => p.lower === lower)) continue;
    pending.push({
      label,
      display,
      lower,
      isChildren: isChildrenFactLabel(display) || /^familie$/i.test(display),
      isSpecificChildren: isChildrenFactLabel(display),
      isDog: isDogFactLabel(display) || /^hund$/i.test(display),
      isUrgency: HUMAN_URGENCY_RE.test(display),
    });
  }

  const profileHasChildren = [...usedLabels].some((l) => (
    l === 'kinder' || l === '1 kind' || /^\d+\s*kinder?$/.test(l)
  ));
  const profileHasDog = usedLabels.has('hund')
    || [...usedLabels].some((l) => /^\d+\s*hunde?$/.test(l));
  const hasSpecificChildren = profileHasChildren
    || pending.some((p) => p.isSpecificChildren);

  const facts = [];
  for (const item of pending) {
    // Kinder: Current Truth bereits in buildMenschAlltagFacts
    if (item.isSpecificChildren || item.isChildren) {
      if (/^familie$/i.test(item.display) && hasSpecificChildren) {
        usedLabels.add(item.lower);
        continue;
      }
      if (item.isSpecificChildren || profileHasChildren) {
        usedLabels.add(item.lower);
        continue;
      }
    }
    if (item.isDog && profileHasDog) {
      usedLabels.add(item.lower);
      continue;
    }
    if (usedLabels.has(item.lower)) continue;

    pushFact(facts, fact(`human-note:${item.display}`, item.display, {
      editKey: item.isDog ? 'dog' : 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: item.isDog ? SNAPSHOT_MINI_EDITOR.DOG : null,
      summaryPriority: item.isUrgency ? 9 : item.isDog ? 12 : 18,
      icon: 'alltag',
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
      ...sellerFactProvenance(item.label, provenanceByLabel),
    }));
    usedLabels.add(item.lower);
    usedLabels.add(String(item.label).toLowerCase());
    if (item.isDog) usedLabels.add('hund');
  }
  return facts;
}

/**
 * Strukturierte Seller-Labels → Fahrzeugwunsch, Bestand oder Ausstattung.
 * Modell/Trim/Activity/Commercial: Header/Kern/Chat.
 * Human → buildHumanSellerFacts / Current-Truth (nicht hier).
 */
function buildRemappedStructuredFacts(
  sellerLabels = [],
  usedLabels = new Set(),
  provenanceByLabel = new Map(),
) {
  const preferenceFacts = [];
  const equipmentFacts = [];
  const bestandFacts = [];
  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'structured') continue;
    if (classified.slot === 'human') {
      // Persönliches: nach needProfile-Facts via buildHumanSellerFacts
      continue;
    }
    if (classified.slot === 'vehicleTrack' || classified.slot === 'commercial') {
      usedLabels.add(label.toLowerCase());
      continue;
    }
    if (classified.slot === 'bestand') {
      const remap = String(classified.remapLabel || label).trim();
      if (!remap) {
        usedLabels.add(label.toLowerCase());
        continue;
      }
      const lower = remap.toLowerCase();
      if (usedLabels.has(lower)) continue;
      pushFact(bestandFacts, fact(`bestand-note:${remap}`, remap, {
        editKey: 'tradeIn',
        relevanceKey: 'existingVehicle',
        groupId: SOFT_SNAPSHOT_GROUP.BESTAND,
        tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
        summaryPriority: 24,
        icon: 'car',
        state: SNAPSHOT_FACT_STATE.CONFIRMED,
        ...sellerFactProvenance(label, provenanceByLabel),
      }));
      usedLabels.add(lower);
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
    const sellerProv = sellerFactProvenance(label, provenanceByLabel);

    if (classified.slot === 'equipment') {
      const priority = classified.priority || parseEquipmentWishPriority(label);
      const explicit = hasExplicitEquipmentPriority(label);
      const display = formatEquipmentWishLabel(remap, priority, {
        explicitPreferred: explicit && priority === EQUIPMENT_WISH_PRIORITY.PREFERRED,
      });
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
        ...sellerProv,
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
        ...sellerProv,
      }));
    }
    usedLabels.add(lower);
    usedLabels.add(label.toLowerCase());
    usedLabels.add(stripEquipmentPrioritySuffix(label).toLowerCase());
  }
  return { preferenceFacts, equipmentFacts, bestandFacts };
}

/**
 * Nur bestätigter Kundenwunsch für Kern – kein Offer/PDF-Fallback.
 * @returns {{ value: *, source: 'wish' }|null}
 */
/**
 * Deal-Konditionen: Wish zuerst; wenn leer und genau ein Offer-Wert → aktiver Offer-Kontext.
 * Monatsraten bleiben über resolveConfirmedWishRate gefiltert.
 */
function resolveConfirmedKernWishValue(kind, wishValue, offerTerms) {
  if (wishValue != null && String(wishValue).trim() !== '') {
    if (isOfferOnlyCommercialValue(kind, wishValue, offerTerms)) return null;
    return { value: wishValue, source: 'wish' };
  }
  const fallbackSet = kind === 'termMonths'
    ? offerTerms.termMonths
    : kind === 'mileage'
      ? offerTerms.mileages
      : kind === 'downPayment'
        ? offerTerms.downPayments
        : kind === 'endDate'
          ? offerTerms.endDates
          : null;
  const fromOffer = pickSingleOfferTerm(fallbackSet);
  if (fromOffer == null || fromOffer === '') return null;
  return { value: fromOffer, source: 'offer' };
}

/**
 * Immer sichtbare Konditionen – Zahlungsart + feste Slots (Laufzeit · km · AZ · ggf. Ende).
 * Fehlende Werte als ausgegraute, editierbare Placeholder-Chips.
 * Aktiver Offer-/PDF-Kontext füllt leere Slots (Deal-Wahrheit), überschreibt aber keinen abweichenden Wunsch.
 */
export function buildKernKonditionen(lead = {}, profile = {}, options = {}) {
  const workingContextItems = options.workingContextItems ?? [];
  const offerTerms = collectOfferCommercialTerms(lead, workingContextItems);
  const chips = [];
  const sources = new Set();
  const paymentFromWish = resolvePaymentType(lead, profile);
  const paymentFromOffer = pickSingleOfferTerm(offerTerms.paymentTypes);
  const payment = paymentFromWish || paymentFromOffer || null;
  const isLeasing = payment === 'leasing' || payment == null;

  function pushKernSlot({
    id,
    filledLabel,
    emptyLabel,
    editKey,
    miniEditor,
    summaryPriority,
    source = null,
    icon = 'vertrag',
  }) {
    const filled = Boolean(filledLabel);
    if (filled && source) sources.add(source);
    pushFact(chips, {
      ...fact(id, filled ? filledLabel : emptyLabel, {
        editKey,
        groupId: 'kern',
        tint: SNAPSHOT_TINT.VERTRAG,
        miniEditor,
        summaryPriority,
        icon,
      }),
      empty: !filled,
    });
  }

  const paymentLabel = payment && PAYMENT_LABELS[payment] ? PAYMENT_LABELS[payment] : null;
  pushKernSlot({
    id: 'paymentType',
    filledLabel: paymentLabel,
    emptyLabel: 'Zahlungsart',
    editKey: 'paymentType',
    miniEditor: SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE,
    summaryPriority: 1,
    source: paymentLabel ? (paymentFromWish ? 'wish' : 'offer') : null,
    icon: 'budget',
  });

  const termResolved = resolveConfirmedKernWishValue(
    'termMonths',
    lead?.wish?.termMonths ?? profile?.leaseDurationMonths ?? null,
    offerTerms,
  );
  pushKernSlot({
    id: 'termMonths',
    filledLabel: termResolved ? formatMonths(termResolved.value) : null,
    emptyLabel: 'Laufzeit',
    editKey: 'termMonths',
    miniEditor: SNAPSHOT_MINI_EDITOR.TERM_MONTHS,
    summaryPriority: 2,
    source: termResolved?.source,
    icon: 'clock',
  });

  const kmResolved = resolveConfirmedKernWishValue(
    'mileage',
    lead?.wish?.mileagePerYear ?? profile?.annualKm ?? null,
    offerTerms,
  );
  pushKernSlot({
    id: 'mileagePerYear',
    filledLabel: kmResolved ? formatKm(kmResolved.value) : null,
    emptyLabel: 'km/Jahr',
    editKey: 'mileagePerYear',
    miniEditor: SNAPSHOT_MINI_EDITOR.MILEAGE,
    summaryPriority: 3,
    source: kmResolved?.source,
    icon: 'gauge',
  });

  const downResolved = resolveConfirmedKernWishValue(
    'downPayment',
    lead?.wish?.downPayment ?? profile?.budget?.downPayment ?? null,
    offerTerms,
  );
  pushKernSlot({
    id: 'downPayment',
    filledLabel: downResolved
      ? formatDownPayment(downResolved.value, { compact: true })
      : null,
    emptyLabel: 'Anzahlung',
    editKey: 'downPayment',
    miniEditor: SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT,
    summaryPriority: 4,
    source: downResolved?.source,
    icon: 'euro',
  });

  // Vertragsende: bei Leasing immer Slot; sonst nur wenn gesetzt
  const endResolved = resolveConfirmedKernWishValue(
    'endDate',
    lead?.wish?.leasingEndDate ?? lead?.leasingEndDate ?? lead?.crm?.leasingEndDate ?? null,
    offerTerms,
  );
  const endLabel = endResolved ? formatLeasingEndLabel(endResolved.value) : null;
  if (isLeasing || endLabel) {
    pushKernSlot({
      id: 'leasingEndDate',
      filledLabel: endLabel,
      emptyLabel: 'Vertragsende',
      editKey: 'leasingEndDate',
      miniEditor: SNAPSHOT_MINI_EDITOR.LEASING_END,
      summaryPriority: 5,
      source: endResolved?.source,
      icon: 'calendar',
    });
  }

  const filledChips = chips.filter((c) => c && !c.empty);
  const lineParts = filledChips.map((c) => c.label);
  const source = sources.has('wish')
    ? 'wish'
    : (sources.has('offer') ? 'offer' : 'none');

  return {
    title: 'Konditionen',
    source,
    line: lineParts.join(' · '),
    parts: lineParts,
    chips,
    vehicleLabel: null,
    /** Zone immer anzeigen – auch wenn alle Slots noch leer sind */
    hasData: true,
    paymentType: payment,
  };
}

function buildBestandFacts(
  lead = {},
  profile = {},
  usedLabels = new Set(),
  remappedBestandFacts = [],
) {
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
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
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
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
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
      state: SNAPSHOT_FACT_STATE.CONFIRMED,
    }));
    usedLabels.add(label.toLowerCase());
  }

  for (const remapped of remappedBestandFacts) {
    pushFact(facts, remapped);
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
  const customerProv = customerFactProvenance(lead, profile);

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
    lead?.wish?.preferredColor,
    lead?.wish?.color,
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
      // Track-Farbe oft VK; Profilfarbe → Kunde. Ohne klare Trennung: Profil gewinnt Optik.
      ...(profile.colorPreference || profile.colorHint ? customerProv : { source: 'seller' }),
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
      ...customerProv,
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
      ...customerProv,
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
      ...customerProv,
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
      source: 'seller',
    }));
  }

  return facts;
}

/**
 * Ausstattung – inkl. entscheidender Anforderungen und Priorität (Muss/Wichtig/Wunsch).
 */
function buildAusstattungTechnikFacts(
  lead = {},
  profile = {},
  sellerLabels = [],
  usedLabels = new Set(),
  remappedEquipmentFacts = [],
  provenanceByLabel = new Map(),
) {
  const facts = [];
  const customerProv = customerFactProvenance(lead, profile);

  for (const f of buildDecisiveRequirementFacts(profile, sellerLabels, usedLabels, {
    lead,
    provenanceByLabel,
  })) {
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
      ...customerProv,
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
    const explicit = Boolean(priorities[raw] || priorities[mapped])
      || hasExplicitEquipmentPriority(raw);
    const display = formatEquipmentWishLabel(mapped, priority, {
      explicitPreferred: explicit && priority === EQUIPMENT_WISH_PRIORITY.PREFERRED,
    });
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
      ...customerProv,
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
    const explicit = hasExplicitEquipmentPriority(text);
    const display = formatEquipmentWishLabel(base, priority, {
      explicitPreferred: explicit && priority === EQUIPMENT_WISH_PRIORITY.PREFERRED,
    });
    pushFact(facts, fact(`tech:${base}`, display, {
      editKey: 'equipment',
      groupId: SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: priority === EQUIPMENT_WISH_PRIORITY.REQUIRED ? 28 : 54,
      icon: 'car',
      priority,
      ...customerProv,
    }));
    usedLabels.add(base.toLowerCase());
  }

  return facts;
}

/** Sonstiges – Freinotizen + Zero-Loss-Parkplatz; Activity/strukturiert ausgeschlossen. */
function buildSonstigesFacts(
  lead = {},
  sellerLabels = [],
  usedLabels = new Set(),
  provenanceByLabel = new Map(),
) {
  const facts = [];

  for (const label of sellerLabels) {
    const classified = classifySnapshotNoteLabel(label);
    if (classified.kind !== 'free') continue;
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) continue;
    if (label.length < 3) continue;
    pushFact(facts, fact(`note:${label}`, label, {
      editKey: 'bedarf',
      groupId: SOFT_SNAPSHOT_GROUP.SONSTIGES,
      tint: SNAPSHOT_TINT.NOTIZ,
      summaryPriority: 70,
      ...sellerFactProvenance(label, provenanceByLabel),
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
        groupId: SOFT_SNAPSHOT_GROUP.SONSTIGES,
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
 * Summary-Tokens: 3–5 wichtigste Soft-Facts (ohne empty / Kontakt-Missing / System-Noise).
 * Ranking über summaryPriority (niedriger = wichtiger).
 * @param {object[]} groupsOrFacts
 * @param {number} [maxTokens]
 */
export function buildSnapshotSummary(groupsOrFacts = [], maxTokens = SNAPSHOT_SUMMARY_MAX_TOKENS, lead = null) {
  const facts = groupsOrFacts[0]?.facts
    ? groupsOrFacts.flatMap((g) => g.facts || [])
    : [...groupsOrFacts];
  const usable = facts.filter((f) => {
    if (!f || f.empty) return false;
    const label = String(f.label || '').trim();
    if (!label) return false;
    if (/telefon fehlt|e-?mail fehlt/i.test(label)) return false;
    if (isSnapshotSystemNoiseLabel(label)) return false;
    if (isSnapshotContactIdentityLabel(label, lead || {})) return false;
    return true;
  });
  const ranked = [...usable].sort((a, b) => (
    (a.summaryPriority ?? 50) - (b.summaryPriority ?? 50)
  ));
  const tokens = ranked.slice(0, Math.max(0, maxTokens));
  const overflow = Math.max(0, ranked.length - tokens.length);
  return {
    tokens,
    overflow,
    line: tokens
      .map((t) => stripEquipmentPrioritySuffix(t.label) || t.label)
      .filter(Boolean)
      .join(' · '),
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
  const { labels: sellerLabels, provenanceByLabel } = collectConfirmedSellerLabelBundle(lead);
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

  // Strukturierte Remaps (Farbe/Antrieb → Fahrzeugwunsch, Bestand-Off-UI, Equipment)
  const remapped = buildRemappedStructuredFacts(sellerLabels, usedLabels, provenanceByLabel);
  // needProfile zuerst, dann Seller-Human-Labels (Merken → sellerInsights ohne needProfile)
  const persoenlichesFacts = [
    ...buildMenschAlltagFacts(profile, sellerLabels, usedLabels, { lead, provenanceByLabel }),
    ...buildHumanSellerFacts(sellerLabels, usedLabels, provenanceByLabel),
  ];
  // Bestand nur zum Markieren von usedLabels (kein sichtbarer Kundenwissen-Bucket)
  buildBestandFacts(
    lead,
    profile,
    usedLabels,
    remapped.bestandFacts,
  );
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
    provenanceByLabel,
  );
  const sonstigesFacts = buildSonstigesFacts(lead, sellerLabels, usedLabels, provenanceByLabel);

  const softGroupsSpec = [
    {
      id: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      facts: omitFactsByDedupe(persoenlichesFacts, kernOmitLabels, kernOmitIds),
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
      id: SOFT_SNAPSHOT_GROUP.SONSTIGES,
      facts: omitFactsByDedupe(sonstigesFacts, kernOmitLabels, kernOmitIds),
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
    .map((g) => {
      const facts = annotateFacts(
        (g.facts || []).filter((f) => f.state !== SNAPSHOT_FACT_STATE.HISTORICAL),
        relevantSet,
        highlightSet,
      );
      return {
        id: g.id,
        title: SOFT_SNAPSHOT_GROUP_TITLE[g.id] || SNAPSHOT_GROUP_TITLE[g.id],
        editKey: SNAPSHOT_GROUP_EDIT_KEY[g.id] || facts[0]?.editKey || null,
        relevant: facts.some((f) => f.relevant),
        empty: facts.length === 0,
        /** @deprecated Panel nutzt + Wissen ergänzen statt per-Group Chip-Picker */
        showAddCta: false,
        /** @deprecated use showAddCta */
        showEquipmentCta: false,
        addCategory: SOFT_GROUP_ADD_CATEGORY[g.id] || null,
        facts,
      };
    })
    // Nur Themen mit echten Facts – kein leeres Formular-Gerüst
    .filter((g) => g.facts.length > 0);

  const softFacts = softGroups.flatMap((g) => g.facts);
  const softSummary = buildSnapshotSummary(
    softGroups,
    options.maxSummaryTokens ?? SNAPSHOT_SUMMARY_MAX_TOKENS,
    lead,
  );
  const softChips = flattenSnapshotChips(softGroups);
  const kernChips = annotateFacts(kern.chips, relevantSet, highlightSet);
  const workingContext = buildWorkingContextStrip(workingContextItems, lead);
  const panelTopics = buildSoftPanelTopics(softGroups);

  // Working Context = Angebots-Kontext, überschreibt Customer Truth nicht
  const showWorkingStrip = Boolean(workingContext?.line);

  const hasSoftFacts = softFacts.length > 0;
  // Soft-Zeile immer sichtbar (Summary oder Leerhinweis); Kontakt fehlt ≠ Kundenwissen
  const hasSoft = true;
  const hasKern = Boolean(kern.hasData);
  /** @deprecated Kontakt-Missing gehört in den Header, nicht in Soft */
  const contactChips = [];

  return {
    meta: {
      hasData: hasSoft || hasKern,
      hasSoft,
      hasKern,
      hasSoftFacts,
      factCount: softFacts.length + kernChips.length,
      source: understanding?.meta?.source ?? ((softFacts.length > 0 || hasKern) ? 'lead' : 'none'),
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
      topics: panelTopics,
      chips: softChips,
      hasData: true,
      hasSoftFacts,
      /** @deprecated Kontakt-Missing gehört in den Header, nicht in Soft */
      contactChips,
    },
    /** @deprecated use soft.summary */
    summary: softSummary,
    /** Soft-Gruppen (nur mit Facts) */
    groups: softGroups,
    /** Soft-Chips – keine Header-/Kern-Duplikate */
    chips: softChips,
    softChips,
    kernChips,
    workingContext: showWorkingStrip ? workingContext : null,
  };
}
