/**
 * Post-AI Validatoren für CleverMultiSourceIntakePlan.
 * OpenAI liefert Semantik; Clever blockiert/korrigiert unsichere Werte.
 */
import {
  isNumberBoundToMileage,
  parseTermAndMileageShorthand,
} from '../normalizeSellerUnits.js';
import { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';
import { hasTradeInCue } from '../detectTradeInFromSellerInput.js';

const SENSITIVE_RE = /\b(?:DE\d{2}\s?\d{4}|iban|ausweis|gehalt|arbeitgeber|unterschrift)\b/i;

/**
 * @param {object} plan
 * @param {{ sellerInput?: string, now?: Date|number }} [ctx]
 */
export function validateMultiSourceIntakePlan(plan = {}, ctx = {}) {
  const warnings = [];
  let next = structuredCloneSafe(plan);
  const sellerInput = String(ctx.sellerInput || '');
  const now = ctx.now || Date.now();

  next = validateUnits(next, sellerInput, warnings);
  next = validateMoneyVsMileage(next, sellerInput, warnings);
  next = validateTermAndMileage(next, sellerInput, warnings);
  next = validateVehicleRoles(next, sellerInput, warnings);
  next = validateTradeInVsInterest(next, sellerInput, warnings);
  next = validateTemporalScope(next, warnings);
  next = validateContractDates(next, now, warnings);
  next = validateContractStatus(next, now, warnings);
  next = validateCurrentVsHistoricalFacts(next, warnings);
  next = validateSourcesAndEvidence(next, warnings);
  next = redactSensitiveEvidence(next, warnings);

  return {
    ok: true,
    plan: next,
    warnings,
    schemaValid: isPlanShapeValid(plan),
  };
}

export function validateUnits(plan, sellerInput = '', warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const scenario of next.commercialScenarios || []) {
    if (scenario.annualMileage != null && scenario.unit === 'eur') {
      warnings.push({ id: 'validateUnits', message: 'mileage_unit_was_eur_cleared' });
      scenario.annualMileage = null;
    }
    if (scenario.purchasePrice != null && scenario.unit === 'km') {
      warnings.push({ id: 'validateUnits', message: 'price_unit_was_km_cleared' });
      scenario.purchasePrice = null;
    }
  }
  return next;
}

export function validateMoneyVsMileage(plan, sellerInput = '', warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const scenario of next.commercialScenarios || []) {
    const mileage = numOrNull(scenario.annualMileage);
    const price = numOrNull(scenario.purchasePrice);
    if (price != null && isNumberBoundToMileage(sellerInput, price)) {
      warnings.push({ id: 'validateMoneyVsMileage', message: 'blocked_km_as_purchase_price' });
      scenario.purchasePrice = null;
      if (scenario.annualMileage == null) scenario.annualMileage = price;
    }
    if (mileage != null && /\b€|euro\b/i.test(sellerInput) && !/\bkm\b/i.test(sellerInput)
      && !isNumberBoundToMileage(sellerInput, mileage)) {
      // keep mileage if shorthand says so; only clear if clearly money-only
    }
    // Harte Regel: Wert der an km gebunden ist, darf kein Geld sein
    if (price != null && isNumberBoundToMileage(sellerInput, Number(price))) {
      scenario.purchasePrice = null;
    }
  }
  // Facts: purchasePrice mit km-Bindung streichen
  next.currentCustomerFacts = (next.currentCustomerFacts || []).filter((f) => {
    if (f.field === 'purchasePrice' && isNumberBoundToMileage(sellerInput, Number(f.value))) {
      warnings.push({ id: 'validateMoneyVsMileage', message: 'dropped_purchase_price_fact' });
      return false;
    }
    if (f.unit === 'km' && /price|preis|geld|eur/i.test(String(f.field || ''))) {
      warnings.push({ id: 'validateMoneyVsMileage', message: 'dropped_money_field_with_km_unit' });
      return false;
    }
    return true;
  });
  return next;
}

export function validateTermAndMileage(plan, sellerInput = '', warnings = []) {
  const next = structuredCloneSafe(plan);
  const shorthand = parseTermAndMileageShorthand(sellerInput);
  if (!next.commercialScenarios?.length && (shorthand.termMonths || shorthand.annualMileage)) {
    next.commercialScenarios = [{
      type: 'leasing',
      termMonths: shorthand.termMonths,
      annualMileage: shorthand.annualMileage,
      purchasePrice: null,
      sourceType: 'seller_input',
      sourceId: 'seller_input',
      confidence: 0.85,
    }];
    warnings.push({ id: 'validateTermAndMileage', message: 'filled_from_shorthand' });
    return next;
  }
  for (const scenario of next.commercialScenarios || []) {
    if (scenario.termMonths == null && shorthand.termMonths != null) {
      scenario.termMonths = shorthand.termMonths;
    }
    if (scenario.annualMileage == null && shorthand.annualMileage != null) {
      scenario.annualMileage = shorthand.annualMileage;
    }
    if (
      scenario.purchasePrice != null
      && shorthand.annualMileage != null
      && Number(scenario.purchasePrice) === Number(shorthand.annualMileage)
    ) {
      warnings.push({ id: 'validateTermAndMileage', message: 'cleared_shorthand_price_collision' });
      scenario.purchasePrice = null;
    }
  }
  return next;
}

export function validateVehicleRoles(plan, sellerInput = '', warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const v of next.vehicleInterests || []) {
    if (!v.role || v.role === 'unknown') {
      v.role = 'desired_vehicle';
    }
    if (v.role === 'trade_in_vehicle' || v.role === 'historical_contract_vehicle') {
      warnings.push({ id: 'validateVehicleRoles', message: 'moved_non_desire_from_interests' });
    }
  }
  next.vehicleInterests = (next.vehicleInterests || []).filter((v) => (
    v.role === 'desired_vehicle' || v.role === 'comparison_vehicle' || v.role === 'unknown'
  ));
  for (const t of next.tradeInCandidates || []) {
    if (!t.role || t.role === 'unknown' || t.role === 'desired_vehicle') {
      t.role = 'trade_in_vehicle';
    }
  }
  for (const c of next.historicalContracts || []) {
    if (!c.vehicleRole || c.vehicleRole === 'desired_vehicle') {
      c.vehicleRole = 'historical_contract_vehicle';
    }
  }
  if (/\bvertrag\s+liegt\s+bei\b/i.test(sellerInput)) {
    next.vehicleInterests = (next.vehicleInterests || []).filter((v) => {
      const model = String(v.model || '').toLowerCase();
      const inContract = (next.historicalContracts || []).some(
        (c) => String(c.vehicleModel || '').toLowerCase() === model,
      );
      if (inContract) {
        warnings.push({ id: 'validateVehicleRoles', message: 'dropped_contract_vehicle_as_interest' });
        return false;
      }
      return true;
    });
  }
  return next;
}

export function validateTradeInVsInterest(plan, sellerInput = '', warnings = []) {
  const next = structuredCloneSafe(plan);
  const tradeModels = new Set(
    (next.tradeInCandidates || [])
      .map((t) => normalizeModel(t.model || t.label))
      .filter(Boolean),
  );
  if (hasTradeInCue(sellerInput) || tradeModels.size) {
    const before = (next.vehicleInterests || []).length;
    next.vehicleInterests = (next.vehicleInterests || []).filter((v) => {
      const model = normalizeModel(v.model || v.label);
      if (model && tradeModels.has(model)) {
        warnings.push({ id: 'validateTradeInVsInterest', message: 'dropped_tradein_as_interest' });
        return false;
      }
      return true;
    });
    if ((next.vehicleInterests || []).length < before) {
      // ok
    }
  }
  // „interessiert sich … für“ darf Interest behalten – Trade-in Cue fehlt dann typisch
  return next;
}

export function validateTemporalScope(plan, warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const f of next.currentCustomerFacts || []) {
    if (f.temporalScope === 'historical') {
      warnings.push({ id: 'validateTemporalScope', message: 'moved_historical_fact_out_of_current' });
      next.historicalCustomerFacts = next.historicalCustomerFacts || [];
      next.historicalCustomerFacts.push({ ...f, temporalScope: 'historical' });
    }
    if (!f.temporalScope || f.temporalScope === 'unknown') f.temporalScope = 'current';
  }
  next.currentCustomerFacts = (next.currentCustomerFacts || []).filter(
    (f) => f.temporalScope === 'current' || f.temporalScope === 'proposed',
  );
  for (const f of next.historicalCustomerFacts || []) {
    if (!f.temporalScope || f.temporalScope === 'current') f.temporalScope = 'historical';
  }
  return next;
}

export function validateContractDates(plan, now = Date.now(), warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const c of next.historicalContracts || []) {
    if (c.contractEndDate && c.contractStartDate) {
      const end = Date.parse(c.contractEndDate);
      const start = Date.parse(c.contractStartDate);
      if (Number.isFinite(end) && Number.isFinite(start) && end < start) {
        warnings.push({ id: 'validateContractDates', message: 'swapped_or_cleared_inverted_dates' });
        c.contractEndDate = null;
      }
    }
  }
  return next;
}

export function validateContractStatus(plan, now = Date.now(), warnings = []) {
  const next = structuredCloneSafe(plan);
  for (const c of next.historicalContracts || []) {
    const temporal = resolveContractTemporalStatus(c.contractEndDate, now);
    if (
      c.temporalStatusHint === 'active'
      && (temporal.status === 'historical_or_ended' || temporal.status === 'ended')
    ) {
      warnings.push({ id: 'validateContractStatus', message: 'corrected_active_to_historical' });
    }
    c.temporalStatusHint = temporal.status;
    c._resolvedStatus = temporal.status;
    c._resolvedStatusLabel = temporal.label;
  }
  return next;
}

export function validateCurrentVsHistoricalFacts(plan, warnings = []) {
  const next = structuredCloneSafe(plan);
  const currentByField = new Map(
    (next.currentCustomerFacts || []).map((f) => [f.field, f]),
  );
  for (const hist of next.historicalCustomerFacts || []) {
    const cur = currentByField.get(hist.field);
    if (cur && String(cur.value) !== String(hist.value)) {
      const id = `${hist.field}_temporal`;
      const exists = (next.conflicts || []).some((c) => c.id === id || c.field === hist.field);
      if (!exists) {
        next.conflicts = next.conflicts || [];
        next.conflicts.push({
          id,
          field: hist.field,
          label: `Historisch ${hist.value}, aktuell ${cur.value}.`,
          suggestedAction: 'prefer_current',
        });
        warnings.push({ id: 'validateCurrentVsHistoricalFacts', message: `conflict_${hist.field}` });
      }
    }
  }
  // Historische Fakten überschreiben keine aktuellen
  return next;
}

export function validateSourcesAndEvidence(plan, warnings = []) {
  const next = structuredCloneSafe(plan);
  const ensureSource = (item, fallback = 'seller_input') => {
    if (!item) return;
    if (!item.sourceType) item.sourceType = fallback;
    if (!item.sourceId) item.sourceId = fallback;
  };
  for (const c of next.customerCandidates || []) ensureSource(c, 'seller_input');
  for (const v of next.vehicleInterests || []) ensureSource(v, 'seller_input');
  for (const t of next.tradeInCandidates || []) ensureSource(t, 'seller_input');
  for (const c of next.historicalContracts || []) ensureSource(c, 'contract_pdf');
  for (const e of next.evidence || []) {
    if (!e.sourceType) {
      e.sourceType = 'unknown';
      warnings.push({ id: 'validateSourcesAndEvidence', message: 'evidence_missing_source' });
    }
  }
  return next;
}

export function redactSensitiveEvidence(plan, warnings = []) {
  const next = structuredCloneSafe(plan);
  const scrub = (value) => {
    if (typeof value !== 'string') return value;
    if (!SENSITIVE_RE.test(value)) return value;
    warnings.push({ id: 'redactSensitiveEvidence', message: 'redacted_snippet' });
    return value
      .replace(/\b[A-Z]{2}\d{2}(?:[ ]?\d{4}){3,8}\b/gi, '[IBAN entfernt]')
      .replace(/\b(?:Personalausweis|Reisepass|Ausweisnr\.?|Ausweis-?Nr\.?)\s*[:.]?\s*[A-Z0-9]{6,}/gi, '[Ausweis entfernt]');
  };
  for (const e of next.evidence || []) {
    e.snippet = scrub(e.snippet);
  }
  for (const f of [...(next.currentCustomerFacts || []), ...(next.historicalCustomerFacts || [])]) {
    f.evidence = scrub(f.evidence);
    if (SENSITIVE_RE.test(String(f.field || '')) || SENSITIVE_RE.test(String(f.value || ''))) {
      f.value = null;
      f.evidence = null;
    }
  }
  return next;
}

function isPlanShapeValid(plan) {
  if (!plan || typeof plan !== 'object') return false;
  return Array.isArray(plan.customerCandidates)
    && Array.isArray(plan.vehicleInterests)
    && Array.isArray(plan.tradeInCandidates)
    && Array.isArray(plan.historicalContracts)
    && typeof plan.confidence === 'number';
}

function normalizeModel(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\bkia\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function structuredCloneSafe(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj || {}));
  }
}
