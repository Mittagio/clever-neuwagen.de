/**
 * Natürliche Verkäufer-Sprache → kommerzielle Offer-Slots (Rate, Laufzeit, km, AZ).
 * Agent-Pfad: kein Mini-Menü nötig, wenn der Satz den Wert schon trägt.
 */

const MONEY_FRAG = '(\\d{1,3}(?:[.\\s]\\d{3})*(?:[,.]\\d{1,2})?|\\d+(?:[,.]\\d{1,2})?)';

/**
 * @param {string} raw
 * @returns {number|null}
 */
export function parseEuroLoose(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * True, wenn der Seller nur nach der Rate fragt / sie anfordert – ohne Betrag.
 * @param {string} text
 */
export function isBareMonthlyRateCue(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\d/.test(t) && /(?:€|euro|rate|monat)/i.test(t)) {
    // „Monatsrate 399“ hat Ziffern – kein bare cue
    if (parseCommercialMonthlyRate(t) != null) return false;
  }
  return /^(?:die\s+)?(?:monats)?rate(?:\s+(?:eingeben|ergänzen|erganzen|fehlt|bitte))?[.!?]?$/i.test(t)
    || /^(?:welche\s+)?(?:monats)?rate\??$/i.test(t)
    || /^monatsrate\s*$/i.test(t)
    || /\bmonatsrate\b/i.test(t) && parseCommercialMonthlyRate(t) == null && !/\d{2,4}/.test(t);
}

/**
 * @param {string} text
 * @returns {number|null} monthly rate EUR
 */
export function parseCommercialMonthlyRate(text = '') {
  const blob = String(text || '').toLowerCase().replace(/\u00a0/g, ' ');
  const patterns = [
    new RegExp(`(?:monats|wunsch)?rate\\s*(?:von\\s*|ist\\s*|auf\\s*|=\\s*|ca\\.?\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
    new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:\\/\\s*monat|pro\\s+monat|mtl\\.?|monatlich|(?:monats|wunsch)?rate)`, 'i'),
    new RegExp(`(?:rate|leasing)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (!m?.[1]) continue;
    const value = parseEuroLoose(m[1]);
    if (value != null && value >= 50 && value <= 5000) return value;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {number|null} 0 allowed
 */
export function parseCommercialDownPayment(text = '') {
  const blob = String(text || '').toLowerCase().replace(/\u00a0/g, ' ');
  if (/\b(?:keine|ohne|null|0)\s*(?:€|euro)?\s*(?:anzahlung|az|sonderzahlung)\b/i.test(blob)
    || /\b(?:anzahlung|az|sonderzahlung)\s*(?:keine|ohne|null|0)\b/i.test(blob)
    || /\banzahlung\s*(?:auf\s*)?0\s*(?:€|euro)?\b/i.test(blob)) {
    return 0;
  }
  const m = blob.match(new RegExp(`(?:anzahlung|sonderzahlung|az)\\s*(?:von\\s*|auf\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'))
    || blob.match(new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:anzahlung|sonderzahlung|az)\\b`, 'i'));
  if (!m?.[1]) return null;
  const value = parseEuroLoose(m[1]);
  if (value == null || value < 0 || value > 200000) return null;
  return value;
}

/**
 * Kommerzielle Felder, die PREPARE_OFFER / Offer-Update rechtfertigen.
 * @param {object[]} facts
 */
export function hasCommercialOfferSlots(facts = []) {
  return (facts || []).some((f) => (
    f?.field === 'monthlyBudget'
    || f?.field === 'desiredRate'
    || f?.field === 'monthlyLeasingRate'
    || f?.field === 'termMonths'
    || f?.field === 'mileagePerYear'
    || f?.field === 'annualMileage'
    || f?.field === 'downPayment'
    || f?.field === 'paymentType'
  ));
}

/**
 * Klartext-Rückfrage – eine Zeile, kein Menü.
 */
export const MONTHLY_RATE_CLARIFY_PROMPT = 'Welche Monatsrate möchtest du hinterlegen?';

/**
 * Batch-Angebot: „mach die 3 Angebote“ / „Angebote für alle“.
 * @param {string} text
 */
export function isBatchOfferCue(text = '') {
  const t = String(text || '');
  return /\b(?:mach(?:e|en)?|erstell(?:e|en)?|vorbereiten?)\s+(?:mir\s+)?(?:die\s+)?(?:\d+\s+)?angebote\b/i.test(t)
    || /\bangebote\s+(?:für|fuer)\s+alle\b/i.test(t)
    || /\balle\s+(?:\d+\s+)?angebote\b/i.test(t)
    || /\b(?:die\s+)?(?:\d+\s+)?angebote\s+(?:machen|erstellen|vorbereiten)\b/i.test(t);
}

export {
  isBareOrGenericOfferCue,
  resolveOfferVehicleTarget,
  detectOfferMutationMode,
  parseOfferIdentityFollowUp,
  parseTrimSwitchPhrase,
  validateOfferVehicleIdentity,
  shouldBindIdentityToOpenOffer,
  CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
  OFFER_VEHICLE_TARGET_STATUS,
  OFFER_MUTATION_MODE,
} from './offerVehicleIdentity.js';
