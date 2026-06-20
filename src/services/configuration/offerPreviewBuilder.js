/**
 * Angebotsvorschau – Zusammenführung Konfiguration + Konditionen + Berechnung.
 */
import { computeOfferCalculation } from './offerCalculation.js';
import { vehicleConfigurationTitle } from './vehicleConfigurationModel.js';

function buildBudgetComparison(monthlyRate, budgetLimit, paymentType = 'leasing') {
  if (paymentType === 'cash' || budgetLimit == null || monthlyRate == null) {
    return { status: 'open', label: 'Budget offen', delta: null, icon: null };
  }
  if (monthlyRate <= budgetLimit) {
    return {
      status: 'ok',
      label: 'Budget erfüllt',
      delta: budgetLimit - monthlyRate,
      icon: '✓',
    };
  }
  const over = monthlyRate - budgetLimit;
  return {
    status: 'over',
    label: `Budget überschritten um ${over.toLocaleString('de-DE')} €`,
    delta: over,
    icon: '⚠',
  };
}

/**
 * @param {import('./vehicleConfigurationTypes.js').VehicleConfiguration} vehicleConfiguration
 * @param {import('./vehicleConfigurationTypes.js').OfferConditions} offerConditions
 * @param {object} dealerConditions
 * @param {object} [fields]
 */
export function buildOfferPreviewResult(
  vehicleConfiguration,
  offerConditions,
  dealerConditions,
  fields = {},
) {
  const offerCalculation = computeOfferCalculation(
    vehicleConfiguration,
    offerConditions,
    dealerConditions,
  );

  const paymentType = offerConditions.paymentType;
  const isCash = paymentType === 'cash';
  const budgetLimit = isCash
    ? (offerConditions.desiredPrice ?? fields.desiredPrice ?? null)
    : (offerConditions.desiredRate ?? fields.desiredRate ?? null);

  const monthlyRate = offerCalculation?.monthlyRate ?? null;
  const budget = buildBudgetComparison(monthlyRate, budgetLimit, paymentType);

  return {
    vehicleConfiguration,
    offerConditions,
    offerCalculation,
    vehicleTitle: vehicleConfigurationTitle(vehicleConfiguration),
    uvpConfigurationPrice: vehicleConfiguration.uvpConfigurationPrice,
    monthlyRate,
    budget,
    paymentType,
    discountPercent: offerCalculation?.discountPercent ?? null,
    discountAmount: offerCalculation?.discountAmount ?? null,
    housePrice: offerCalculation?.housePrice ?? null,
  };
}
