/**
 * Merge deterministische Overlays + OpenAI-Semantik.
 *
 * Produkt: OpenAI versteht Bedeutung. Clever normalisiert/validiert.
 * Deterministik = Overlay (E-Mail, Tel, IDs) + Fallback, nicht Primär-NL.
 */
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { normalizeFactDisplayLabel } from './normalizeFactDisplayLabel.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';

/** Harte Tokens: Deterministik behält Vorrang. */
const DETERMINISTIC_OVERLAY_FIELDS = new Set([
  'email',
  'phone',
  'vin',
  'customerId',
  'iban',
  'contractNumber',
  'offerId',
]);

/** Multi-Value: alle Unique behalten. */
const MULTI_VALUE_FIELDS = new Set([
  'equipmentWish',
  'vehicleInterest',
  'vehicleInterestMulti',
  'openCustomerQuestion',
  'unresolvedNote',
  'scenarioOfferFeedback',
]);

/** Risiko: eher Review, außer sehr hohe Confidence + Evidence. */
const RISKY_FIELDS = new Set([
  'desiredRate',
  'monthlyBudget',
  'purchasePrice',
  'discountPercent',
  'vehicleInterest',
  'tradeInRequested',
]);

/** Sichere Commercial-/Need-Slots bei Validation. */
const SAFE_DIRECT_FIELDS = new Set([
  'fuelPreference',
  'paymentType',
  'termMonths',
  'durationMonths',
  'annualMileage',
  'mileagePerYear',
  'downPayment',
  'colorPreference',
  'childrenCount',
  'pet',
  'hasPet',
  'towHitchRequired',
  'equipmentWish',
  'existingVehicle',
  'deliveryDeadline',
  'customerType',
  'transmissionPreference',
  'availabilityPreference',
  'maritalStatus',
  'decisionPartner',
]);

function factKey(fact = {}) {
  return [
    fact.factClass || '',
    fact.field || '',
    String(fact.label || '').trim().toLowerCase(),
  ].join('|');
}

function fieldKey(fact = {}) {
  return String(fact.field || '').trim() || `label:${String(fact.label || '').toLowerCase()}`;
}

function valuesConflict(a, b) {
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return String(a) !== String(b);
}

/**
 * Ob ein AI-Fact nach Confidence + Evidence + Feldklasse Review braucht.
 * Hohe Confidence allein reicht nicht; Evidence + sicheres Feld → direkt speicherbar.
 *
 * @param {object} fact
 * @returns {boolean}
 */
export function aiFactNeedsConfirmation(fact = {}) {
  const field = String(fact.field || '');
  const conf = Number(fact.confidence) || 0;
  const evidence = fact.evidence || fact.rawExpression || fact.span || null;
  const hasEvidence = Boolean(evidence && String(evidence).trim());

  if (fact.preserveAsNote || field === 'unresolvedNote') return false;
  if (conf < 0.85) return true;
  if (RISKY_FIELDS.has(field)) {
    return !(conf >= 0.95 && hasEvidence);
  }
  if (SAFE_DIRECT_FIELDS.has(field)) {
    if (conf >= 0.9 && hasEvidence) return false;
    if (conf >= 0.92) return false;
    return true;
  }
  // Unbekannte Felder: konservativ
  if (conf >= 0.95 && hasEvidence) return false;
  return true;
}

/**
 * Normalisiert Roh-AI-Fact → ExtractedFact (ohne pauschales needsConfirmation).
 * @param {object} raw
 */
export function materializeAiFact(raw = {}) {
  const evidence = raw.evidence || raw.rawExpression || raw.span || null;
  const confidence = Math.min(0.99, Math.max(0, Number(raw.confidence) || 0.7));
  const base = {
    factClass: raw.factClass || 'seller_note',
    field: raw.field || null,
    value: raw.value ?? null,
    label: normalizeFactDisplayLabel(raw.label, raw.value),
    source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
    confidence,
    evidence: evidence ? String(evidence).slice(0, 160) : null,
    rawExpression: evidence ? String(evidence).slice(0, 160) : null,
    span: evidence ? String(evidence).slice(0, 160) : null,
  };
  const needsConfirmation = aiFactNeedsConfirmation(base);
  return createExtractedFact({
    ...base,
    needsConfirmation,
  });
}

/**
 * @param {object[]} deterministicFacts
 * @param {object[]} aiFacts
 * @param {{ mode?: 'semantic_first'|'legacy' }} [options]
 */
export function mergeSellerInterpretation(deterministicFacts = [], aiFacts = [], options = {}) {
  const mode = options.mode === 'legacy' ? 'legacy' : 'semantic_first';

  if (mode === 'legacy') {
    return mergeLegacy(deterministicFacts, aiFacts);
  }

  return mergeSemanticFirst(deterministicFacts, aiFacts);
}

function mergeLegacy(deterministicFacts = [], aiFacts = []) {
  const merged = [];
  const seen = new Set();

  for (const fact of deterministicFacts) {
    if (!fact) continue;
    const key = factKey(fact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(fact);
  }

  for (const raw of aiFacts) {
    if (!raw?.label && raw?.value == null) continue;
    const fact = createExtractedFact({
      factClass: raw.factClass || 'seller_note',
      field: raw.field || null,
      value: raw.value ?? null,
      label: normalizeFactDisplayLabel(raw.label, raw.value),
      source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
      confidence: Math.min(0.85, Number(raw.confidence) || 0.7),
      needsConfirmation: true,
      rawExpression: raw.evidence || raw.rawExpression || null,
      span: raw.evidence || raw.span || null,
    });
    if (!fact.label) continue;
    const key = factKey(fact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(fact);
  }

  return merged;
}

function mergeSemanticFirst(deterministicFacts = [], aiFacts = []) {
  const detList = (deterministicFacts || []).filter(Boolean);
  const aiList = (aiFacts || [])
    .filter((raw) => raw && (raw.label || raw.value != null))
    .map((raw) => materializeAiFact(raw))
    .filter((f) => f.label || f.value != null);

  const byFieldDet = new Map();
  const multiDet = [];
  for (const fact of detList) {
    const field = String(fact.field || '');
    if (MULTI_VALUE_FIELDS.has(field) || !field) {
      multiDet.push(fact);
      continue;
    }
    if (!byFieldDet.has(field)) byFieldDet.set(field, fact);
  }

  const byFieldAi = new Map();
  const multiAi = [];
  for (const fact of aiList) {
    const field = String(fact.field || '');
    if (MULTI_VALUE_FIELDS.has(field) || !field) {
      multiAi.push(fact);
      continue;
    }
    if (!byFieldAi.has(field)) byFieldAi.set(field, fact);
  }

  const merged = [];
  const seen = new Set();
  const push = (fact) => {
    if (!fact) return;
    const key = factKey(fact);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(fact);
  };

  const allFields = new Set([...byFieldDet.keys(), ...byFieldAi.keys()]);
  for (const field of allFields) {
    const det = byFieldDet.get(field);
    const ai = byFieldAi.get(field);

    if (DETERMINISTIC_OVERLAY_FIELDS.has(field)) {
      push(det || ai);
      continue;
    }

    if (ai && det) {
      if (valuesConflict(ai.value, det.value)) {
        // Slotweise: Semantik gewinnt, Deterministik nur wenn AI unsicher
        if (ai.needsConfirmation && !det.needsConfirmation && Number(det.confidence) >= 0.9) {
          push({
            ...det,
            previousValue: ai.value,
            correctionSource: 'deterministic_overlay',
          });
          push({
            ...ai,
            needsConfirmation: true,
            label: ai.label || det.label,
          });
        } else {
          push({
            ...ai,
            previousValue: det.value,
            correctionSource: 'semantic_over_deterministic',
          });
        }
      } else {
        // Gleicher Slot: AI-Semantik + ggf. höhere Confidence / Evidence
        push({
          ...ai,
          confidence: Math.max(Number(ai.confidence) || 0, Number(det.confidence) || 0),
          rawExpression: ai.rawExpression || det.rawExpression || null,
          span: ai.span || det.span || null,
        });
      }
      continue;
    }

    push(ai || det);
  }

  for (const fact of [...multiAi, ...multiDet]) {
    push(fact);
  }

  return merged;
}

/**
 * Intent-Merge: bei semantic_first ergänzt AI; Deterministik behält bekannte Typen,
 * AI darf UPDATE_CUSTOMER_CONTEXT / PREPARE_OFFER ergänzen wenn fehlend.
 * @param {object[]} deterministicIntents
 * @param {object[]} aiIntents
 * @param {{ mode?: 'semantic_first'|'legacy' }} [options]
 */
export function mergeSellerIntents(deterministicIntents = [], aiIntents = [], options = {}) {
  const mode = options.mode === 'legacy' ? 'legacy' : 'semantic_first';
  const byType = new Map();

  if (mode === 'legacy') {
    for (const intent of deterministicIntents) {
      if (!intent?.type) continue;
      byType.set(intent.type, intent);
    }
    for (const intent of aiIntents) {
      if (!intent?.type || byType.has(intent.type)) continue;
      byType.set(intent.type, {
        type: intent.type,
        confidence: Math.min(0.8, Number(intent.confidence) || 0.65),
        source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
      });
    }
    return [...byType.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  // semantic_first: AI-Intents zuerst für Bedeutung, Deterministik ergänzt harte Actions
  for (const intent of aiIntents) {
    if (!intent?.type) continue;
    byType.set(intent.type, {
      type: intent.type,
      confidence: Math.min(0.98, Number(intent.confidence) || 0.75),
      source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
    });
  }
  for (const intent of deterministicIntents) {
    if (!intent?.type) continue;
    if (!byType.has(intent.type)) {
      byType.set(intent.type, intent);
    } else {
      const cur = byType.get(intent.type);
      byType.set(intent.type, {
        ...cur,
        confidence: Math.max(Number(cur.confidence) || 0, Number(intent.confidence) || 0),
      });
    }
  }
  return [...byType.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}

export { DETERMINISTIC_OVERLAY_FIELDS, SAFE_DIRECT_FIELDS, fieldKey };
