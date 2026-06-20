/**
 * Live-Vorschau für den Konditionen-Schritt (Schritt 2).
 */
import { LEASING_MILEAGE_OPTIONS, LEASING_TERM_OPTIONS } from '../../data/dealerConditionsSchema.js';
import { computeOfferCalculation } from './offerCalculation.js';
import { buildOfferConditionsFromDraft } from './offerConditionsModel.js';

export const DISCOUNT_GROUP_OPTIONS = [
  { id: 'standard', label: 'Standard' },
  { id: 'gewerbe', label: 'Gewerbe' },
  { id: 'corporateBenefits', label: 'Corporate Benefits' },
  { id: 'schwerbehindert', label: 'Schwerbehinderung' },
  { id: 'custom', label: 'Eigener Rabatt' },
];

export { LEASING_TERM_OPTIONS, LEASING_MILEAGE_OPTIONS };

export function resolveDiscountPercentForDraft(draft, dealerConditions) {
  if (draft?.customerGroup === 'custom') {
    const custom = Number(draft.customDiscountPercent);
    if (Number.isFinite(custom) && custom >= 0) return custom;
    return dealerConditions?.discounts?.standard ?? 0;
  }
  const group = draft?.customerGroup ?? 'standard';
  return dealerConditions?.discounts?.[group]
    ?? dealerConditions?.discounts?.standard
    ?? 0;
}

export function hasExactLeasingFactor(dealerConditions, termMonths, mileagePerYear) {
  return dealerConditions?.leasingFactors?.[termMonths]?.[mileagePerYear] != null;
}

function computeCashOfferFromUvp(uvpTotal, discountPercent, preparationFee) {
  const discountAmount = Math.round(uvpTotal * (discountPercent / 100));
  const housePrice = uvpTotal - discountAmount;
  return {
    discountPercent,
    discountAmount,
    housePrice,
    offerPrice: housePrice + preparationFee,
    preparationFee,
  };
}

/**
 * @param {import('./vehicleConfigurationTypes.js').VehicleConfiguration} vehicleConfiguration
 * @param {object} draft
 * @param {object} dealerConditions
 */
export function computeConditionsStepPreview(vehicleConfiguration, draft, dealerConditions) {
  if (!vehicleConfiguration || !draft) return null;

  const offerConditions = buildOfferConditionsFromDraft(draft, dealerConditions);
  const uvpTotal = vehicleConfiguration.uvpConfigurationPrice ?? 0;
  const preparationFee = offerConditions.preparationFee;
  const discountPercent = resolveDiscountPercentForDraft(draft, dealerConditions);
  const cash = computeCashOfferFromUvp(uvpTotal, discountPercent, preparationFee);

  const paymentType = offerConditions.paymentType;
  const isCash = paymentType === 'cash';
  const isLeasing = paymentType === 'leasing';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';

  const calculation = computeOfferCalculation(
    vehicleConfiguration,
    offerConditions,
    dealerConditions,
  );

  const leasingFactorExact = isLeasing && hasExactLeasingFactor(
    dealerConditions,
    offerConditions.termMonths,
    offerConditions.mileagePerYear,
  );

  const canShowLiveLeasingRate = isLeasing
    && leasingFactorExact
    && calculation?.monthlyRate != null;

  const canShowLiveFinanceRate = isFinance
    && calculation?.monthlyRate != null
    && (
      dealerConditions?.financeRates?.interestRate != null
      || dealerConditions?.financing?.effectiveRate != null
    );

  return {
    uvpTotal,
    discountPercent: cash.discountPercent,
    discountAmount: cash.discountAmount,
    housePrice: cash.housePrice,
    preparationFee,
    cashOfferPrice: cash.offerPrice,
    monthlyRate: calculation?.monthlyRate ?? null,
    finalPayment: calculation?.finalPayment ?? null,
    leasingFactorExact,
    canShowLiveLeasingRate,
    canShowLiveFinanceRate,
    isCash,
    isLeasing,
    isFinance,
    isThreeWay: paymentType === 'threeWayFinancing',
  };
}

export function buildConditionsFooterAction(preview) {
  if (!preview) {
    return { label: 'Vorschau anzeigen', hint: null };
  }

  if (preview.isCash && preview.cashOfferPrice != null) {
    return {
      label: `Angebotspreis ${Number(preview.cashOfferPrice).toLocaleString('de-DE')} € · Vorschau anzeigen`,
      hint: null,
    };
  }

  if (preview.isLeasing) {
    if (preview.canShowLiveLeasingRate && preview.monthlyRate != null) {
      return {
        label: `Rate ${Number(preview.monthlyRate).toLocaleString('de-DE')} €/Monat · Vorschau anzeigen`,
        hint: null,
      };
    }
    return {
      label: 'Leasingangebot vorbereiten',
      hint: 'Rate wird im Bankangebot bestätigt.',
    };
  }

  if (preview.isFinance) {
    if (preview.canShowLiveFinanceRate && preview.monthlyRate != null) {
      return {
        label: `Rate ${Number(preview.monthlyRate).toLocaleString('de-DE')} €/Monat · Vorschau anzeigen`,
        hint: null,
      };
    }
    return {
      label: 'Finanzierungsangebot vorbereiten',
      hint: 'Rate wird im Bankangebot bestätigt.',
    };
  }

  return { label: 'Vorschau anzeigen', hint: null };
}
