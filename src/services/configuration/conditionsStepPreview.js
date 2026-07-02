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

export const DOWN_PAYMENT_OPTIONS = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000];

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

export function buildConditionsFooterAction() {
  return {
    label: 'Angebot speichern',
    previewLabel: 'Vorschau ansehen',
    hint: 'Rate oder Angebotspreis werden live berechnet.',
  };
}

function formatRate(amount) {
  if (amount == null) return null;
  return `${Number(amount).toLocaleString('de-DE')} €/Monat`;
}

function formatCashPrice(amount) {
  if (amount == null) return null;
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

/**
 * Zusammenfassung für die Speicherleiste im Konditionen-Schritt.
 */
export function buildConditionsFooterSummary(preview, draft = {}) {
  if (!preview || !draft) {
    return { chips: [], result: null, resultSuffix: null };
  }

  const paymentType = draft.paymentType === 'unknown' ? 'leasing' : draft.paymentType;
  const termMonths = draft.termMonths ?? null;
  const mileagePerYear = draft.mileagePerYear ?? null;
  const downPayment = draft.downPayment ?? 0;

  if (preview.isCash) {
    const chips = ['Barangebot'];
    if (preview.discountPercent != null) {
      chips.push(`${preview.discountPercent} % Rabatt`);
    }
    return {
      chips,
      result: formatCashPrice(preview.cashOfferPrice),
      resultSuffix: 'Kaufpreis',
      upe: formatCashPrice(preview.uvpTotal),
    };
  }

  const chips = [];
  if (preview.isLeasing) chips.push('Leasing');
  if (preview.isFinance) chips.push(preview.isThreeWay ? '3-Wege-Finanzierung' : 'Finanzierung');
  if (termMonths) chips.push(`${termMonths} Monate`);
  if (preview.isLeasing && mileagePerYear) {
    chips.push(`${Number(mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
  }
  chips.push(downPayment === 0 ? '0 € Anzahlung' : `${Number(downPayment).toLocaleString('de-DE')} € Anzahlung`);

  const rate = preview.canShowLiveLeasingRate || preview.canShowLiveFinanceRate
    ? preview.monthlyRate
    : null;

  return {
    chips,
    result: formatRate(rate),
    resultSuffix: rate != null ? '/Monat' : null,
    finalPayment: preview.finalPayment != null
      ? `Schlussrate ${formatCashPrice(preview.finalPayment)}`
      : null,
  };
}
