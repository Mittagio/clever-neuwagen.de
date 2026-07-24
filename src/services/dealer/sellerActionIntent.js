/**
 * Seller Action Intent – Verkäufer-Eingabe → strukturierter Intent.
 * Keine parallele CRM-Wahrheit; orchestriert vorhandene Systeme.
 */

export const SELLER_ACTION_INTENTS = {
  MESSAGE_CUSTOMER: 'message_customer',
  PREPARE_OFFER: 'prepare_offer',
  ADD_NOTE: 'add_note',
  PREPARE_CALLBACK: 'prepare_callback',
  LOOKUP_FACT: 'lookup_fact',
  UNKNOWN: 'unknown',
};

const OFFER_PATTERNS = [
  /\bmach(?:en)?\b.{0,40}\b(angebot|leasing|finanz)/i,
  /\b(angebot|leasing|finanzierung)\b.{0,30}\b(mach|vorbereiten|erstellen)/i,
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
];

const NOTE_PATTERNS = [
  /\b(notiz|merken|festhalten|notieren)\b/i,
];

/**
 * @param {string} text
 * @returns {typeof SELLER_ACTION_INTENTS[keyof typeof SELLER_ACTION_INTENTS]}
 */
export function detectSellerActionIntent(text = '') {
  const t = String(text ?? '').trim();
  if (!t) return SELLER_ACTION_INTENTS.UNKNOWN;

  if (OFFER_PATTERNS.some((re) => re.test(t))) {
    return SELLER_ACTION_INTENTS.PREPARE_OFFER;
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

  const model = t.match(/\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto)\b(?:\s+(GT-Line|Spirit|Earth|Vision|Air|DriveWise))?/i);
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
        : intent === SELLER_ACTION_INTENTS.ADD_NOTE
          ? 'save_note'
          : intent === SELLER_ACTION_INTENTS.PREPARE_CALLBACK
            ? 'schedule_callback'
            : 'draft_message',
      channel: 'preferred',
    },
  };
}
