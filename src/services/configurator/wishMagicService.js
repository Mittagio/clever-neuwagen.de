import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getDetailWishChips, WISH_UNAVAILABLE_ALTERNATIVES } from '../../data/features/wishDetailChips.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import { customerFeatureFromManufacturerId } from '../../data/manufacturer/featureBridge.js';
import { formatCurrency } from '../../logic/marketplaceService.js';
import {
  computeDetailPricing,
  formatDisplayPrice,
  getAmountFromEnginePricing,
  getPackagePriceImpactLabel,
  getPriceDeltaLabel,
  normalizePaymentMode,
} from '../../logic/vehicleDetailPricing.js';
import { priceConfiguration, priceAllTrimsForWish } from '../pricing/pricingEngine.js';
import { resolveWishConfiguration } from './wishPackageResolver.js';

function toDisplayFromEngine(enginePricing, payment, pricingOptions = {}) {
  if (!enginePricing) return { amount: null, priceLabel: null };
  const display = computeDetailPricing({
    payment: normalizePaymentMode(payment),
    basePricing: enginePricing,
    termMonths: pricingOptions.termMonths,
    mileagePerYear: pricingOptions.mileagePerYear,
    downPayment: pricingOptions.downPayment,
    financeDown: pricingOptions.financeDown,
    financeBalloon: pricingOptions.financeBalloon,
  });
  return { amount: display.amount, priceLabel: display.priceLabel, subtitle: display.subtitle };
}

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
    const { amount, priceLabel } = toDisplayFromEngine(pricing, paymentType, {
      termMonths,
      mileagePerYear,
    });

    if (!alt.requiredPackages.length && !alt.requiredAccessories.length) {
      return {
        kind: 'standard',
        trimId: trim.id,
        trimName: trim.name,
        resolution: alt,
        amount,
        priceLabel,
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
      amount,
      priceLabel,
    };
    if (!best || (amount != null && (best.amount == null || amount < best.amount))) {
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
    const { priceLabel: newRateLabel } = toDisplayFromEngine(pricing, paymentType, {
      termMonths,
      mileagePerYear,
    });
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
      newRateLabel,
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
      newRateLabel: otherTrim.priceLabel ?? null,
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
      newRateLabel: otherTrim.priceLabel ?? null,
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

export function buildPackageInsight(brand, model, packageId, wishFeatureIds = [], payment = 'leasing') {
  const meta = getPackageMeta(brand, model, packageId);
  if (!meta) return null;
  const mfg = getManufacturerModel(brand, model);
  const equipment = mfg?.data?.equipment ?? [];
  const pkg = mfg?.data?.packages?.find((p) => p.id === packageId);
  const priceImpactLabel = getPackagePriceImpactLabel({
    payment,
    rateDelta: pkg?.rateDelta ?? 0,
    priceGross: pkg?.priceGross ?? 0,
    packageName: meta.name,
  });

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
    priceImpactLabel,
    items,
    wishItems: items.filter((i) => i.role === 'wish'),
    bonusItems: items.filter((i) => i.role === 'bonus'),
  };
}

export function buildMagicSummary({
  wishStatuses = [],
  packageInsights = [],
  payment = 'leasing',
  baselineAmount = null,
  newAmount = null,
}) {
  const serial = wishStatuses.filter((w) => w.variant === 'standard');
  const needsPkg = wishStatuses.filter((w) => w.variant === 'wish');
  const parts = [];

  if (serial.length) {
    parts.push(
      `${serial.length} Wunsch${serial.length > 1 ? 'e sind' : ' ist'} bereits serienmäßig enthalten`,
    );
  }

  if (packageInsights.length === 1) {
    const pkg = packageInsights[0];
    const wishLabels = pkg.wishItems?.map((i) => i.label).join(' und ') ?? '';
    parts.push(
      wishLabels
        ? `Für ${wishLabels} empfehlen wir das ${pkg.packageName}`
        : `Wir empfehlen das ${pkg.packageName}`,
    );
  } else if (packageInsights.length > 1) {
    parts.push(`Wir empfehlen ${packageInsights.map((p) => p.packageName).join(' und ')}`);
  }

  const deltaLabel = baselineAmount != null && newAmount != null
    ? getPriceDeltaLabel({
      payment,
      previousAmount: baselineAmount,
      newAmount,
      reason: 'mit Ihren Wünschen',
    })
    : null;

  if (deltaLabel) {
    const mode = normalizePaymentMode(payment);
    if (mode === 'cash') {
      parts.push(`Das erhöht Ihren Kaufpreis um ${deltaLabel.replace(/^\+/, '')}`);
    } else {
      parts.push(`Das erhöht Ihre Rate um ${deltaLabel.replace(/^\+/, '')}`);
    }
  } else if (packageInsights[0]?.priceImpactLabel) {
    parts.push(`Preiswirkung: ${packageInsights[0].priceImpactLabel}`);
  }

  if (!parts.length) return null;
  return parts.join('. ') + '.';
}

export function buildWishInsight({
  brand,
  model,
  trimId,
  wishFeatureIds = [],
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  dealerConditions,
  baselineEnginePricing = null,
}) {
  const payment = normalizePaymentMode(paymentType);
  const pricingOptions = { termMonths, mileagePerYear, downPayment, financeDown, financeBalloon };

  const recommendation = buildWishRecommendation({
    brand,
    model,
    trimId,
    wishFeatureIds,
    paymentType: payment,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
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
    .map((p) => buildPackageInsight(brand, model, p.id, wishFeatureIds, payment))
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
      .map((p) => buildPackageInsight(brand, model, p.id, wishFeatureIds, payment))
      .filter(Boolean);

    betterTrimInsight = {
      ...recommendation.betterTrim,
      serialOnTrim: altWishStatuses.filter((w) => w.variant === 'standard'),
      stillNeedsPackage: altWishStatuses.filter((w) => w.variant === 'wish'),
      packages: altPackages,
    };
  }

  const baselineAmount = baselineEnginePricing
    ? getAmountFromEnginePricing(baselineEnginePricing, payment)
    : null;
  const newAmount = recommendation.pricing
    ? getAmountFromEnginePricing(recommendation.pricing, payment)
    : null;

  const magicSummary = buildMagicSummary({
    wishStatuses,
    packageInsights,
    payment,
    baselineAmount,
    newAmount,
  });

  const inquiryMeta = {
    wishedLabels: wishStatuses.map((w) => w.label),
    packageLabels: packageInsights.map((p) => p.packageName),
    serialLabels: serialWishes.map((w) => w.label),
    bonusLabels: [...new Set(bonusItems.map((b) => b.label))],
  };

  return {
    ...recommendation,
    payment,
    wishStatuses,
    packageInsights,
    accessoryInsights,
    betterTrimInsight,
    inquiryMeta,
    magicSummary,
    baselineAmount,
    newAmount,
    priceDeltaLabel: getPriceDeltaLabel({
      payment,
      previousAmount: baselineAmount,
      newAmount,
    }),
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
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  dealerConditions,
}) {
  const payment = normalizePaymentMode(paymentType);
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
    paymentType: payment,
    termMonths,
    mileagePerYear,
  });

  const { amount, priceLabel: newRateLabel } = toDisplayFromEngine(pricing, payment, {
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
  });

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
    paymentType: payment,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    dealerConditions,
    currentAmount: amount,
  });

  const premiumTrim = findPremiumTrimAlternative({
    brand,
    model,
    currentTrimId: trimId,
    wishFeatureIds,
    paymentType: payment,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    dealerConditions,
    currentAmount: amount,
  });

  return {
    wishFeatureIds,
    resolution,
    pricing,
    newAmount: amount,
    newRateLabel,
    wishItems,
    packages,
    accessories: resolution?.requiredAccessories ?? [],
    betterTrim,
    premiumTrim,
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
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  dealerConditions,
  currentAmount,
}) {
  if (!wishFeatureIds.length) return null;

  const payment = normalizePaymentMode(paymentType);

  const compared = priceAllTrimsForWish({
    brand,
    model,
    wishFeatureIds,
    dealerConditions,
    paymentType: payment,
    termMonths,
    mileagePerYear,
  });

  const current = compared.find((t) => t.trimId === currentTrimId);
  const currentPrice = currentAmount ?? current?.displayAmount;
  if (currentPrice == null) return null;

  const better = compared
    .filter((t) => t.trimId !== currentTrimId && t.displayAmount != null && t.missingFeatures.length === 0)
    .sort((a, b) => a.displayAmount - b.displayAmount)[0];

  if (!better || better.displayAmount >= currentPrice) return null;

  const currentTrim = compared.find((t) => t.trimId === currentTrimId);
  const currentPackages = currentTrim?.requiredPackages?.map((p) => p.name).join(' + ') || 'Basis';
  const savings = currentPrice - better.displayAmount;

  return {
    trimId: better.trimId,
    trimName: better.trimName,
    displayAmount: better.displayAmount,
    displayPriceLabel: better.displayPriceLabel,
    currentTrimName: currentTrim?.trimName ?? currentTrimId,
    currentPriceLabel: formatDisplayPrice(currentPrice, payment),
    currentPackagesLabel: currentPackages,
    savingsLabel: normalizePaymentMode(payment) === 'cash'
      ? `${formatCurrency(savings)} günstiger`
      : `${formatCurrency(savings)}/Monat günstiger`,
    savingsAmount: savings,
  };
}

export function findPremiumTrimAlternative({
  brand,
  model,
  currentTrimId,
  wishFeatureIds = [],
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  dealerConditions,
  currentAmount,
}) {
  if (!wishFeatureIds.length) return null;

  const payment = normalizePaymentMode(paymentType);
  const compared = priceAllTrimsForWish({
    brand,
    model,
    wishFeatureIds,
    dealerConditions,
    paymentType: payment,
    termMonths,
    mileagePerYear,
  });

  const current = compared.find((t) => t.trimId === currentTrimId);
  const currentPrice = currentAmount ?? current?.displayAmount;
  if (currentPrice == null) return null;

  const premium = compared
    .filter((t) => t.trimId !== currentTrimId
      && t.displayAmount != null
      && t.displayAmount > currentPrice
      && t.missingFeatures.length === 0)
    .sort((a, b) => a.displayAmount - b.displayAmount)[0];

  if (!premium) return null;

  const extra = premium.displayAmount - currentPrice;
  const bonusLabels = (premium.serialFeatures ?? [])
    .slice(0, 4)
    .map((id) => getFeatureLabel(id));

  return {
    trimId: premium.trimId,
    trimName: premium.trimName,
    displayAmount: premium.displayAmount,
    displayPriceLabel: premium.displayPriceLabel,
    currentTrimName: current?.trimName ?? currentTrimId,
    currentPriceLabel: formatDisplayPrice(currentPrice, payment),
    extraLabel: normalizePaymentMode(payment) === 'cash'
      ? `+${formatCurrency(extra)}`
      : `+${formatCurrency(extra)}/Monat`,
    bonusLabels,
  };
}

export { getDetailWishChips };
