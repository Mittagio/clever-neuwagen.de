/**
 * Entfernt personenbezogene Daten vor Hersteller-Websuche.
 */

const PII_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi,
  /\b(?:\+49|0)[\d\s\-/]{8,}\d\b/g,
  /\b\d{5}\s+[A-Za-zÄÖÜäöüß][\w\s.-]{2,}\b/g,
  /\b[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s?\d{1,4}\b/g,
];

/**
 * @param {string} text
 */
export function redactPersonalData(text = '') {
  let next = String(text);
  for (const pattern of PII_PATTERNS) {
    next = next.replace(pattern, '[redacted]');
  }
  return next.trim();
}

/**
 * @param {object} params
 * @param {string} params.brandKey
 * @param {string} params.modelKey
 * @param {string|null} [params.variantKey]
 * @param {string[]} [params.requestedFacts]
 * @param {string} [params.market]
 */
export function buildOfficialSearchQuery({
  brandKey,
  modelKey,
  variantKey = null,
  requestedFacts = [],
  market = 'DE',
}) {
  const brand = String(brandKey ?? '').toUpperCase();
  const model = String(modelKey ?? '').toUpperCase();
  const variant = variantKey ? String(variantKey) : '';
  const factLabels = requestedFacts.map((f) => FACT_SEARCH_LABELS[f] ?? f).join(' ');
  const parts = [brand, model, variant, factLabels, market, 'technische Daten'].filter(Boolean);
  return redactPersonalData(parts.join(' '));
}

const FACT_SEARCH_LABELS = {
  wltpRange: 'WLTP Reichweite',
  batteryCapacity: 'Batterie Kapazität',
  seats: 'Sitzplätze',
  towingCapacity: 'Anhängelast gebremst',
  headUpDisplay: 'Head-up Display Ausstattung',
  charging: 'Ladeleistung Ladezeit',
  dimensions: 'Abmessungen',
  listPrice: 'Listenpreis',
  deliveryTime: 'Lieferzeit',
};
