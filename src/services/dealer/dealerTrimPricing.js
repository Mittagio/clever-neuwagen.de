/**
 * Trim-bewusste Kundenpreise – Rabatte, Leasingfaktoren, Raten pro Ausstattung
 */
import { TRIM_FEATURE_MAP } from '../../data/features/trimFeatureMapping.js';
import {
  getKiaPdfPriceFrom,
  getKiaPdfVariants,
} from '../../data/kia/kiaPriceListRegistry.js';
import { getLeasingFactorValue } from './dealerLeasingWizard.js';
import {
  getModelTrimLines,
  resolveModelKeyFromDealerModel,
  resolveTrimSettings,
} from './dealerTrimConditions.js';
import { applyDealerModelPricing } from './dealerModelPricing.js';
import { resolveModelSettings } from './dealerVehicleManagement.js';

const DEFAULT_TERM = 48;
const DEFAULT_KM = 10000;

export function resolveTrimListPrice(modelKey, trimId) {
  const variants = getKiaPdfVariants(modelKey);
  const trimVariants = variants.filter((v) => v.trimId === trimId);
  if (trimVariants.length > 0) {
    return Math.min(...trimVariants.map((v) => v.priceGross));
  }
  return null;
}

export function resolveTrimBaseLeasingRate(modelKey, trimId) {
  return TRIM_FEATURE_MAP[modelKey]?.baseRate?.[trimId] ?? null;
}

export function formatTrimRateLabel(amount, paymentType = 'leasing') {
  if (amount == null) return null;
  const formatted = Math.round(amount).toLocaleString('de-DE');
  if (paymentType === 'cash') return `ab ${formatted} €`;
  return `ab ${formatted} €`;
}

export function buildTrimPriceLine(
  conditions = {},
  model = {},
  trim = {},
  {
    paymentType = 'leasing',
    termMonths = DEFAULT_TERM,
    mileagePerYear = DEFAULT_KM,
    customerGroup = 'standard',
  } = {},
) {
  const modelKey = resolveModelKeyFromDealerModel(model);
  const modelId = model.id ?? modelKey;
  const settings = resolveModelSettings(conditions, modelId);
  const trimSettings = resolveTrimSettings(settings, trim.id);

  const listPrice = resolveTrimListPrice(modelKey, trim.id)
    ?? settings.listPrice
    ?? getKiaPdfPriceFrom(modelKey)
    ?? 0;

  const leasingFactor = getLeasingFactorValue(
    conditions,
    modelId,
    termMonths,
    mileagePerYear,
    trim.id,
  );
  const baseLeasingRate = resolveTrimBaseLeasingRate(modelKey, trim.id);

  const pricing = applyDealerModelPricing({
    conditions,
    modelId,
    trimId: trim.id,
    paymentType,
    customerGroup,
    configurationPrice: listPrice,
    leasingFactor,
    baseLeasingRate,
    termMonths,
    mileagePerYear,
  });

  return {
    trimId: trim.id,
    trimName: trim.name,
    listPrice,
    discountPercent: pricing.discountPercent,
    baseDiscountPercent: pricing.baseDiscountPercent,
    leasingRate: pricing.leasingRate,
    cashPrice: pricing.cashPrice,
    displayRate: pricing.displayRate,
    rateLabel: formatTrimRateLabel(pricing.displayRate, paymentType),
    badges: pricing.badges,
    badgePresentation: pricing.badgePresentation,
    preparationFeeLine: pricing.preparationFeeLine,
    footnotes: pricing.priceFootnotes,
    trimSettings,
  };
}

export function buildModelTrimPricePresentation(
  conditions = {},
  model = {},
  options = {},
) {
  const trims = getModelTrimLines(model);
  const paymentType = options.paymentType ?? 'leasing';

  if (!trims.length) {
    const modelKey = resolveModelKeyFromDealerModel(model);
    const modelId = model.id ?? modelKey;
    const settings = resolveModelSettings(conditions, modelId);
    const listPrice = settings.listPrice ?? getKiaPdfPriceFrom(modelKey) ?? 0;
    const pricing = applyDealerModelPricing({
      conditions,
      modelId,
      paymentType,
      configurationPrice: listPrice,
      leasingFactor: getLeasingFactorValue(conditions, modelId, DEFAULT_TERM, DEFAULT_KM),
      termMonths: DEFAULT_TERM,
      mileagePerYear: DEFAULT_KM,
    });
    const line = {
      trimId: null,
      trimName: 'Standard',
      listPrice,
      discountPercent: pricing.discountPercent,
      displayRate: pricing.displayRate,
      rateLabel: formatTrimRateLabel(pricing.displayRate, paymentType),
      badges: pricing.badges,
      badgePresentation: pricing.badgePresentation,
      preparationFeeLine: pricing.preparationFeeLine,
      footnotes: pricing.priceFootnotes,
    };
    return {
      trimLines: [line],
      lowestLine: line,
      lowestRate: line.displayRate,
      headlineLabel: line.rateLabel,
      hasMultipleTrims: false,
    };
  }

  const trimLines = trims.map((trim) => buildTrimPriceLine(conditions, model, trim, options));
  const pricedLines = trimLines.filter((line) => line.displayRate != null);
  const lowestLine = pricedLines.reduce(
    (best, line) => (!best || line.displayRate < best.displayRate ? line : best),
    null,
  ) ?? trimLines[0];

  return {
    trimLines,
    lowestLine,
    lowestRate: lowestLine?.displayRate ?? null,
    headlineLabel: lowestLine?.rateLabel ?? null,
    hasMultipleTrims: trimLines.length > 1,
  };
}

export function pickPresentationForLanding(presentation = {}) {
  const { lowestLine, trimLines = [], hasMultipleTrims } = presentation;
  return {
    rate: lowestLine?.displayRate ?? null,
    rateLabel: lowestLine?.rateLabel ?? null,
    trimLines: hasMultipleTrims ? trimLines : [],
    badges: lowestLine?.badgePresentation?.badges ?? lowestLine?.badges ?? [],
    overflowLabel: lowestLine?.badgePresentation?.overflowLabel ?? null,
    preparationFeeLine: lowestLine?.preparationFeeLine ?? null,
    footnotes: lowestLine?.footnotes ?? [],
  };
}
