import { calculatePrice } from '../../logic/priceCalculator.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import {
  buildDisplayPriceFromEngine,
  getAmountFromEnginePricing,
  normalizePaymentMode,
} from '../../logic/vehicleDetailPricing.js';
import { resolveWishConfiguration, compareTrimsForWish } from '../configurator/wishPackageResolver.js';
import { getDealerSeed } from '../../data/dealers/index.js';

const DEFAULT_TERM = 48;
const DEFAULT_MILEAGE = 10000;

function priceEv3Configuration({
  trimId,
  packageIds = [],
  accessoryIds = [],
  dealerConditions,
  termMonths = DEFAULT_TERM,
  mileagePerYear = DEFAULT_MILEAGE,
  paymentType = 'leasing',
}) {
  const mfg = getManufacturerModel('Kia', 'EV3');
  const data = mfg.data;
  const variant = data.variants.find((v) => v.trimId === trimId) ?? data.variants[data.variants.length - 1];
  const discount = dealerConditions.discounts?.standard ?? 12;

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

  const discountAmount = Math.round(configurationPrice * (discount / 100));
  const housePrice = configurationPrice - discountAmount;
  const preparationFee = dealerConditions.preparationFee ?? 0;
  const cashPrice = housePrice + preparationFee;

  const baseRate = variant.baseLeasingRate ?? 329;
  const leasingRate = Math.round(baseRate + rateDelta);

  const lf = dealerConditions.leasingFactors?.[termMonths]?.[mileagePerYear]
    ?? dealerConditions.leasingFactors?.[48]?.[10000]
    ?? 0.64;

  const adjustedLeasing = Math.round(leasingRate * (lf / 0.64));
  const financeRate = Math.round(adjustedLeasing * 1.08);

  let primaryRate = adjustedLeasing;
  if (paymentType === 'finance') primaryRate = financeRate;
  if (paymentType === 'cash') primaryRate = cashPrice;

  return {
    configurationPrice,
    discountPercent: discount,
    discountAmount,
    housePrice,
    cashPrice,
    leasingRate: adjustedLeasing,
    financeRate,
    primaryRate,
    paymentType,
    deliveryTime: dealerConditions.deliveryTime ?? '4–6 Wochen',
    selectedPackages,
    selectedAccessories,
    selectedVariant: variant,
    breakdown: {
      baseRate,
      rateDelta,
      packages: selectedPackages.map((p) => ({
        id: p.id,
        name: p.name,
        priceGross: p.priceGross,
        rateDelta: p.rateDelta,
      })),
    },
    warnings: [],
  };
}

/**
 * Zentrale Preisengine – Herstellerdaten + Händlerkonditionen
 */
export function priceConfiguration({
  brand,
  model,
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
}) {
  const mfg = getManufacturerModel(brand, model);
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
  if (mfg.engine === 'sportage') {
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
    });
  } else if (mfg.engine === 'ev3') {
    pricing = priceEv3Configuration({
      trimId: trimId ?? mfg.defaultTrimId,
      packageIds: resolvedPackages,
      accessoryIds: resolvedAccessories,
      dealerConditions,
      termMonths,
      mileagePerYear,
      paymentType,
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
