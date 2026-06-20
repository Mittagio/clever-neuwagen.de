/**
 * Angebotsberechnung – Händlerkonditionen + Leasing/Finanzierung.
 * Erst nach Fahrzeugkonfiguration und Konditionen-Schritt.
 */
import { computeDetailPricing } from '../../logic/vehicleDetailPricing.js';
import { priceConfiguration } from '../pricing/pricingEngine.js';

function normalizePaymentMode(paymentType) {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'finance';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

/**
 * @param {import('./vehicleConfigurationTypes.js').VehicleConfiguration} vehicleConfiguration
 * @param {import('./vehicleConfigurationTypes.js').OfferConditions} offerConditions
 * @param {object} dealerConditions
 * @returns {import('./vehicleConfigurationTypes.js').OfferCalculation|null}
 */
export function computeOfferCalculation(vehicleConfiguration, offerConditions, dealerConditions) {
  if (!vehicleConfiguration?.modelKey) return null;

  const paymentMode = normalizePaymentMode(offerConditions.paymentType);
  const pricing = priceConfiguration({
    brand: vehicleConfiguration.brand,
    model: vehicleConfiguration.model,
    modelKey: vehicleConfiguration.modelKey,
    trimId: vehicleConfiguration.trimId,
    engineId: vehicleConfiguration.engineId,
    colorId: vehicleConfiguration.colorId,
    packageIds: vehicleConfiguration.packageIds,
    accessoryIds: vehicleConfiguration.accessoryIds,
    dealerConditions,
    termMonths: offerConditions.termMonths,
    mileagePerYear: offerConditions.mileagePerYear,
    paymentType: paymentMode === 'finance' ? 'finance' : paymentMode === 'cash' ? 'cash' : 'leasing',
    customerGroup: offerConditions.customerGroup ?? 'standard',
    customDiscountPercent: offerConditions.customDiscountPercent,
  });

  if (!pricing) return null;

  const detail = computeDetailPricing({
    payment: paymentMode,
    termMonths: offerConditions.termMonths,
    mileagePerYear: offerConditions.mileagePerYear,
    downPayment: offerConditions.downPayment,
    basePricing: pricing,
  });

  const monthlyRate = detail?.amount ?? pricing.primaryRate ?? null;

  return {
    configurationPrice: pricing.configurationPrice ?? vehicleConfiguration.uvpConfigurationPrice ?? null,
    discountPercent: pricing.discountPercent ?? null,
    discountAmount: pricing.discountAmount ?? null,
    housePrice: pricing.housePrice ?? null,
    cashPrice: pricing.cashPrice ?? null,
    monthlyRate,
    leasingRate: pricing.leasingRate ?? null,
    financeRate: pricing.financeRate ?? null,
    finalPayment: pricing.finalPayment ?? null,
    preparationFee: offerConditions.preparationFee,
    paymentType: offerConditions.paymentType,
    termMonths: offerConditions.termMonths,
    mileagePerYear: offerConditions.mileagePerYear,
    downPayment: offerConditions.downPayment,
    customerGroup: offerConditions.customerGroup ?? 'standard',
  };
}
