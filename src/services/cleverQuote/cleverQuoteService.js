import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { buildPackageInsight } from '../configurator/wishMagicService.js';
import {
  CLEVER_QUOTE_FEATURE_WEIGHTS,
  CLEVER_QUOTE_UNCERTAIN_LABEL,
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteResultsHeadline,
  buildCleverQuoteCountLine,
  buildCuratedResultsLine,
  hasCleverQuoteWishes,
} from './cleverQuoteConstants.js';
import { evaluateVehicleAgainstProfile } from '../search/vehicleFeatureRuleEngine.js';
import { computeCleverQuoteV2 } from './cleverQuoteV2.js';
import { resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { evaluateVehicleForProfile } from '../cleverData/cleverDataEngine.js';

export {
  CLEVER_QUOTE_FEATURE_WEIGHTS,
  CLEVER_QUOTE_TIERS,
  CLEVER_QUOTE_UNCERTAIN_LABEL,
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteResultsHeadline,
  buildCleverQuoteCountLine,
  buildCuratedResultsLine,
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
    return vehicle.powertrain === 'elektro';
  }
  if (wishId === 'family_suv') {
    return vehicle.bodyType === 'suv';
  }
  if (wishId === 'range_400') {
    const range = Number(vehicle.rangeKm ?? vehicle.wltpRange);
    if (Number.isFinite(range) && range > 0) return range >= 400;
    if (vehicle.powertrain === 'elektro' || vehicle.powertrain === 'plugin-hybrid') return null;
    const eq = (vehicle.equipment ?? []).join(' ').toLowerCase();
    if (/400\s*km|reichweite|long range/i.test(eq)) return true;
    return null;
  }
  if (wishId === 'benzin') {
    return ['verbrenner', 'hybrid'].includes(vehicle.powertrain);
  }
  return null;
}

const META_WISH_IDS = new Set(['elektro', 'benzin', 'family_suv', 'range_400']);

function resolveWishStatusRow(wishId, vehicle, match, resolution, selectedPackages) {
  if (META_WISH_IDS.has(wishId)) {
    const meta = checkMetaWish(wishId, vehicle);
    if (meta === true) return { status: 'fulfilled', via: 'standard' };
    if (meta === false) return { status: 'missing', via: null };
    return { status: 'uncertain', via: null };
  }
  return resolveWishItem(wishId, match, resolution, selectedPackages);
}

function resolveWishItem(wishId, match, resolution, selectedPackages) {
  if (resolution?.uncertainFeatures?.includes(wishId)) {
    return { status: 'uncertain', via: null };
  }

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
  if (status === 'uncertain') return null;
  return 0;
}

/** CleverQuote aus Clever Data Engine (v2) oder Rule Engine (Fallback). */
export function buildProfileCleverQuote(match, profile, { preserveAdvisorMode = false } = {}) {
  if (!profile || !match?.vehicle) return match?.cleverQuote ?? null;

  if (resolveCleverRecord(match.vehicle)) {
    const v2 = computeCleverQuoteV2(match, profile);
    if (v2 && preserveAdvisorMode && match.cleverQuote?.advisorMode) {
      return { ...v2, advisorMode: true };
    }
    return v2;
  }

  const evaluation = evaluateVehicleForProfile(profile, match.vehicle);
  const tier = getCleverQuoteTier(evaluation.cleverQuotePercent);
  const base = match.cleverQuote ?? {};
  const total = evaluation.totalChecks;

  return {
    ...base,
    percent: evaluation.cleverQuotePercent,
    tier,
    tierLabel: tier.label,
    dot: tier.dot,
    matched: evaluation.fulfilledCount,
    scorableTotal: total,
    total,
    fulfillmentLabel: total
      ? `${evaluation.fulfilledCount} von ${total} Wünschen`
      : null,
    profileTruth: true,
    ...(preserveAdvisorMode && base.advisorMode ? { advisorMode: true } : {}),
    items: evaluation.checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      fulfilled: check.status === 'fulfilled',
      scorable: true,
      weight: total > 0 ? 1 / total : 0,
      earned: check.status === 'fulfilled' && total > 0 ? 1 / total : 0,
    })),
    trustNote: base.trustNote,
  };
}

/** Modelllinien-Gruppe mit Rule-Engine-CleverQuote anreichern (Alternativ-Stufen). */
export function enrichModelLineGroupWithProfileQuote(group, searchProfile) {
  if (!searchProfile || !group?.primaryMatch) return group;

  const primaryMatch = {
    ...group.primaryMatch,
    cleverQuote: buildProfileCleverQuote(group.primaryMatch, searchProfile, {
      preserveAdvisorMode: true,
    }),
  };

  const variants = (group.variants ?? []).map((match) => ({
    ...match,
    cleverQuote: buildProfileCleverQuote(match, searchProfile, {
      preserveAdvisorMode: true,
    }),
  }));

  return { ...group, primaryMatch, variants };
}

/** @param {{ items?: Array<{ status: string, fulfilled?: boolean, label: string }> }} cleverQuote */
export function partitionCleverQuoteItems(cleverQuote) {
  const items = cleverQuote?.items ?? [];
  return {
    fulfilled: items.filter((i) => i.status === 'fulfilled'),
    packageNeeded: items.filter((i) => i.status === 'package'),
    missing: items.filter((i) => i.status === 'missing'),
    uncertain: items.filter((i) => i.status === 'uncertain'),
  };
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

  const resolution = match?.resolution ?? resolveWishConfiguration({
    brand: vehicle.brand,
    model: vehicle.model,
    trimId: trimId ?? match?.bestTrimId,
    wishFeatureIds: wishIds.filter((id) => !['elektro', 'benzin', 'family_suv'].includes(id)),
  });

  const statusRows = wishIds.map((id) => ({
    id,
    statusResult: resolveWishStatusRow(id, vehicle, match, resolution, selectedPackages),
  }));

  const scorableIds = statusRows
    .filter((row) => row.statusResult.status !== 'uncertain')
    .map((row) => row.id);
  const weights = normalizeWeights(scorableIds.length ? scorableIds : []);

  const items = statusRows.map(({ id, statusResult }) => {
    const weight = weights[id] ?? 0;
    const score = scoreFromStatus(statusResult.status);
    const earned = score == null ? 0 : score * weight;
    return {
      id,
      label: getFeatureLabel(id),
      status: statusResult.status,
      via: statusResult.via,
      weight,
      earned,
      scorable: statusResult.status !== 'uncertain',
      fulfilled: statusResult.status === 'fulfilled',
    };
  });

  const scorableItems = items.filter((i) => i.scorable);
  const totalWeight = scorableItems.reduce((s, i) => s + i.weight, 0);
  const earnedSum = scorableItems.reduce((s, i) => s + i.earned, 0);
  const uncertainCount = items.filter((i) => i.status === 'uncertain').length;
  const percent = totalWeight > 0
    ? Math.round((earnedSum / totalWeight) * 100)
    : null;
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
    percent: percent == null ? null : Math.min(100, Math.max(0, percent)),
    tier,
    matched,
    total: wishIds.length,
    scorableTotal: scorableItems.length,
    uncertainCount,
    label: percent == null
      ? CLEVER_QUOTE_UNCERTAIN_LABEL
      : `CleverQuote ${Math.min(100, Math.max(0, percent))} %`,
    tierLabel: tier.label,
    dot: tier.dot,
    items,
    upgrade,
    trustNote: uncertainCount > 0
      ? `${uncertainCount} Wunsch${uncertainCount === 1 ? '' : 'wünsche'} derzeit nicht sicher prüfbar`
      : null,
    fulfillmentLabel: percent == null
      ? `${uncertainCount} nicht sicher prüfbar`
      : `${matched} von ${scorableItems.length} Wünschen`,
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
    targetPercent: percent != null
      ? Math.min(100, percent + Math.round(potentialGain))
      : null,
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
