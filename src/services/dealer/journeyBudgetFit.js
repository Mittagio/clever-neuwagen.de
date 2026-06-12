/**
 * Budget-Abgleich für Journey-Angebote.
 */

/**
 * @param {object|null} snapshot
 * @param {object|null} offerBundle
 */
export function evaluateJourneyBudgetFit(snapshot, offerBundle) {
  const maxMonthlyRate = snapshot?.budget?.maxMonthlyRate;
  if (maxMonthlyRate == null || !offerBundle?.pricing) return null;

  const purchaseType = snapshot?.purchaseType;
  let comparedRate = null;

  if (purchaseType === 'cash') {
    return { fits: true, maxMonthlyRate, note: 'Budget bezieht sich auf monatliche Raten – Kaufpreis separat.' };
  }
  if (purchaseType === 'finance') {
    comparedRate = offerBundle.pricing.financeRate;
  } else if (purchaseType === 'leasing') {
    comparedRate = offerBundle.pricing.leasingRate;
  } else {
    comparedRate = offerBundle.pricing.leasingRate ?? offerBundle.pricing.financeRate;
  }

  if (comparedRate == null) return null;

  if (comparedRate <= maxMonthlyRate) {
    return {
      fits: true,
      maxMonthlyRate,
      comparedRate,
      label: snapshot.budget?.label ?? `bis ${maxMonthlyRate} €`,
    };
  }

  return {
    fits: false,
    maxMonthlyRate,
    comparedRate,
    delta: comparedRate - maxMonthlyRate,
    label: snapshot.budget?.label ?? `bis ${maxMonthlyRate} €`,
  };
}
