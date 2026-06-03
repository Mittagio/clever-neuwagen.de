import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getDetailWishChips, WISH_UNAVAILABLE_ALTERNATIVES } from '../../data/features/wishDetailChips.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import { customerFeatureFromManufacturerId } from '../../data/manufacturer/featureBridge.js';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { priceConfiguration, priceAllTrimsForWish } from '../pricing/pricingEngine.js';
import { resolveWishConfiguration } from './wishPackageResolver.js';

/** Chip-/Tag-Darstellung: wish | standard | bonus | unavailable | idle */
export function mapWishToChipVariant(analysis) {
  if (!analysis) return 'idle';
  if (analysis.status === 'standard' || analysis.status === 'standard_other_trim') return 'standard';
  if (analysis.status === 'missing') return 'unavailable';
  if (analysis.status === 'package' || analysis.status === 'accessory' || analysis.status === 'package_other_trim') {
    return 'wish';
  }
  return 'idle';
}

export function mapWishToBadge(analysis) {
  if (!analysis) return null;
  if (analysis.status === 'standard' || analysis.status === 'standard_other_trim') return 'Serienmäßig';
  if (analysis.status === 'package' || analysis.status === 'accessory' || analysis.status === 'package_other_trim') {
    return 'Ihr Wunsch';
  }
  if (analysis.status === 'missing') return 'Nicht verfügbar';
  return null;
}

export function trimIdFromVehicle(vehicle) {
  const hay = `${vehicle?.trim ?? ''} ${vehicle?.model ?? ''} ${vehicle?.slug ?? ''}`.toLowerCase();
  if (hay.includes('earth')) return 'earth';
  if (hay.includes('air')) return 'air';
  if (hay.includes('gt-line') || hay.includes('gt line') || hay.includes('gtline')) return 'gt-line';
  return null;
}

function getPackageMeta(brand, model, packageId) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg || !packageId) return null;
  const pkg = mfg.data.packages?.find((p) => p.id === packageId);
  if (!pkg) return null;
  return {
    ...pkg,
    featureLabels: getPackageFeatureLabels(brand, model, packageId),
    trimNames: (pkg.availableTrims ?? [])
      .map((tid) => mfg.data.trims?.find((t) => t.id === tid)?.name ?? tid)
      .filter(Boolean),
  };
}

function findFulfillmentOnOtherTrims({ brand, model, trimId, wishId, paymentType, termMonths, mileagePerYear }) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg) return null;

  let best = null;
  for (const trim of mfg.data.trims ?? []) {
    const alt = resolveWishConfiguration({
      brand,
      model,
      trimId: trim.id,
      wishFeatureIds: [wishId],
    });
    if (!alt?.matchedFeatures.includes(wishId)) continue;

    const pricing = priceConfiguration({
      brand,
      model,
      trimId: trim.id,
      wishFeatureIds: [wishId],
      paymentType,
      termMonths,
      mileagePerYear,
    });
    const rate = pricing?.leasingRate ?? pricing?.primaryRate ?? null;

    if (!alt.requiredPackages.length && !alt.requiredAccessories.length) {
      return {
        kind: 'standard',
        trimId: trim.id,
        trimName: trim.name,
        resolution: alt,
        rate,
      };
    }

    const pkg = alt.requiredPackages[0];
    const acc = alt.requiredAccessories[0];
    const candidate = {
      kind: pkg ? 'package' : 'accessory',
      trimId: trim.id,
      trimName: trim.name,
      packageId: pkg?.id,
      packageName: pkg?.name,
      accessoryId: acc?.id,
      accessoryName: acc?.name,
      resolution: alt,
      rate,
    };
    if (!best || (rate != null && (best.rate == null || rate < best.rate))) {
      best = candidate;
    }
  }

  if (best && best.trimId !== trimId) return best;
  return null;
}

export function analyzeSingleWish({
  brand,
  model,
  trimId,
  wishId,
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
}) {
  const resolution = resolveWishConfiguration({
    brand,
    model,
    trimId,
    wishFeatureIds: [wishId],
  });
  if (!resolution) return { wishId, status: 'missing', label: getFeatureLabel(wishId) };

  if (resolution.matchedFeatures.includes(wishId) && !resolution.requiredPackages.length && !resolution.requiredAccessories.length) {
    return {
      wishId,
      status: 'standard',
      label: getFeatureLabel(wishId),
      resolution,
    };
  }

  if (!resolution.missingFeatures.includes(wishId)) {
    const pkg = resolution.requiredPackages[0];
    const acc = resolution.requiredAccessories[0];
    const packageMeta = getPackageMeta(brand, model, pkg?.id);
    const pricing = priceConfiguration({
      brand,
      model,
      trimId,
      wishFeatureIds: [wishId],
      paymentType,
      termMonths,
      mileagePerYear,
    });
    const rate = pricing?.leasingRate ?? pricing?.primaryRate;
    return {
      wishId,
      status: pkg ? 'package' : 'accessory',
      label: getFeatureLabel(wishId),
      packageId: pkg?.id,
      packageName: pkg?.name,
      packageDescription: packageMeta?.description,
      featureLabels: packageMeta?.featureLabels ?? [],
      accessoryId: acc?.id,
      accessoryName: acc?.name,
      newRateLabel: rate != null ? `${formatCurrency(rate)}/Monat` : null,
      resolution,
    };
  }

  const otherTrim = findFulfillmentOnOtherTrims({
    brand,
    model,
    trimId,
    wishId,
    paymentType,
    termMonths,
    mileagePerYear,
  });

  if (otherTrim?.kind === 'package' || otherTrim?.kind === 'accessory') {
    const packageMeta = getPackageMeta(brand, model, otherTrim.packageId);
    return {
      wishId,
      status: 'package_other_trim',
      label: getFeatureLabel(wishId),
      packageId: otherTrim.packageId,
      packageName: otherTrim.packageName ?? packageMeta?.name,
      packageDescription: packageMeta?.description,
      featureLabels: packageMeta?.featureLabels ?? [],
      accessoryName: otherTrim.accessoryName,
      suggestedTrimId: otherTrim.trimId,
      suggestedTrimName: otherTrim.trimName,
      availableTrimLabel: packageMeta?.trimNames?.join(', ') ?? otherTrim.trimName,
      newRateLabel: otherTrim.rate != null ? `${formatCurrency(otherTrim.rate)}/Monat` : null,
      resolution: otherTrim.resolution,
    };
  }

  if (otherTrim?.kind === 'standard') {
    return {
      wishId,
      status: 'standard_other_trim',
      label: getFeatureLabel(wishId),
      suggestedTrimId: otherTrim.trimId,
      suggestedTrimName: otherTrim.trimName,
      newRateLabel: otherTrim.rate != null ? `${formatCurrency(otherTrim.rate)}/Monat` : null,
      resolution: otherTrim.resolution,
    };
  }

  return {
    wishId,
    status: 'missing',
    label: getFeatureLabel(wishId),
    alternatives: WISH_UNAVAILABLE_ALTERNATIVES[wishId] ?? [],
    resolution,
  };
}

export function buildPackageInsight(brand, model, packageId, wishFeatureIds = []) {
  const meta = getPackageMeta(brand, model, packageId);
  if (!meta) return null;
  const mfg = getManufacturerModel(brand, model);
  const equipment = mfg?.data?.equipment ?? [];
  const pkg = mfg?.data?.packages?.find((p) => p.id === packageId);

  const items = (pkg?.features ?? []).map((eqId) => {
    const eq = equipment.find((e) => e.id === eqId);
    const customerId = customerFeatureFromManufacturerId(eqId);
    const label = customerId ? getFeatureLabel(customerId) : (eq?.name ?? eqId);
    const isWish = customerId ? wishFeatureIds.includes(customerId) : false;
    return {
      equipmentId: eqId,
      customerFeatureId: customerId,
      label,
      role: isWish ? 'wish' : 'bonus',
      badge: isWish ? 'Ihr Wunsch' : 'zusätzlich',
      variant: isWish ? 'wish' : 'bonus',
    };
  });

  return {
    packageId,
    packageName: meta.name,
    description: meta.description,
    featureLabels: meta.featureLabels,
    items,
    wishItems: items.filter((i) => i.role === 'wish'),
    bonusItems: items.filter((i) => i.role === 'bonus'),
  };
}

export function buildWishInsight({
  brand,
  model,
  trimId,
  wishFeatureIds = [],
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  dealerConditions,
}) {
  const recommendation = buildWishRecommendation({
    brand,
    model,
    trimId,
    wishFeatureIds,
    paymentType,
    termMonths,
    mileagePerYear,
    dealerConditions,
  });

  const wishStatuses = wishFeatureIds.map((id) => {
    const analysis = analyzeSingleWish({
      brand,
      model,
      trimId,
      wishId: id,
      paymentType,
      termMonths,
      mileagePerYear,
    });
    return {
      id,
      label: getFeatureLabel(id),
      analysis,
      variant: mapWishToChipVariant(analysis),
      badge: mapWishToBadge(analysis),
    };
  });

  const packageInsights = (recommendation.resolution?.requiredPackages ?? [])
    .map((p) => buildPackageInsight(brand, model, p.id, wishFeatureIds))
    .filter(Boolean);

  const accessoryInsights = (recommendation.resolution?.requiredAccessories ?? []).map((a) => ({
    accessoryId: a.id,
    accessoryName: a.name,
    items: [{ label: a.name, role: 'wish', badge: 'Ihr Wunsch', variant: 'wish' }],
  }));

  const bonusItems = packageInsights.flatMap((p) => p.bonusItems);
  const serialWishes = wishStatuses.filter((w) => w.variant === 'standard');

  let betterTrimInsight = null;
  if (recommendation.betterTrim) {
    const altId = recommendation.betterTrim.trimId;
    const altWishStatuses = wishFeatureIds.map((id) => {
      const analysis = analyzeSingleWish({
        brand,
        model,
        trimId: altId,
        wishId: id,
        paymentType,
        termMonths,
        mileagePerYear,
      });
      return {
        id,
        label: getFeatureLabel(id),
        variant: mapWishToChipVariant(analysis),
        badge: mapWishToBadge(analysis),
        analysis,
      };
    });
    const altResolution = resolveWishConfiguration({
      brand,
      model,
      trimId: altId,
      wishFeatureIds,
    });
    const altPackages = (altResolution?.requiredPackages ?? [])
      .map((p) => buildPackageInsight(brand, model, p.id, wishFeatureIds))
      .filter(Boolean);

    betterTrimInsight = {
      ...recommendation.betterTrim,
      serialOnTrim: altWishStatuses.filter((w) => w.variant === 'standard'),
      stillNeedsPackage: altWishStatuses.filter((w) => w.variant === 'wish'),
      packages: altPackages,
    };
  }

  const inquiryMeta = {
    wishedLabels: wishStatuses.map((w) => w.label),
    packageLabels: packageInsights.map((p) => p.packageName),
    serialLabels: serialWishes.map((w) => w.label),
    bonusLabels: [...new Set(bonusItems.map((b) => b.label))],
  };

  return {
    ...recommendation,
    wishStatuses,
    packageInsights,
    accessoryInsights,
    betterTrimInsight,
    inquiryMeta,
  };
}

export function getPackageFeatureLabels(brand, model, packageId) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg) return [];
  const pkg = mfg.data.packages?.find((p) => p.id === packageId);
  if (!pkg?.features?.length) return [];
  const equipment = mfg.data.equipment ?? [];
  return pkg.features
    .map((fid) => equipment.find((e) => e.id === fid)?.name)
    .filter(Boolean);
}

/**
 * Vollständige Empfehlung für aktuelle Wunschliste + Trim
 */
export function buildWishRecommendation({
  brand,
  model,
  trimId,
  wishFeatureIds = [],
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  dealerConditions,
}) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg || !wishFeatureIds.length) {
    return {
      wishFeatureIds,
      resolution: null,
      pricing: null,
      newRateLabel: null,
      wishItems: [],
      packages: [],
      betterTrim: null,
      unavailable: [],
    };
  }

  const resolution = resolveWishConfiguration({
    brand,
    model,
    trimId,
    wishFeatureIds,
  });

  const pricing = priceConfiguration({
    brand,
    model,
    trimId,
    wishFeatureIds,
    dealerConditions,
    paymentType,
    termMonths,
    mileagePerYear,
  });

  const rate = pricing?.leasingRate ?? pricing?.primaryRate ?? null;
  const newRateLabel = rate != null ? `${formatCurrency(rate)}/Monat` : null;

  const wishItems = wishFeatureIds.map((id) => {
    const single = analyzeSingleWish({
      brand,
      model,
      trimId,
      wishId: id,
      paymentType,
      termMonths,
      mileagePerYear,
    });
    return { id, label: getFeatureLabel(id), ...single };
  });

  const unavailable = wishItems.filter((w) => w.status === 'missing');

  const packages = (resolution?.requiredPackages ?? []).map((p) => ({
    ...p,
    featureLabels: getPackageFeatureLabels(brand, model, p.id),
  }));

  const betterTrim = findBetterTrimAlternative({
    brand,
    model,
    currentTrimId: trimId,
    wishFeatureIds,
    paymentType,
    termMonths,
    mileagePerYear,
    dealerConditions,
    currentRate: rate,
  });

  return {
    wishFeatureIds,
    resolution,
    pricing,
    newRateLabel,
    wishItems,
    packages,
    accessories: resolution?.requiredAccessories ?? [],
    betterTrim,
    unavailable,
  };
}

export function findBetterTrimAlternative({
  brand,
  model,
  currentTrimId,
  wishFeatureIds = [],
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  dealerConditions,
  currentRate,
}) {
  if (!wishFeatureIds.length) return null;

  const compared = priceAllTrimsForWish({
    brand,
    model,
    wishFeatureIds,
    dealerConditions,
    paymentType,
    termMonths,
    mileagePerYear,
  });

  const current = compared.find((t) => t.trimId === currentTrimId);
  const currentMonthly = currentRate ?? current?.monthlyRate;
  if (currentMonthly == null) return null;

  const better = compared
    .filter((t) => t.trimId !== currentTrimId && t.monthlyRate != null && t.missingFeatures.length === 0)
    .sort((a, b) => a.monthlyRate - b.monthlyRate)[0];

  if (!better || better.monthlyRate >= currentMonthly) return null;

  const currentTrim = compared.find((t) => t.trimId === currentTrimId);
  const currentPackages = currentTrim?.requiredPackages?.map((p) => p.name).join(' + ') || 'Basis';

  return {
    trimId: better.trimId,
    trimName: better.trimName,
    monthlyRate: better.monthlyRate,
    monthlyRateLabel: `${formatCurrency(better.monthlyRate)}/Monat`,
    currentTrimName: currentTrim?.trimName ?? currentTrimId,
    currentMonthlyRateLabel: `${formatCurrency(currentMonthly)}/Monat`,
    currentPackagesLabel: currentPackages,
    savingsPerMonth: currentMonthly - better.monthlyRate,
  };
}

export { getDetailWishChips };
