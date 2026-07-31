/**
 * Verifizierter Fahrzeugfakt – keine OpenAI-Wahrheit.
 */
import { getVerifiedVehicleFacts } from '../clever/openai/tools/getVerifiedVehicleFacts.js';

const FACT_PATTERNS = [
  { key: 'towingCapacity', label: 'Anhängelast', patterns: [/anhängelast/i, /\btow/i] },
  { key: 'wltpRange', label: 'WLTP-Reichweite', patterns: [/reichweite/i, /\bwltp\b/i] },
  { key: 'batteryCapacity', label: 'Batteriekapazität', patterns: [/batterie|akku|kwh/i] },
  { key: 'seats', label: 'Sitze', patterns: [/\bsitze\b|\bsitzplätze\b/i] },
  { key: 'headUpDisplay', label: 'Head-up-Display', patterns: [/\bhud\b|head-?\s*up/i] },
  { key: 'listPrice', label: 'Listenpreis', patterns: [/listenpreis|upe\b|grundpreis/i] },
];

const MODEL_RE = /\b(ev\s*[2-9]|ev9|sportage|xceed|ceed|picanto|niro|sorento|stonic|soul)\b/i;

/**
 * @param {string} sellerInput
 */
export function resolveTechnicalFactKeyFromInput(sellerInput = '') {
  const t = String(sellerInput || '');
  for (const entry of FACT_PATTERNS) {
    if (entry.patterns.some((re) => re.test(t))) {
      return { factKey: entry.key, factLabel: entry.label };
    }
  }
  return { factKey: null, factLabel: null };
}

/**
 * @param {string} sellerInput
 * @param {string|null} [fallbackModelKey]
 */
export function resolveModelKeyFromInput(sellerInput = '', fallbackModelKey = null) {
  const m = String(sellerInput || '').match(MODEL_RE);
  if (!m) return fallbackModelKey || null;
  return m[1].replace(/\s+/g, '').toLowerCase();
}

/**
 * @param {{
 *   modelKey?: string|null,
 *   factKey?: string|null,
 *   sellerInput?: string,
 * }} params
 */
export function lookupVehicleTechnicalFact(params = {}) {
  const sellerInput = String(params.sellerInput || '');
  const resolved = resolveTechnicalFactKeyFromInput(sellerInput);
  const factKey = params.factKey || resolved.factKey;
  const factLabel = resolved.factLabel
    || (factKey === 'towingCapacity' ? 'Anhängelast' : factKey);
  const modelKey = params.modelKey || resolveModelKeyFromInput(sellerInput);

  if (!modelKey) {
    return {
      ok: false,
      status: 'missing_model',
      modelKey: null,
      factKey,
      factLabel,
      value: null,
      unit: null,
      displayValue: null,
      sourceId: null,
      sourceLabel: null,
      warnings: ['Modell nicht erkannt'],
      message: 'Für welchen Modell soll ich den Wert prüfen?',
    };
  }

  if (!factKey) {
    return {
      ok: false,
      status: 'missing_fact_key',
      modelKey,
      factKey: null,
      factLabel: null,
      value: null,
      unit: null,
      displayValue: null,
      sourceId: null,
      sourceLabel: null,
      warnings: [],
      message: 'Welche technische Angabe soll ich prüfen?',
    };
  }

  const verified = getVerifiedVehicleFacts({
    modelKey,
    requestedFacts: [factKey],
  });

  const candidates = (verified.facts || []).filter(
    (f) => f.key === factKey && (f.status === 'verified' || f.status === 'conflict'),
  );
  const conflictValues = [
    ...new Set(
      candidates
        .map((f) => (f.unit ? `${f.value} ${f.unit}` : String(f.value)))
        .filter(Boolean),
    ),
  ];
  if (conflictValues.length > 1 || candidates.some((f) => f.status === 'conflict')) {
    return {
      ok: false,
      status: 'conflicting_sources',
      modelKey,
      factKey,
      factLabel,
      value: null,
      unit: null,
      displayValue: null,
      sourceId: null,
      sourceLabel: null,
      warnings: [
        `Widersprüchliche Quellen für ${factLabel || factKey}: ${conflictValues.join(' vs. ')}`,
      ],
      message: 'Die Quellen widersprechen sich – ich wähle keinen Wert aus.',
      conflictingValues: conflictValues,
    };
  }

  const fact = candidates.find((f) => f.status === 'verified');
  if (!fact) {
    return {
      ok: false,
      status: 'unverified_or_missing',
      modelKey,
      factKey,
      factLabel,
      value: null,
      unit: null,
      displayValue: null,
      sourceId: null,
      sourceLabel: null,
      warnings: verified.error ? [String(verified.error)] : [],
      message: 'Diesen Wert habe ich noch nicht eindeutig verifiziert.',
      missingFacts: verified.missingFacts || [factKey],
    };
  }

  const displayValue = fact.unit
    ? `${Number(fact.value).toLocaleString('de-DE')} ${fact.unit}`
    : String(fact.value);

  return {
    ok: true,
    status: 'verified',
    modelKey,
    modelLabel: `Kia ${modelKey.replace(/^./, (c) => c.toUpperCase())}`,
    factKey,
    factLabel,
    value: fact.value,
    unit: fact.unit,
    displayValue,
    sourceId: fact.sourceId,
    sourceLabel: fact.sourceId
      ? `Verifizierte Clever-Daten (${fact.sourceId})`
      : 'Verifizierte Clever-Fahrzeugdaten',
    factId: fact.factId,
    warnings: [],
    message: null,
  };
}
