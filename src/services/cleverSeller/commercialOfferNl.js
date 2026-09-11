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
  // „0 EUR Anzahlung“ / „ohne Anzahlung“ / „Anzahlung 0 €“ – 0 ist echter Wert, nicht missing
  if (/\b(?:keine|ohne|null|0)\s*(?:€|eur(?:o)?)?\s*(?:anzahlung|az|sonderzahlung)\b/i.test(blob)
    || /\b(?:anzahlung|az|sonderzahlung)\s*(?:keine|ohne|null|0)\s*(?:€|eur(?:o)?)?\b/i.test(blob)
    || /\banzahlung\s*(?:auf\s*)?0\s*(?:€|eur(?:o)?)?\b/i.test(blob)
    || /\b0\s*(?:€|eur(?:o)?)\s+anzahlung\b/i.test(blob)) {
    return 0;
  }
  const moneyUnit = '(?:€|eur(?:o)?)';
  const m = blob.match(new RegExp(`(?:anzahlung|sonderzahlung|az)\\s*(?:von\\s*|auf\\s*|in\\s+h[öo]he\\s+von\\s*)?${MONEY_FRAG}\\s*${moneyUnit}?`, 'i'))
    || blob.match(new RegExp(`${MONEY_FRAG}\\s*${moneyUnit}?\\s*(?:anzahlung|sonderzahlung|az)\\b`, 'i'))
    || blob.match(new RegExp(`(?:sonderzahlung|anzahlung)\\s+in\\s+h[öo]he\\s+von\\s+${MONEY_FRAG}\\s*${moneyUnit}?`, 'i'))
    || blob.match(new RegExp(`${MONEY_FRAG}\\s*${moneyUnit}?\\s*(?:anzuzahlen|anzahlen)\\b`, 'i'))
    || blob.match(new RegExp(`(?:kann|möchte|moechte|will)\\s+(?:bis\\s+zu\\s+)?${MONEY_FRAG}\\s*${moneyUnit}?\\s*(?:anzuzahlen|anzahlen)\\b`, 'i'));
  if (!m?.[1]) return null;
  const value = parseEuroLoose(m[1]);
  if (value == null || value < 0 || value > 200000) return null;
  return value;
}

/**
 * Outbound-/Prepared-Angebotstext („habe ich für Sie vorbereitet“) –
 * kein Signal, dass Clever das Angebot erst noch erzeugen muss.
 * @param {string} text
 */
export function hasPreparedOutboundOfferCue(text = '') {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (/\bhabe\s+ich\s+für\s+sie\s+vorbereitet\b/i.test(t)) return true;
  if (/\b(?:persönliches\s+)?(?:leasing)?angebot\b/i.test(t)
    && /\bvorbereitet\b/i.test(t)
    && /\b(?:für\s+sie|ihnen|leasingangebot|fahrzeugdetails)\b/i.test(t)) {
    return true;
  }
  return false;
}

/** Typische AZ-Untergrenze (Einmalbetrag) vs. Wunschrate. */
export const IMPLICIT_DOWN_PAYMENT_MIN = 1000;

const MONTHLY_BUDGET_CUE_RE = /\b(?:max(?:imal)?\.?|höchstens|hoechstens|bis\s+zu|wunschrate|monatsrate|mtl\.?|monatlich|pro\s+monat|\/\s*monat|(?:monats)?rate)\b/i;

/**
 * True, wenn nahe dem Betrag ein Monats-/Max-/Rate-Cue steht.
 * @param {string} text
 * @param {number} index
 * @param {number} [spanLen]
 */
export function hasMonthlyBudgetCueNear(text = '', index = 0, spanLen = 0) {
  const t = String(text || '');
  const start = Math.max(0, Number(index) || 0);
  const end = start + Math.max(0, Number(spanLen) || 0);
  const window = t.slice(Math.max(0, start - 28), Math.min(t.length, end + 28));
  return MONTHLY_BUDGET_CUE_RE.test(window);
}

/**
 * Freistehende Euro-Beträge ≥ ~1000 ohne Monats-Cue → Anzahlung,
 * besonders nach Laufzeit + km (Wittig: „48 12.500 km · 5000 €“).
 *
 * @param {string} text
 * @param {{ hasTermMonths?: boolean, hasAnnualMileage?: boolean }} [ctx]
 * @returns {number|null}
 */
export function parseImplicitDownPayment(text = '', ctx = {}) {
  const blob = String(text || '').replace(/\u00a0/g, ' ');
  if (!blob.trim()) return null;
  if (parseCommercialDownPayment(blob) != null) return null;

  const hasCommercialContext = Boolean(ctx.hasTermMonths && ctx.hasAnnualMileage);
  const matches = [...blob.matchAll(new RegExp(`\\b${MONEY_FRAG}\\s*(?:€|euro)(?!\\w)`, 'gi'))];
  for (const m of matches) {
    const value = parseEuroLoose(m[1]);
    if (value == null || value < IMPLICIT_DOWN_PAYMENT_MIN || value > 200000) continue;
    if (hasMonthlyBudgetCueNear(blob, m.index || 0, m[0].length)) continue;
    const before = blob.slice(Math.max(0, (m.index || 0) - 16), m.index || 0);
    // „bis 37.000 €“ = Preisdeckel, keine AZ
    if (/\bbis\s*(?:zu\s*)?$/i.test(before)) continue;
    const after = blob.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 16);
    if (/^\s*(?:anzahlung|az|sonderzahlung)\b/i.test(after)) continue;
    // Nach Laufzeit+km: nächster großer Euro-Betrag = AZ
    if (hasCommercialContext) return value;
    // Ohne Kontext: sehr große Einmalbeträge ebenfalls eher AZ als Monatsrate
    if (value >= 2000) return value;
  }
  return null;
}

/**
 * True, wenn Betrag eher Wunsch-/Monatsrate ist (klein oder Monats-Cue).
 * @param {number} value
 * @param {string} text
 * @param {number} [index]
 * @param {number} [spanLen]
 */
export function looksLikeMonthlyBudgetAmount(value, text = '', index = 0, spanLen = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 50 || n > 5000) return false;
  const t = String(text || '');
  const start = Math.max(0, Number(index) || 0);
  // „4.500 €“ → Match auf „500 €“ ist Tausender-Splitter, keine Wunschrate
  if (start > 0 && /[.\d]/.test(t[start - 1] || '')) return false;
  if (hasMonthlyBudgetCueNear(text, index, spanLen)) return true;
  // Kleine Beträge ohne Cue bleiben Wunschrate-Kandidaten; große Einmalbeträge nicht
  return n < IMPLICIT_DOWN_PAYMENT_MIN;
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
  // Ziffern + Wortzahlen (drei/beide) + alle
  return /\b(?:mach(?:e|en)?|erstell(?:e|en)?|vorbereiten?)\s+(?:mir\s+)?(?:die\s+)?(?:\d+|zwei|drei|vier|fünf|fuenf|beide|beiden)\s+angebote\b/i.test(t)
    || /\b(?:mach(?:e|en)?|erstell(?:e|en)?|vorbereiten?)\s+(?:mir\s+)?(?:die\s+)?angebote\b/i.test(t)
    || /\bangebote\s+(?:für|fuer)\s+alle\b/i.test(t)
    || /\balle\s+(?:\d+\s+)?angebote\b/i.test(t)
    || /\b(?:die\s+)?(?:\d+|zwei|drei|vier|fünf|fuenf|beide|beiden)\s+angebote\s+(?:machen|erstellen|vorbereiten)\b/i.test(t)
    || /\b(?:mach(?:e|en)?|erstell(?:e|en)?)\s+(?:mir\s+)?(?:die\s+)?beiden\s+angebote\b/i.test(t)
    || /\b(?:mach(?:e|en)?|erstell(?:e|en)?)\s+(?:die\s+)?angebote\s+für\s+beide\b/i.test(t)
    // „mach beide“ / „mach die beiden“ ohne explizites „Angebote“
    || /\b(?:mach(?:e|en)?|erstell(?:e|en)?)\s+(?:mir\s+)?(?:die\s+)?beide(?:n)?\b/i.test(t);
}

export {
  isBareOrGenericOfferCue,
  resolveOfferVehicleTarget,
  detectOfferMutationMode,
  parseOfferIdentityFollowUp,
  parseTrimSwitchPhrase,
  validateOfferVehicleIdentity,
  validateOfferPackageAgainstCatalog,
  validateOfferPowerAgainstCatalog,
  validateOfferEquipmentAgainstCatalog,
  shouldBindIdentityToOpenOffer,
  CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
  OFFER_VEHICLE_TARGET_STATUS,
  OFFER_MUTATION_MODE,
} from './offerVehicleIdentity.js';

export {
  parseSellerCommercialAliasShorthand,
  findSellerAliasesInText,
  resolveSellerAliasToken,
} from './sellerAliasRegistry.js';
