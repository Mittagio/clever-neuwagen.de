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

/**
 * @param {{
 *   confirmed?: Record<string, boolean>,
 *   edited?: Record<string, boolean>,
 *   values?: Record<string, unknown>,
 *   requiredFields?: string[],
 * }} state
 * @returns {{ canSave: boolean, missing: string[] }}
 */
export function evaluateSellerConfirmGate(state = {}) {
  const required = state.requiredFields ?? PDF_CONFIRM_REQUIRED;
  const confirmed = state.confirmed ?? {};
  const values = state.values ?? {};
  const missing = [];

  for (const field of required) {
    const hasValue = values[field] != null && values[field] !== '';
    if (!hasValue || !confirmed[field]) {
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
