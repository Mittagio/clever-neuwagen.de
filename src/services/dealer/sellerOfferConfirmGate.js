/**
 * Seller confirm gate for PDF offer preview – block save until fields confirmed.
 */

export const PDF_CONFIRM_FIELDS = [
  'monthlyRate',
  'downPayment',
  'termMonths',
  'annualMileage',
  'transferFee',
  'offerType',
];

export const PDF_CONFIRM_REQUIRED = ['monthlyRate', 'offerType'];

/** Confidence below this is treated as needing explicit attention. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Resolve which commercial fields are low-confidence / ambiguous / implausible.
 * @param {{
 *   confidence?: Record<string, number>,
 *   ambiguities?: Array<{ field?: string }>,
 *   plausibilityFlags?: Record<string, boolean>,
 *   values?: Record<string, unknown>,
 *   fields?: string[],
 * }} opts
 * @returns {string[]}
 */
export function resolveLowConfidenceFields(opts = {}) {
  const fields = opts.fields ?? PDF_CONFIRM_FIELDS;
  const confidence = opts.confidence ?? {};
  const ambiguities = opts.ambiguities ?? [];
  const flags = opts.plausibilityFlags ?? {};
  const values = opts.values ?? {};
  const ambiguous = new Set(
    ambiguities.map((a) => a?.field).filter(Boolean),
  );
  const low = [];

  for (const field of fields) {
    if (ambiguous.has(field)) {
      low.push(field);
      continue;
    }
    const conf = confidence[field];
    if (Number.isFinite(conf) && conf < LOW_CONFIDENCE_THRESHOLD) {
      low.push(field);
      continue;
    }
    if (field === 'monthlyRate' && flags.monthlyRateImplausible) {
      low.push(field);
      continue;
    }
    if (field === 'downPayment' && flags.downPaymentImplausible) {
      low.push(field);
      continue;
    }
    const required = PDF_CONFIRM_REQUIRED.includes(field);
    const hasValue = values[field] != null && values[field] !== '';
    if (required && !hasValue) {
      low.push(field);
    }
  }

  return [...new Set(low)];
}

/**
 * Mark every field that is not low-confidence as confirmed.
 * @param {string[]} fields
 * @param {string[]} lowConfidenceFields
 * @returns {Record<string, boolean>}
 */
export function buildHighConfidenceConfirmedMap(fields = PDF_CONFIRM_FIELDS, lowConfidenceFields = []) {
  const low = new Set(lowConfidenceFields);
  const next = {};
  for (const field of fields) {
    if (!low.has(field)) next[field] = true;
  }
  return next;
}

/**
 * @param {{
 *   confirmed?: Record<string, boolean>,
 *   edited?: Record<string, boolean>,
 *   values?: Record<string, unknown>,
 *   requiredFields?: string[],
 *   centralConfirmed?: boolean,
 *   lowConfidenceFields?: string[],
 * }} state
 * @returns {{ canSave: boolean, missing: string[] }}
 */
export function evaluateSellerConfirmGate(state = {}) {
  const required = state.requiredFields ?? PDF_CONFIRM_REQUIRED;
  const confirmed = state.confirmed ?? {};
  const values = state.values ?? {};
  const centralConfirmed = Boolean(state.centralConfirmed);
  const lowConfidence = new Set(state.lowConfidenceFields ?? []);
  const missing = [];

  for (const field of required) {
    const hasValue = values[field] != null && values[field] !== '';
    if (!hasValue) {
      missing.push(field);
      continue;
    }

    // Low-confidence fields always need an explicit confirm (or edit + confirm).
    if (lowConfidence.has(field)) {
      if (!confirmed[field]) missing.push(field);
      continue;
    }

    // High-confidence: per-field confirm OR central "Alle Konditionen sind korrekt".
    if (!confirmed[field] && !centralConfirmed) {
      missing.push(field);
    }
  }

  return {
    canSave: missing.length === 0,
    missing,
  };
}

/**
 * Apply commercial field patch onto offer draft (preview edit).
 * @param {object} offerDraft
 * @param {Record<string, unknown>} patch
 */
export function applyCommercialConfirmPatch(offerDraft, patch = {}) {
  if (!offerDraft) return offerDraft;
  const payment = { ...(offerDraft.payment ?? {}) };
  const offerPreview = { ...(offerDraft.offerPreview ?? {}) };
  const offerCalculation = { ...(offerDraft.offerCalculation ?? {}) };

  if ('monthlyRate' in patch && patch.monthlyRate != null) {
    const rate = Number(patch.monthlyRate);
    if (Number.isFinite(rate)) {
      payment.calculatedRate = rate;
      payment.budget = rate;
      offerPreview.monthlyRate = rate;
      offerCalculation.monthlyRate = rate;
    }
  }
  if ('downPayment' in patch && patch.downPayment != null) {
    const down = Number(patch.downPayment);
    if (Number.isFinite(down)) {
      payment.downPayment = down;
      offerCalculation.downPayment = down;
    }
  }
  if ('termMonths' in patch && patch.termMonths != null) {
    const term = Number(patch.termMonths);
    if (Number.isFinite(term)) {
      payment.termMonths = Math.round(term);
      offerCalculation.termMonths = Math.round(term);
    }
  }
  if ('annualMileage' in patch && patch.annualMileage != null) {
    const km = Number(patch.annualMileage);
    if (Number.isFinite(km)) {
      payment.mileagePerYear = Math.round(km);
      offerCalculation.mileagePerYear = Math.round(km);
    }
  }
  if ('transferFee' in patch && patch.transferFee != null) {
    const fee = Number(patch.transferFee);
    if (Number.isFinite(fee)) {
      payment.transferCost = fee;
      offerCalculation.preparationFee = fee;
    }
  }
  if ('offerType' in patch && patch.offerType) {
    const type = String(patch.offerType);
    payment.type = type === 'cash' ? 'cash' : type;
    offerPreview.paymentType = payment.type;
  }

  return {
    ...offerDraft,
    payment,
    offerPreview,
    offerCalculation,
  };
}
