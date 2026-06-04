import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import { getDetailWishChips, WISH_BUILDER_GROUPS } from '../../data/features/wishDetailChips.js';
import { priceConfiguration } from '../pricing/pricingEngine.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import {
  analyzeSingleWish,
  buildPackageInsight,
  buildWishRecommendation,
  findBetterTrimAlternative,
} from '../configurator/wishMagicService.js';
import {
  getDisplayPrice,
  getDeltaPrice,
  normalizePaymentModeInput,
} from '../pricing/pricingResolver.js';

export { WISH_BUILDER_GROUPS };

export function createInitialDetailSelection(vehicle, overrides = {}) {
  return {
    paymentMode: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
    financeDown: 0,
    financeBalloon: 0,
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    trim: overrides.trim ?? null,
    trimName: overrides.trimName ?? null,
    selectedColor: overrides.selectedColor ?? null,
    selectedFeatures: overrides.selectedFeatures ?? [],
    selectedPackages: overrides.selectedPackages ?? [],
    selectedAccessories: overrides.selectedAccessories ?? [],
    selectedDealerOfferId: null,
    recommendationResult: null,
    ...overrides,
  };
}

export function toggleFeature(selection, featureId) {
  const selectedFeatures = selection.selectedFeatures.includes(featureId)
    ? selection.selectedFeatures.filter((id) => id !== featureId)
    : [...selection.selectedFeatures, featureId];
  return { ...selection, selectedFeatures };
}

export function acceptPackage(selection, packageId) {
  if (selection.selectedPackages.includes(packageId)) return selection;
  return {
    ...selection,
    selectedPackages: [...selection.selectedPackages, packageId],
  };
}

export function acceptBetterTrim(selection, trimId, packageIds = [], accessoryIds = []) {
  return {
    ...selection,
    trim: trimId,
    selectedPackages: packageIds,
    selectedAccessories: accessoryIds,
  };
}

export function resolveRequestedFeatures(selection, vehicleCatalog) {
  const { brand, model } = vehicleCatalog;
  const trimId = selection.trim;
  return selection.selectedFeatures.map((featureId) => {
    const analysis = analyzeSingleWish({
      brand,
      model,
      trimId,
      wishId: featureId,
      paymentType: selection.paymentMode,
      termMonths: selection.termMonths,
      mileagePerYear: selection.mileagePerYear,
    });
    return mapFeatureAnalysis(featureId, analysis);
  });
}

function mapFeatureAnalysis(featureId, analysis) {
  const label = getFeatureLabel(featureId);
  if (analysis.status === 'standard' || analysis.status === 'standard_other_trim') {
    return { id: featureId, label, status: 'standard' };
  }
  if (analysis.status === 'package' || analysis.status === 'accessory' || analysis.status === 'package_other_trim') {
    return {
      id: featureId,
      label,
      status: 'package',
      packageId: analysis.packageId,
      packageName: analysis.packageName,
    };
  }
  if (analysis.status === 'missing') {
    return { id: featureId, label, status: 'unavailable' };
  }
  return { id: featureId, label, status: 'requested' };
}

export function isFeatureStandard(featureId, trim, vehicleCatalog) {
  const resolution = resolveWishConfiguration({
    brand: vehicleCatalog.brand,
    model: vehicleCatalog.model,
    trimId: trim,
    wishFeatureIds: [featureId],
  });
  return resolution?.matchedFeatures.includes(featureId)
    && !resolution.requiredPackages.length
    && !resolution.requiredAccessories.length;
}

export function findPackageForFeature(featureId, trim, vehicleCatalog) {
  const analysis = analyzeSingleWish({
    brand: vehicleCatalog.brand,
    model: vehicleCatalog.model,
    trimId: trim,
    wishId: featureId,
    paymentType: 'leasing',
  });
  if (!analysis.packageId) return null;
  const mfg = getManufacturerModel(vehicleCatalog.brand, vehicleCatalog.model);
  const pkg = mfg?.data?.packages?.find((p) => p.id === analysis.packageId);
  return pkg ? { id: pkg.id, name: pkg.name, rateDelta: pkg.rateDelta, priceGross: pkg.priceGross } : null;
}

export function findBetterTrim(selection, vehicleCatalog) {
  const payment = normalizePaymentModeInput(selection.paymentMode);
  const pricing = priceConfiguration({
    brand: vehicleCatalog.brand,
    model: vehicleCatalog.model,
    trimId: selection.trim,
    wishFeatureIds: selection.selectedFeatures,
    packageIds: selection.selectedPackages,
    accessoryIds: selection.selectedAccessories,
    paymentType: payment,
    termMonths: selection.termMonths,
    mileagePerYear: selection.mileagePerYear,
  });
  const currentPrice = getDisplayPrice(selection, null, { basePricing: pricing });

  return findBetterTrimAlternative({
    brand: vehicleCatalog.brand,
    model: vehicleCatalog.model,
    currentTrimId: selection.trim,
    wishFeatureIds: selection.selectedFeatures,
    paymentType: payment,
    termMonths: selection.termMonths,
    mileagePerYear: selection.mileagePerYear,
    downPayment: selection.downPayment,
    financeDown: selection.financeDown,
    financeBalloon: selection.financeBalloon,
    currentAmount: currentPrice.value,
  });
}

function mapPackageToRecommendation(pkg, brand, model, wishFeatureIds, paymentMode) {
  const insight = buildPackageInsight(brand, model, pkg.id, wishFeatureIds, paymentMode);
  if (!insight) return null;
  const mfg = getManufacturerModel(brand, model);
  const raw = mfg?.data?.packages?.find((p) => p.id === pkg.id);
  return {
    id: pkg.id,
    name: pkg.name ?? insight.packageName,
    priceImpact: raw?.priceGross ?? 0,
    monthlyImpact: raw?.rateDelta ?? 0,
    features: (insight.items ?? []).map((item) => ({
      id: item.customerFeatureId ?? item.equipmentId,
      label: item.label,
      reason: item.role === 'wish' ? 'requested' : 'bonus',
    })),
  };
}

export function buildRecommendation(selection, vehicleCatalog, pricingContext = {}) {
  const { brand, model } = vehicleCatalog;
  const payment = normalizePaymentModeInput(selection.paymentMode);

  if (!selection.selectedFeatures.length) {
    return emptyRecommendation();
  }

  const raw = buildWishRecommendation({
    brand,
    model,
    trimId: selection.trim,
    wishFeatureIds: selection.selectedFeatures,
    paymentType: payment,
    termMonths: selection.termMonths,
    mileagePerYear: selection.mileagePerYear,
    downPayment: selection.downPayment,
    financeDown: selection.financeDown,
    financeBalloon: selection.financeBalloon,
    dealerConditions: vehicleCatalog.dealerConditions,
  });

  const includedFeatures = [];
  const requestedFeatures = [];

  for (const item of raw.wishItems ?? []) {
    const mapped = mapFeatureAnalysis(item.id, item);
    if (mapped.status === 'standard') includedFeatures.push(mapped);
    else requestedFeatures.push(mapped);
  }

  const requiredPackages = (raw.packages ?? [])
    .map((p) => mapPackageToRecommendation(p, brand, model, selection.selectedFeatures, payment))
    .filter(Boolean);

  let betterTrim = null;
  if (raw.betterTrim?.trimId && raw.betterTrim.trimId !== selection.trim) {
    const loseLabels = (raw.wishItems ?? [])
      .filter((w) => w.status === 'standard' || w.status === 'fulfilled')
      .map((w) => w.label)
      .slice(0, 3);
    betterTrim = {
      exists: true,
      trim: raw.betterTrim.trimName,
      trimId: raw.betterTrim.trimId,
      reason: raw.betterTrim.savingsLabel ?? 'Günstigere Rate',
      oldPrice: { label: raw.betterTrim.currentPriceLabel },
      newPrice: { label: raw.betterTrim.displayPriceLabel },
      keepLabels: [],
      loseLabels,
      resolution: raw.resolution,
    };
  }

  let premiumTrim = null;
  if (raw.premiumTrim?.trimId && raw.premiumTrim.trimId !== selection.trim) {
    premiumTrim = {
      exists: true,
      trim: raw.premiumTrim.trimName,
      trimId: raw.premiumTrim.trimId,
      reason: raw.premiumTrim.extraLabel ?? 'Mehr Ausstattung',
      gainLabels: raw.premiumTrim.bonusLabels ?? [],
      resolution: raw.resolution,
    };
  }

  const baselineSelection = {
    ...selection,
    selectedFeatures: [],
    selectedPackages: [],
    selectedAccessories: [],
  };
  const delta = raw.pricing
    ? getDeltaPrice(
      baselineSelection,
      { ...selection, selectedPackages: raw.resolution?.packageIds ?? selection.selectedPackages },
      null,
      { basePricing: raw.pricing, vehicle: vehicleCatalog.vehicle },
    )
    : null;

  return {
    includedFeatures,
    requestedFeatures,
    requiredPackages,
    betterTrim,
    premiumTrim,
    resolution: raw.resolution,
    magicSummary: buildMagicSummaryText(includedFeatures, requiredPackages, delta, payment),
    priceDeltaLabel: delta?.deltaLabel ?? null,
    newPriceLabel: raw.newRateLabel,
    baselinePriceLabel: delta?.previous?.label ?? null,
    newPriceLabelFull: delta?.next?.label ?? raw.newRateLabel,
    raw,
  };
}

function emptyRecommendation() {
  return {
    includedFeatures: [],
    requestedFeatures: [],
    requiredPackages: [],
    betterTrim: null,
    premiumTrim: null,
    resolution: null,
    magicSummary: null,
    priceDeltaLabel: null,
    newPriceLabel: null,
    raw: null,
  };
}

function buildMagicSummaryText(included, packages, delta, payment) {
  const parts = [];
  if (included.length) {
    parts.push(
      `${included.length} Wunsch${included.length > 1 ? 'e sind' : ' ist'} bereits serienmäßig enthalten`,
    );
  }
  if (packages.length === 1) {
    parts.push(`Für ${packages[0].features.filter((f) => f.reason === 'requested').map((f) => f.label).join(' und ') || 'Ihren Wunsch'} empfehlen wir das ${packages[0].name}`);
  }
  if (delta?.next?.label) {
    const mode = normalizePaymentModeInput(payment);
    if (mode === 'cash') {
      parts.push(`Neuer Kaufpreis: ${delta.next.label}`);
    } else {
      parts.push(`Neue Rate: ${delta.next.label}`);
    }
    if (delta.deltaLabel) parts.push(delta.deltaLabel);
  }
  return parts.length ? parts.join('.\n') : null;
}

export function getWishBuilderChips(brand, model, maxVisible = 8) {
  const allIds = getDetailWishChips(brand, model);
  const grouped = WISH_BUILDER_GROUPS.map((group) => ({
    ...group,
    features: group.featureIds
      .filter((id) => allIds.includes(id))
      .map((id) => ({ id, label: getFeatureLabel(id) })),
  })).filter((g) => g.features.length > 0);

  const visibleIds = allIds.slice(0, maxVisible);
  return { grouped, allIds, visibleIds };
}
