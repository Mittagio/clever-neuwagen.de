import { calculatePrice } from './priceCalculator.js';
import { validateVehicleCompliance } from './complianceShield.js';

const DEFAULT_ENGINE = 'tgi-hybrid-2wd';
const DEFAULT_TRIM = 'vision';

export function buildPricingConfigFromLead(lead) {
  const wish = lead.wish ?? {};
  return {
    model: 'Sportage',
    engineId: lead.vehicle?.engineId ?? DEFAULT_ENGINE,
    trimId: lead.vehicle?.trimId ?? DEFAULT_TRIM,
    colorId: lead.vehicle?.colorId ?? 'carraraweiss',
    customerGroup: wish.customerGroup ?? 'standard',
    paymentType: wish.paymentType ?? lead.paymentType ?? 'leasing',
    termMonths: wish.termMonths ?? 48,
    mileagePerYear: wish.mileagePerYear ?? 15000,
    downPayment: wish.downPayment ?? 0,
    selectedPackageIds: wish.selectedPackageIds ?? [],
    selectedAccessoryIds: wish.selectedAccessoryIds ?? [],
    dealerConditions: lead._conditions,
  };
}

export function calculateRateForLead(lead, conditions) {
  const config = buildPricingConfigFromLead({ ...lead, _conditions: conditions });
  const price = calculatePrice(config, conditions);

  const vehicleRef = {
    engineId: config.engineId,
    trimId: config.trimId,
    brand: lead.vehicle?.brand ?? 'Kia',
    model: lead.vehicle?.model ?? 'Sportage',
    label: lead.vehicle?.label,
  };
  const compliance = validateVehicleCompliance(vehicleRef);

  return {
    price,
    leasingRate: price.leasingRate,
    financeRate: price.financeRate,
    cashPrice: price.cashPrice,
    listPrice: price.listPriceGross ?? price.cashPrice,
    deliveryTime: price.deliveryTime ?? conditions?.deliveryTime ?? 'ca. 4–8 Wochen',
    complianceStatus: compliance.publishable ? 'ok' : 'blocked',
    complianceLabel: compliance.publishable ? '🟢 Compliance OK' : '🔴 Nicht veröffentlichbar',
  };
}
