/**
 * Händler-Standardwerte für Angebots-Konfiguration.
 */
import { resolveModelConditions } from '../../data/dealerConditionsSchema.js';
import {
  resolveApplicablePromotions,
  resolvePaymentDiscountPercent,
} from './dealerModelPricing.js';
import { resolvePreparationFeeAmount } from './dealerVehicleManagement.js';
import {
  FINANCING_WIZARD_DOWN_PAYMENTS,
  FINANCING_WIZARD_TERMS,
  getFinanceConditionValue,
} from './dealerFinancingWizard.js';
import { getFinanceResidualValue } from './dealerFinanceResiduals.js';

function normalizePaymentType(paymentType = 'leasing') {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'financing';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

function resolveDefaultLeasingTermKm(modelConditions) {
  const factors = modelConditions?.leasingFactors ?? {};
  const terms = Object.keys(factors).map(Number);
  const termMonths = terms.includes(48) ? 48 : (terms.sort((a, b) => b - a)[0] ?? 48);
  const kms = Object.keys(factors[termMonths] ?? {}).map(Number).sort((a, b) => a - b);
  const mileagePerYear = kms.includes(15000)
    ? 15000
    : (kms.includes(10000) ? 10000 : (kms[0] ?? 15000));
  return { termMonths, mileagePerYear };
}

export function resolveDealerPaymentDefaults(
  conditions = {},
  modelKey = '',
  paymentType = 'leasing',
  trimId = null,
) {
  const mode = normalizePaymentType(paymentType);
  const modelConditions = resolveModelConditions(conditions, modelKey);
  const preparationFee = resolvePreparationFeeAmount(conditions, modelKey);
  const discountPercent = resolvePaymentDiscountPercent(
    conditions,
    modelKey,
    mode,
    'standard',
    null,
    trimId,
  );
  const promotions = resolveApplicablePromotions(conditions, modelKey, 'standard');

  if (mode === 'cash') {
    return {
      paymentType: 'cash',
      preparationFee,
      customerGroup: 'standard',
      customDiscountPercent: null,
      termMonths: null,
      mileagePerYear: null,
      downPayment: 0,
      discountPercent,
      promotions,
    };
  }

  if (mode === 'financing') {
    const termMonths = FINANCING_WIZARD_TERMS.includes(48) ? 48 : FINANCING_WIZARD_TERMS[2];
    const downPayment = FINANCING_WIZARD_DOWN_PAYMENTS[0];
    const finance = getFinanceConditionValue(conditions, modelKey, termMonths, downPayment, trimId);
    const residualPercent = getFinanceResidualValue(conditions, modelKey, termMonths, trimId);
    return {
      paymentType: 'financing',
      termMonths,
      mileagePerYear: null,
      downPayment,
      preparationFee,
      discountPercent,
      financeRate: finance?.effectiveRate ?? null,
      residualPercent,
      promotions,
    };
  }

  const { termMonths, mileagePerYear } = resolveDefaultLeasingTermKm(modelConditions);
  return {
    paymentType: 'leasing',
    termMonths,
    mileagePerYear,
    downPayment: 0,
    preparationFee,
    discountPercent,
    promotions,
  };
}

export function applyDealerDefaultsToDraft(draft, conditions = null) {
  if (!draft?.modelKey || !conditions) return draft;

  const trimId = draft.trimId ?? null;
  const defaults = resolveDealerPaymentDefaults(
    conditions,
    draft.modelKey,
    draft.paymentType ?? 'leasing',
    trimId,
  );

  return {
    ...draft,
    paymentType: draft.paymentType && draft.paymentType !== 'unknown'
      ? draft.paymentType
      : defaults.paymentType,
    termMonths: draft.termMonths ?? defaults.termMonths,
    mileagePerYear: draft.mileagePerYear ?? defaults.mileagePerYear,
    downPayment: draft.downPayment ?? defaults.downPayment ?? 0,
    preparationFee: draft.preparationFee ?? defaults.preparationFee,
    customerGroup: draft.customerGroup ?? 'standard',
  };
}
