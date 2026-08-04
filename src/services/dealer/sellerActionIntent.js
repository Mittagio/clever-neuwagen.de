/**
 * Seller Action Intent – Verkäufer-Eingabe → strukturierter Intent.
 * Keine parallele CRM-Wahrheit; orchestriert vorhandene Systeme.
 */

export const SELLER_ACTION_INTENTS = {
  MESSAGE_CUSTOMER: 'message_customer',
  PREPARE_OFFER: 'prepare_offer',
  SEND_PORTFOLIO: 'send_portfolio',
  ADD_NOTE: 'add_note',
  PREPARE_CALLBACK: 'prepare_callback',
  PROPOSE_APPOINTMENT: 'propose_appointment',
  LOOKUP_FACT: 'lookup_fact',
  REQUEST_DOCUMENTS: 'request_documents',
  UNKNOWN: 'unknown',
};

const PORTFOLIO_PATTERNS = [
  /\b(kundenlink|kunden\s*link)\b/i,
  /\b(auswahl|angebote?|portfolio)\b.{0,50}\b(schick|senden|mailen|versend|mail)/i,
  /\b(schick|senden|mailen|versend).{0,50}\b(auswahl|angebote?|portfolio|kundenlink|link)\b/i,
  /\blink\s+(schick|senden|mailen)\b/i,
  /\bper\s+(?:e-?mail|mail)\b.{0,40}\b(angebot|auswahl|link|portfolio)/i,
];

const OFFER_PATTERNS = [
  /\b(barangebot|kaufangebot|barkauf|bar\s*kauf)\b/i,
  /\b(angebot|leasing|finanzierung)\b.{0,40}\b(mach|vorbereiten|erstellen|anbieten)\b/i,
  /\b(mach(?:en)?|vorbereiten|erstellen|anbieten)\b.{0,40}\b(angebot|leasing|finanz|barangebot)\b/i,
  /\b(ev[2-9]|sportage|sorento).{0,40}\b(angebot|leasing|barangebot|finanz)/i,
  /\bangebot\b.{0,80}\b(ev[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b/i,
  /\b(ev[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b.{0,80}\bangebot\b/i,
  /\b\d{2,3}\s*%\b/,
  /\b\d{2,4}\s*(?:€|euro)\b.{0,20}\b(monat|rate|jahr)/i,
  /\bauf\s+(?:zwei|drei|vier|24|36|48|60)\s*(?:jahre|monate)?/i,
  /\b\d{2}\s*%\s*(?:rabatt)?/i,
];

const MESSAGE_PATTERNS = [
  /\b(habe|hätt[e]?|liegt|verfügbar|sofort)\b/i,
  /\b(nachricht|whatsapp|mail|schreib|informier|meld)/i,
  /\b(fahrzeug|wagen|ev\d|sportage|sorento).{0,40}\b(da|verfügbar|lager)/i,
];

const CALLBACK_PATTERNS = [
  /\b(rückruf|anrufen|callback|morgen\s+anrufen)\b/i,
  /\bruf\s+(ihn|sie|ihm|den|die)\b/i,
];

const APPOINTMENT_PATTERNS = [
  /\b(probefahrt|probe\s*fahrt|probefahren)\b/i,
  /\b(übergabe|ubergabe|abholung)\b/i,
  /\b(beratungsgespräch|beratungsgesprach|beratungstermin)\b/i,
  /\b(termin).{0,40}\b(vorschlagen|anbieten|vereinbaren|eintragen)\b/i,
  /\b(vorschlagen|anbieten|vereinbaren).{0,40}\b(termin|probefahrt)\b/i,
  /\bschlag(?:e|en)?\b.{0,60}\bvor\b/i,
  /\b(?:komm(?:en)?|vorbeikomm(?:en)?)\s+soll\b/i,
  /\bam\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b.{0,40}\b\d{1,2}(?::\d{2})?\s*uhr\b/i,
];

const NOTE_PATTERNS = [
  /\b(notiz|merken|festhalten|notieren)\b/i,
];

const DOCUMENT_REQUEST_PATTERNS = [
  /\b(unterlagen?|gehaltsnachweis|bankverbindung|ausweis|selbstauskunft)\b/i,
  /\b(anforder|schick.{0,20}selbstauskunft|fehl(?:en|t)|hochladen)\b/i,
  /\bschreib.{0,40}(fehlt|fehlen|unterlage|selbstauskunft|gehalt)/i,
  /\bwelche\s+unterlagen?\b/i,
  /\b(upload[-\s]?link|sicheren?\s+upload)\b/i,
];

const LOOKUP_FACT_PATTERNS = [
  /\b(anhängelast|reichweite|wltp|hud|head-?\s*up|ladeleistung|kofferraum|batterie|sitze|dimension)\b/i,
  /gr(?:ö|oe)(?:ß|ss)e|\bgross\b|groß/i,
  /\b(l(?:ä|ae)nge|breite|h(?:ö|oe)he|ma(?:ß|ss)e)\b/i,
  /\b(welcher|welche|was)\b[\s\S]{0,40}\b(mehr|besser|weiter)\b/i,
  /\b(oder|vs\.?|versus|gegen)\b/i,
];

const VEHICLE_MODEL_RE = /\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto)\b/i;

/** Nur Marke + Modell → Lexikon-Kurzprofil (nicht Kundennachricht). */
function isBareVehicleModelQuery(text = '') {
  const t = String(text ?? '').trim();
  if (!t || !VEHICLE_MODEL_RE.test(t)) return false;
  const stripped = t
    .replace(/\bkia\b/gi, '')
    .replace(VEHICLE_MODEL_RE, '')
    .replace(/[?.!,]/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * @param {string} text
 * @returns {typeof SELLER_ACTION_INTENTS[keyof typeof SELLER_ACTION_INTENTS]}
 */
export function detectSellerActionIntent(text = '') {
  const t = String(text ?? '').trim();
  if (!t) return SELLER_ACTION_INTENTS.UNKNOWN;

  if (PORTFOLIO_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.SEND_PORTFOLIO;
  }
  if (OFFER_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.PREPARE_OFFER;
  }
  if (DOCUMENT_REQUEST_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS;
  }
  // Lexikon/Vergleich vor Message-Default (sonst matcht „liegt/ist“ o. Ä. falsch)
  const hasLookup = LOOKUP_FACT_PATTERNS.some((re) => re.test(t));
  const hasVehicle = VEHICLE_MODEL_RE.test(t);
  const isQuestion = /\?/.test(t) || /\b(wie|was|welche[rs]?|welcher|hat\s+mehr)\b/i.test(t);
  const hasMessageVerb = /\b(schreib|sag|informier|schick|anforder|nachricht|whatsapp)\b/i.test(t);
  if (
    hasLookup
    && hasVehicle
    && !hasMessageVerb
    && (isQuestion || t.length <= 96)
  ) {
    return SELLER_ACTION_INTENTS.LOOKUP_FACT;
  }
  if (isBareVehicleModelQuery(t) && !hasMessageVerb) {
    return SELLER_ACTION_INTENTS.LOOKUP_FACT;
  }
  if (APPOINTMENT_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT;
  }
  if (CALLBACK_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.PREPARE_CALLBACK;
  }
  if (NOTE_PATTERNS.some((re) => re.test(t)) && !MESSAGE_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.ADD_NOTE;
  }
  if (MESSAGE_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER;
  }
  // Default: wenn der Verkäufer etwas Konkretes sagt → Nachricht vorbereiten
  if (t.length >= 12) return SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER;
  return SELLER_ACTION_INTENTS.UNKNOWN;
}

/**
 * Seller-Facts aus Freitext (nicht Kundenwunsch!).
 * @param {string} text
 */
export function extractSellerFactsFromInput(text = '') {
  const t = String(text ?? '');
  const facts = [];
  const sources = [];

  const model = t.match(/\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto|Seltos|K4|Stonic|Rio)\b(?:\s+(SW|GT-Line|Spirit|Earth|Vision|Air|DriveWise))?/i);
  if (model) {
    const label = [model[1], model[2]].filter(Boolean).join(' ');
    facts.push({ key: 'vehicle', label, source: 'seller_input' });
    sources.push('seller_input');
  }

  const color = t.match(/\b(Schwarzmetallic|Schwarz|Weiß|Weiss|Terracotta|Blau|Grau|Silber|Rot|Grün|Gruen)\b/i);
  if (color) {
    facts.push({ key: 'color', label: color[1], source: 'seller_input' });
  }

  if (/\bsofort\b/i.test(t) || /\bverfügbar\b/i.test(t)) {
    facts.push({ key: 'availability', label: 'sofort verfügbar', source: 'seller_input' });
  }

  const rate = t.match(/\b(\d{2,4})\s*(?:€|euro)\b/i);
  if (rate) {
    facts.push({ key: 'rate', label: `${rate[1]} €`, source: 'seller_input' });
  }

  const months = t.match(/\b(24|36|48|60)\s*(?:monate|monat)?\b/i)
    || t.match(/\bauf\s+(zwei|drei|vier)\s*jahre/i);
  if (months) {
    const map = { zwei: 24, drei: 36, vier: 48 };
    const raw = months[1].toLowerCase();
    const value = map[raw] ?? Number(raw);
    if (value) facts.push({ key: 'termMonths', label: `${value} Monate`, source: 'seller_input', value });
  }

  const discount = t.match(/\b(\d{1,2})\s*%\b/);
  if (discount) {
    facts.push({ key: 'discount', label: `${discount[1]} % Rabatt`, source: 'seller_input', value: Number(discount[1]) });
  }

  return facts;
}

/**
 * @param {object} lead
 * @param {string} sellerInput
 * @param {{ modeHint?: string|null }} [options]
 */
export function buildSellerActionIntent(lead = {}, sellerInput = '', options = {}) {
  const text = String(sellerInput ?? '').trim();
  let intent = detectSellerActionIntent(text);
  if (options.modeHint === 'message') intent = SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER;
  if (options.modeHint === 'offer') intent = SELLER_ACTION_INTENTS.PREPARE_OFFER;
  if (options.modeHint === 'portfolio') intent = SELLER_ACTION_INTENTS.SEND_PORTFOLIO;
  if (options.modeHint === 'documents') intent = SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS;
  if (options.modeHint === 'appointment' || options.modeHint === 'test_drive') {
    intent = SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT;
  }
  if (options.modeHint === 'callback') intent = SELLER_ACTION_INTENTS.PREPARE_CALLBACK;

  const sellerFacts = extractSellerFactsFromInput(text);
  const customerId = lead?.id ?? lead?.crm?.customerId ?? null;

  return {
    intent,
    customerId,
    sellerInput: text,
    sellerFacts,
    modeHint: options.modeHint ?? null,
    suggestedAction: {
      type: intent === SELLER_ACTION_INTENTS.PREPARE_OFFER
        ? 'draft_offer'
        : intent === SELLER_ACTION_INTENTS.SEND_PORTFOLIO
          ? 'send_portfolio'
        : intent === SELLER_ACTION_INTENTS.ADD_NOTE
          ? 'save_note'
          : intent === SELLER_ACTION_INTENTS.PREPARE_CALLBACK
            || intent === SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT
            ? 'propose_appointment'
            : intent === SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS
              ? 'workspace_package'
              : 'draft_message',
      channel: 'preferred',
    },
  };
}
