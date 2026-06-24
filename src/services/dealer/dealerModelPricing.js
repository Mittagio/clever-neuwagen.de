/**
 * Händler-Modellpreise – Rabatte, Aktionen, Überführung in Berechnung & Anzeige
 */
import { resolveDiscountsForModel } from '../../data/dealerConditionsSchema.js';
import {
  buildCustomerModelBadgePresentation,
  clampDiscount,
  formatPreparationFeeSuffix,
  getActivePromotions,
  resolveModelSettings,
  resolvePreparationFeeAmount,
} from './dealerVehicleManagement.js';
import {
  filterCombinablePromotions,
  mapCustomerGroupToTargetGroup,
  promotionAppliesToModel,
} from './dealerPromotionEngine.js';
import { resolveTrimSettings } from './dealerTrimConditions.js';

export function resolvePaymentDiscountPercent(
  conditions = {},
  modelId = '',
  paymentType = 'leasing',
  customerGroup = 'standard',
  customDiscountPercent = null,
  trimId = null,
) {
  if (customerGroup === 'custom' && customDiscountPercent != null) {
    return clampDiscount(customDiscountPercent);
  }

  const settings = resolveModelSettings(conditions, modelId);
  const trimSettings = trimId ? resolveTrimSettings(settings, trimId) : settings;
  const paymentKey = paymentType === 'cash'
    ? 'cash'
    : (paymentType === 'finance' || paymentType === 'financing' ? 'financing' : 'leasing');

  if (trimSettings.paymentDiscounts?.[paymentKey] != null) {
    return clampDiscount(
      trimSettings.paymentDiscounts[paymentKey],
      settings.discountMin ?? 0,
      settings.discountMax ?? 50,
    );
  }

  const { resolved } = resolveDiscountsForModel(conditions.discountsByModel, modelId);
  const legacyKey = customerGroup && resolved[customerGroup] != null ? customerGroup : 'standard';
  return clampDiscount(
    resolved[legacyKey] ?? resolved.standard ?? 0,
    settings.discountMin ?? 0,
    settings.discountMax ?? 50,
  );
}

export function resolveApplicablePromotions(
  conditions = {},
  modelId = '',
  customerGroup = 'standard',
  now = new Date(),
) {
  const settings = resolveModelSettings(conditions, modelId);
  const model = conditions.activeModels?.find((m) => m.id === modelId) ?? { id: modelId };
  const target = mapCustomerGroupToTargetGroup(customerGroup);
  const matched = getActivePromotions(settings, now).filter((promo) => (
    promotionAppliesToModel(promo, model)
    && (promo.targetGroup === 'all' || promo.targetGroup === 'privat' || promo.targetGroup === target)
  ));
  return filterCombinablePromotions(matched);
}

function sumPromotionExtras(promotions = []) {
  let extraDiscountPercent = 0;
  let bonusAmount = 0;
  for (const promo of promotions) {
    if (promo.extraDiscountPercent > 0) {
      extraDiscountPercent += Number(promo.extraDiscountPercent);
    }
    if (promo.bonusAmount > 0) {
      bonusAmount += Number(promo.bonusAmount);
    }
  }
  return { extraDiscountPercent, bonusAmount };
}

function calcLeasingRateFromHousePrice(housePrice, leasingFactor, downPayment, termMonths) {
  if (leasingFactor == null || !termMonths) return null;
  const base = housePrice * (leasingFactor / 100);
  const downPaymentShare = downPayment / termMonths;
  return Math.max(0, Math.round(base - downPaymentShare));
}

function scaleRateByHousePrice(baseRate, configurationPrice, housePrice) {
  if (!baseRate || !configurationPrice) return baseRate;
  const ratio = housePrice / configurationPrice;
  return Math.max(0, Math.round(baseRate * ratio));
}

/**
 * Wendet Händler-Fahrzeugverwaltung auf Basispreise an.
 */
export function applyDealerModelPricing({
  conditions = {},
  modelId = 'sportage',
  trimId = null,
  paymentType = 'leasing',
  customerGroup = 'standard',
  customDiscountPercent = null,
  configurationPrice = 0,
  leasingFactor = null,
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  baseLeasingRate = null,
  financeRate = null,
  now = new Date(),
} = {}) {
  const settings = resolveModelSettings(conditions, modelId);
  const trimSettings = trimId ? resolveTrimSettings(settings, trimId) : settings;
  const prepSettings = settings.preparationFee ?? {};
  const preparationFee = resolvePreparationFeeAmount(conditions, modelId);

  const baseDiscountPercent = resolvePaymentDiscountPercent(
    conditions,
    modelId,
    paymentType,
    customerGroup,
    customDiscountPercent,
    trimId,
  );
  const applicablePromotions = resolveApplicablePromotions(
    conditions,
    modelId,
    customerGroup,
    now,
  );
  const { extraDiscountPercent, bonusAmount } = sumPromotionExtras(applicablePromotions);

  const totalDiscountPercent = clampDiscount(
    baseDiscountPercent + extraDiscountPercent,
    settings.discountMin ?? 0,
    settings.discountMax ?? 50,
  );

  const discountAmount = Math.round(configurationPrice * (totalDiscountPercent / 100));
  const promoBonusAmount = Math.round(bonusAmount);
  const housePrice = Math.max(0, configurationPrice - discountAmount - promoBonusAmount
    - (trimSettings.bonusAmount > 0 ? Number(trimSettings.bonusAmount) : 0));

  let leasingRate = null;
  if (paymentType === 'leasing' || paymentType == null) {
    if (leasingFactor != null) {
      leasingRate = calcLeasingRateFromHousePrice(
        housePrice,
        leasingFactor,
        downPayment,
        termMonths,
      );
    } else if (baseLeasingRate != null) {
      leasingRate = scaleRateByHousePrice(baseLeasingRate, configurationPrice, housePrice);
    }
  }

  let resolvedFinanceRate = financeRate;
  if (financeRate != null && configurationPrice > 0) {
    resolvedFinanceRate = scaleRateByHousePrice(financeRate, configurationPrice, housePrice);
  }

  const prepMode = prepSettings.cashDisplayMode ?? 'separate';
  const preparationFeeSeparate = paymentType === 'leasing'
    || paymentType === 'financing'
    || paymentType === 'finance'
    || prepMode === 'separate';

  let cashPrice = housePrice;
  if (paymentType === 'cash' && prepMode === 'included') {
    cashPrice = housePrice + preparationFee;
  } else if (paymentType === 'cash' && prepMode === 'separate') {
    cashPrice = housePrice;
  }

  const preparationFeeLine = formatPreparationFeeSuffix(conditions, modelId, paymentType);
  const badgePresentation = buildCustomerModelBadgePresentation(conditions, modelId, { trimId });
  const badges = badgePresentation.badges;

  return {
    modelId,
    trimId,
    baseDiscountPercent,
    extraDiscountPercent,
    discountPercent: totalDiscountPercent,
    discountAmount,
    promoBonusAmount,
    housePrice,
    preparationFee,
    preparationFeeSeparate,
    preparationFeeIncluded: paymentType === 'cash' && prepMode === 'included',
    preparationFeeLine,
    cashPrice,
    leasingRate,
    financeRate: resolvedFinanceRate,
    appliedPromotions: applicablePromotions,
    badges,
    badgePresentation,
    priceFootnotes: buildPriceFootnotes({
      paymentType,
      discountPercent: totalDiscountPercent,
      extraDiscountPercent,
      promoBonusAmount,
      preparationFeeLine,
      preparationFeeSeparate,
      appliedPromotions: applicablePromotions,
    }),
    displayRate: paymentType === 'cash'
      ? cashPrice
      : (paymentType === 'finance' || paymentType === 'financing'
        ? resolvedFinanceRate
        : leasingRate),
  };
}

export function buildPriceFootnotes({
  paymentType = 'leasing',
  discountPercent = 0,
  extraDiscountPercent = 0,
  promoBonusAmount = 0,
  preparationFeeLine = null,
  preparationFeeSeparate = true,
  appliedPromotions = [],
} = {}) {
  const lines = [];

  if (discountPercent > 0) {
    let line = `Inkl. ${discountPercent} % Händlerrabatt`;
    if (extraDiscountPercent > 0) {
      line += ` (davon ${extraDiscountPercent} % Aktion)`;
    }
    lines.push(`${line} auf den Fahrzeugpreis.`);
  }

  if (promoBonusAmount > 0) {
    const promo = appliedPromotions.find((p) => p.bonusAmount > 0);
    const label = promo?.badgeText?.trim() || 'Aktionsbonus';
    lines.push(`${label}: ${promoBonusAmount.toLocaleString('de-DE')} € Preisvorteil berücksichtigt.`);
  }

  if (preparationFeeLine && preparationFeeSeparate && paymentType !== 'cash') {
    lines.push(`${preparationFeeLine}.`);
  } else if (preparationFeeLine && paymentType === 'cash' && preparationFeeSeparate) {
    lines.push(`${preparationFeeLine}.`);
  } else if (preparationFeeLine && paymentType === 'cash' && !preparationFeeSeparate) {
    lines.push(`${preparationFeeLine}.`);
  }

  lines.push('Unverbindliche Darstellung. Abweichungen durch Ausstattung, Zinsen und Bonität möglich.');

  return lines;
}

/**
 * Kundenansicht: Rate/Preis + Fußnoten + Badges
 */
export function buildCustomerPricePresentation(
  conditions = {},
  modelId = '',
  pricing = {},
  paymentType = 'leasing',
) {
  const applied = pricing.dealerModelPricing ?? applyDealerModelPricing({
    conditions,
    modelId,
    paymentType,
    configurationPrice: pricing.configurationPrice ?? 0,
    leasingFactor: pricing.leasing?.factor,
    termMonths: pricing.leasing?.termMonths ?? 48,
    downPayment: pricing.leasing?.downPayment ?? 0,
    baseLeasingRate: pricing.leasingRate,
    financeRate: pricing.financeRate,
  });

  const mode = paymentType === 'financing' ? 'finance' : paymentType;
  const isCash = mode === 'cash';
  const amount = isCash
    ? applied.cashPrice
    : (mode === 'finance' ? applied.financeRate : applied.leasingRate);

  const primaryLabel = isCash
    ? `${(amount ?? 0).toLocaleString('de-DE')} €`
    : `ab ${(amount ?? 0).toLocaleString('de-DE')} €/Monat`;

  return {
    amount,
    primaryLabel,
    preparationFeeLine: applied.preparationFeeLine,
    preparationFeeSeparate: applied.preparationFeeSeparate,
    badges: applied.badges,
    footnotes: applied.priceFootnotes,
    dealerModelPricing: applied,
  };
}

export function mergeDealerPricingIntoResult(result, dealerPricing) {
  if (!dealerPricing) return result;
  return {
    ...result,
    discountPercent: dealerPricing.discountPercent,
    discountAmount: dealerPricing.discountAmount,
    housePrice: dealerPricing.housePrice,
    hauspreis: dealerPricing.housePrice,
    preparationFee: dealerPricing.preparationFee,
    preparationFeeLine: dealerPricing.preparationFeeLine,
    preparationFeeSeparate: dealerPricing.preparationFeeSeparate,
    preparationFeeIncluded: dealerPricing.preparationFeeIncluded,
    cashPrice: dealerPricing.cashPrice,
    leasingRate: dealerPricing.leasingRate ?? result.leasingRate,
    financeRate: dealerPricing.financeRate ?? result.financeRate,
    primaryRate: dealerPricing.displayRate ?? result.primaryRate,
    appliedPromotions: dealerPricing.appliedPromotions,
    customerBadges: dealerPricing.badges,
    badgePresentation: dealerPricing.badgePresentation,
    priceFootnotes: dealerPricing.priceFootnotes,
    dealerModelPricing: dealerPricing,
    promoBonusAmount: dealerPricing.promoBonusAmount,
    extraDiscountPercent: dealerPricing.extraDiscountPercent,
  };
}
