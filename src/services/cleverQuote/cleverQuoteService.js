import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { buildPackageInsight } from '../configurator/wishMagicService.js';
import {
  CLEVER_QUOTE_FEATURE_WEIGHTS,
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteResultsHeadline,
  buildCleverQuoteCountLine,
  hasCleverQuoteWishes,
} from './cleverQuoteConstants.js';

export {
  CLEVER_QUOTE_FEATURE_WEIGHTS,
  CLEVER_QUOTE_TIERS,
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteResultsHeadline,
  buildCleverQuoteCountLine,
  hasCleverQuoteWishes,
} from './cleverQuoteConstants.js';

function getActiveWishIds(wishes) {
  const ids = [...(wishes?.features ?? [])];
  if (wishes?.vehicleType === 'SUV' && !ids.includes('family_suv')) {
    ids.push('family_suv');
  }
  return [...new Set(ids)];
}

function normalizeWeights(wishIds) {
  if (!wishIds.length) return {};
  const raw = wishIds.map((id) => ({
    id,
    weight: CLEVER_QUOTE_FEATURE_WEIGHTS[id] ?? 10,
  }));
  const total = raw.reduce((s, r) => s + r.weight, 0);
  const map = {};
  raw.forEach((r) => { map[r.id] = r.weight / total; });
  return map;
}

function checkMetaWish(wishId, vehicle) {
  if (wishId === 'elektro') {
    return ['elektro', 'plugin-hybrid'].includes(vehicle.powertrain);
  }
  if (wishId === 'family_suv') {
    return vehicle.bodyType === 'suv';
  }
  if (wishId === 'range_400') {
    if (vehicle.powertrain === 'elektro' || vehicle.powertrain === 'plugin-hybrid') return true;
    const eq = (vehicle.equipment ?? []).join(' ').toLowerCase();
    return /400\s*km|reichweite|long range/i.test(eq);
  }
  if (wishId === 'benzin') {
    return ['verbrenner', 'hybrid'].includes(vehicle.powertrain);
  }
  return null;
}

function resolveWishItem(wishId, match, resolution, selectedPackages) {
  const matched = resolution?.matchedFeatures ?? match?.matchedFeatures ?? [];
  const missing = resolution?.missingFeatures ?? match?.missingFeatures ?? [];
  const viaPackage = match?.availableWithPackage ?? [];
  const pkgIds = (resolution?.requiredPackages ?? []).map((p) => p.id);
  const packageSelected = selectedPackages.some((id) => pkgIds.includes(id));

  if (matched.includes(wishId)) {
    const needsPackage = viaPackage.includes(wishId)
      || (resolution?.viaPackageFeatures ?? []).some((v) => v.wishId === wishId);
    if (needsPackage && !packageSelected) {
      return { status: 'package', via: 'package' };
    }
    return { status: 'fulfilled', via: needsPackage ? 'package' : 'standard' };
  }
  if (viaPackage.includes(wishId)) {
    return packageSelected
      ? { status: 'fulfilled', via: 'package' }
      : { status: 'package', via: 'package' };
  }
  if (missing.includes(wishId)) {
    return { status: 'missing', via: null };
  }
  return { status: 'missing', via: null };
}

function scoreFromStatus(status) {
  if (status === 'fulfilled') return 1;
  if (status === 'package') return 0.75;
  return 0;
}

/**
 * CleverQuote™ – gewichtete Passung zum Kunden
 */
export function computeCleverQuote({
  vehicle,
  wishes,
  match = null,
  selectedPackages = [],
  trimId = null,
}) {
  const wishIds = getActiveWishIds(wishes);
  if (!wishIds.length || !vehicle) return null;

  const weights = normalizeWeights(wishIds);
  const resolution = match?.resolution ?? resolveWishConfiguration({
    brand: vehicle.brand,
    model: vehicle.model,
    trimId: trimId ?? match?.bestTrimId,
    wishFeatureIds: wishIds.filter((id) => !['elektro', 'benzin', 'family_suv'].includes(id)),
  });

  const items = wishIds.map((id) => {
    const meta = checkMetaWish(id, vehicle);
    let statusResult;
    if (meta === true) {
      statusResult = { status: 'fulfilled', via: 'standard' };
    } else if (meta === false) {
      statusResult = { status: 'missing', via: null };
    } else {
      statusResult = resolveWishItem(id, match, resolution, selectedPackages);
    }
    const weight = weights[id] ?? 0;
    const earned = scoreFromStatus(statusResult.status) * weight;
    return {
      id,
      label: getFeatureLabel(id),
      status: statusResult.status,
      via: statusResult.via,
      weight,
      earned,
      fulfilled: statusResult.status === 'fulfilled',
    };
  });

  const percent = Math.round(items.reduce((s, i) => s + i.earned, 0) * 100);
  const matched = items.filter((i) => i.fulfilled).length;
  const tier = getCleverQuoteTier(percent);
  const upgrade = buildQuoteUpgrade({
    vehicle,
    wishes,
    items,
    resolution,
    selectedPackages,
    percent,
  });

  return {
    percent: Math.min(100, Math.max(0, percent)),
    tier,
    matched,
    total: wishIds.length,
    label: `CleverQuote ${Math.min(100, Math.max(0, percent))} %`,
    tierLabel: tier.label,
    dot: tier.dot,
    items,
    upgrade,
    fulfillmentLabel: `${matched} von ${wishIds.length} Wünschen`,
  };
}

function buildQuoteUpgrade({ vehicle, wishes, items, resolution, selectedPackages, percent }) {
  const missingViaPackage = items.filter((i) => i.status === 'package');
  if (!missingViaPackage.length || !vehicle) return null;

  const pkg = resolution?.requiredPackages?.[0];
  if (!pkg || selectedPackages.includes(pkg.id)) return null;

  const insight = buildPackageInsight(
    vehicle.brand,
    vehicle.model,
    pkg.id,
    wishes?.features ?? [],
    wishes?.budget?.type ?? 'leasing',
  );

  const potentialGain = missingViaPackage.reduce(
    (s, m) => s + m.weight * 0.25 * 100,
    0,
  );

  return {
    packageId: pkg.id,
    packageName: pkg.name ?? insight?.packageName,
    missingLabels: missingViaPackage.map((m) => m.label),
    potentialPercentGain: Math.round(potentialGain),
    targetPercent: Math.min(100, percent + Math.round(potentialGain)),
    impactLabel: insight?.priceImpactLabel,
    bonusLabels: insight?.bonusItems?.map((b) => b.label) ?? [],
  };
}

export function computeCleverQuoteAfterPackage(currentQuote, potentialGain = 0) {
  if (!currentQuote) return null;
  const next = Math.min(100, currentQuote.percent + potentialGain);
  const tier = getCleverQuoteTier(next);
  return {
    ...currentQuote,
    percent: next,
    tier,
    label: `CleverQuote ${next} %`,
    tierLabel: tier.label,
    dot: tier.dot,
  };
}
