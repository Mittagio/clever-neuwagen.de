/**
 * Angebotskonditionen – Händlerwelt, getrennt von Fahrzeugkonfiguration.
 */

/**
 * @param {object} draft
 * @param {object} [dealerConditions]
 * @returns {import('./vehicleConfigurationTypes.js').OfferConditions}
 */
export function buildOfferConditionsFromDraft(draft, dealerConditions = null) {
  return {
    paymentType: draft?.paymentType === 'unknown' ? 'leasing' : (draft?.paymentType ?? 'leasing'),
    termMonths: draft?.termMonths ?? 48,
    mileagePerYear: draft?.mileagePerYear ?? 15000,
    downPayment: draft?.downPayment ?? 0,
    preparationFee: draft?.preparationFee ?? dealerConditions?.preparationFee ?? 1290,
    desiredRate: draft?.desiredRate ?? null,
    desiredPrice: draft?.desiredPrice ?? null,
    desiredDeliveryDate: draft?.desiredDeliveryDate ?? null,
    extras: { ...(draft?.extras ?? {}) },
  };
}

export function applyOfferConditionsToDraft(draft, offerConditions) {
  if (!draft || !offerConditions) return draft;
  return {
    ...draft,
    paymentType: offerConditions.paymentType,
    termMonths: offerConditions.termMonths,
    mileagePerYear: offerConditions.mileagePerYear,
    downPayment: offerConditions.downPayment,
    preparationFee: offerConditions.preparationFee,
    desiredRate: offerConditions.desiredRate,
    desiredPrice: offerConditions.desiredPrice,
    desiredDeliveryDate: offerConditions.desiredDeliveryDate,
    extras: { ...offerConditions.extras },
  };
}
