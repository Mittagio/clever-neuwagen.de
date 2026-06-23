import { calculatePrice } from '../../logic/priceCalculator.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import {
  resolveConfigureModel,
  resolveConfigureModelKey,
} from '../configuration/configureModelBridge.js';
import {
  buildDisplayPriceFromEngine,
  getAmountFromEnginePricing,
  normalizePaymentMode,
} from '../../logic/vehicleDetailPricing.js';
import { resolveWishConfiguration, compareTrimsForWish } from '../configurator/wishPackageResolver.js';
import { getDealerSeed } from '../../data/dealers/index.js';
import { applyDealerModelPricing, mergeDealerPricingIntoResult } from '../dealer/dealerModelPricing.js';

const DEFAULT_TERM = 48;
const DEFAULT_MILEAGE = 10000;

function priceRegistryEvConfiguration({
  mfg,
  trimId,
  engineId,
  packageIds = [],
  accessoryIds = [],
  dealerConditions,
  termMonths = DEFAULT_TERM,
  mileagePerYear = DEFAULT_MILEAGE,
  paymentType = 'leasing',
  customerGroup = 'standard',
  customDiscountPercent = null,
}) {
  const data = mfg.data;
  const variant = data.variants.find((v) =>
    v.trimId === trimId && (!engineId || v.engineId === engineId),
  ) ?? data.variants.find((v) => v.trimId === trimId)
    ?? data.variants[data.variants.length - 1];

  let configurationPrice = variant.priceGross;
  let rateDelta = 0;
  const selectedPackages = [];
  const selectedAccessories = [];

  for (const pkgId of packageIds) {
    const pkg = data.packages.find((p) => p.id === pkgId);
    if (pkg) {
      configurationPrice += pkg.priceGross ?? 0;
      rateDelta += pkg.rateDelta ?? 0;
      selectedPackages.push(pkg);
    }
  }

  for (const accId of accessoryIds) {
    const acc = data.accessories.find((a) => a.id === accId);
    if (acc) {
      configurationPrice += acc.priceGross ?? 0;
      rateDelta += acc.rateDelta ?? 0;
      selectedAccessories.push(acc);
    }
  }

  const baseRate = variant.baseLeasingRate ?? 329;
  const leasingRateBefore = Math.round(baseRate + rateDelta);

  const lf = dealerConditions.leasingFactors?.[termMonths]?.[mileagePerYear]
    ?? dealerConditions.leasingFactors?.[48]?.[10000]
    ?? 0.64;

  const adjustedLeasingBefore = Math.round(leasingRateBefore * (lf / 0.64));
  const financeRateBefore = Math.round(adjustedLeasingBefore * 1.08);

  const dealerPricing = applyDealerModelPricing({
    conditions: dealerConditions,
    modelId: mfg.key,
    paymentType,
    customerGroup,
    customDiscountPercent,
    configurationPrice,
    baseLeasingRate: adjustedLeasingBefore,
    financeRate: financeRateBefore,
    termMonths,
    mileagePerYear,
  });

  const adjustedLeasing = dealerPricing.leasingRate ?? adjustedLeasingBefore;
  const financeRate = dealerPricing.financeRate ?? financeRateBefore;

  let primaryRate = adjustedLeasing;
  if (paymentType === 'finance') primaryRate = financeRate;
  if (paymentType === 'cash') primaryRate = dealerPricing.cashPrice;

  return mergeDealerPricingIntoResult({
    configurationPrice,
    discountPercent: dealerPricing.discountPercent,
    discountAmount: dealerPricing.discountAmount,
    housePrice: dealerPricing.housePrice,
    cashPrice: dealerPricing.cashPrice,
    leasingRate: adjustedLeasing,
    financeRate,
    primaryRate,
    paymentType,
    deliveryTime: dealerConditions.deliveryTime ?? '4–6 Wochen',
    selectedPackages,
    selectedAccessories,
    selectedVariant: variant,
    breakdown: {
      baseRate: variant.baseLeasingRate ?? 329,
      rateDelta,
      packages: selectedPackages.map((p) => ({
        id: p.id,
        name: p.name,
        priceGross: p.priceGross,
        rateDelta: p.rateDelta,
      })),
    },
    warnings: [],
  }, dealerPricing);
}

/**
 * Zentrale Preisengine – Herstellerdaten + Händlerkonditionen
 */
export function priceConfiguration({
  brand,
  model,
  modelKey,
  trimId,
  engineId,
  packageIds = [],
  accessoryIds = [],
  wishFeatureIds = [],
  dealerId,
  dealerConditions: conditionsArg,
  termMonths = DEFAULT_TERM,
  mileagePerYear = DEFAULT_MILEAGE,
  paymentType = 'leasing',
  colorId,
  customerGroup = 'standard',
  customDiscountPercent = null,
}) {
  const key = modelKey ?? resolveConfigureModelKey(brand, model);
  const mfg = key ? resolveConfigureModel(key) : getManufacturerModel(brand, model);
  if (!mfg) return null;

  const dealerConditions = conditionsArg ?? getDealerSeed(dealerId);

  let resolvedPackages = packageIds;
  let resolvedAccessories = accessoryIds;
  let wishResolution = null;

  if (wishFeatureIds.length) {
    wishResolution = resolveWishConfiguration({
      brand,
      model,
      trimId: trimId ?? mfg.defaultTrimId,
      wishFeatureIds,
      engineId: engineId ?? mfg.defaultEngineId,
    });
    if (wishResolution) {
      resolvedPackages = wishResolution.packageIds;
      resolvedAccessories = wishResolution.accessoryIds;
      trimId = wishResolution.trimId;
      engineId = wishResolution.engineId;
    }
  }

  let pricing;
  if (mfg.engine === 'sportage' && !mfg._fallback) {
    pricing = calculatePrice({
      model: mfg.model,
      trimId: trimId ?? mfg.defaultTrimId,
      engineId: engineId ?? mfg.defaultEngineId,
      selectedPackageIds: resolvedPackages,
      selectedAccessoryIds: resolvedAccessories,
      termMonths,
      mileagePerYear,
      paymentType,
      colorId,
      dealerConditions,
      customerGroup,
      customDiscountPercent,
    });
  } else if (mfg.data?.variants?.length) {
    pricing = priceRegistryEvConfiguration({
      mfg,
      trimId: trimId ?? mfg.defaultTrimId,
      engineId: engineId ?? mfg.defaultEngineId,
      packageIds: resolvedPackages,
      accessoryIds: resolvedAccessories,
      dealerConditions,
      termMonths,
      mileagePerYear,
      paymentType,
      customerGroup,
      customDiscountPercent,
    });
  }

  if (!pricing) return null;

  return {
    ...pricing,
    brand: mfg.brand,
    model: mfg.model,
    modelKey: mfg.key,
    trimId: trimId ?? mfg.defaultTrimId,
    engineId: engineId ?? mfg.defaultEngineId,
    dealerId,
    wishResolution,
    requiredForWish: wishResolution
      ? {
          trimName: wishResolution.trimName,
          packages: wishResolution.requiredPackages,
          accessories: wishResolution.requiredAccessories,
        }
      : null,
  };
}

export function priceAllTrimsForWish({
  brand,
  model,
  wishFeatureIds = [],
  dealerId,
  dealerConditions,
  paymentType = 'leasing',
  termMonths = DEFAULT_TERM,
  mileagePerYear = DEFAULT_MILEAGE,
}) {
  const compared = compareTrimsForWish({ brand, model, wishFeatureIds });
  const conditions = dealerConditions ?? getDealerSeed(dealerId);

  return compared.map((trimConfig, index) => {
    const pricing = priceConfiguration({
      brand,
      model,
      trimId: trimConfig.trimId,
      packageIds: trimConfig.packageIds,
      accessoryIds: trimConfig.accessoryIds,
      dealerConditions: conditions,
      paymentType,
      termMonths,
      mileagePerYear,
    });

    const mode = normalizePaymentMode(paymentType);
    const displayAmount = getAmountFromEnginePricing(pricing, mode);
    const { priceLabel: displayPriceLabel } = buildDisplayPriceFromEngine(pricing, mode);

    return {
      trimId: trimConfig.trimId,
      trimName: trimConfig.trimName,
      wishesMatched: trimConfig.wishesMatched,
      wishesTotal: trimConfig.wishesTotal,
      missingFeatures: trimConfig.missingFeatures,
      requiredPackages: trimConfig.requiredPackages,
      monthlyRate: pricing?.leasingRate ?? pricing?.primaryRate ?? null,
      cashPrice: pricing?.cashPrice ?? null,
      displayAmount,
      displayPriceLabel,
      isRecommended: index === 0 && trimConfig.wishesMatched > 0,
      pricing,
    };
  });
}

export function getPackageRateDelta(brand, model, packageId) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg) return 0;
  const pkg = mfg.data.packages?.find((p) => p.id === packageId);
  return pkg?.rateDelta ?? 0;
}
