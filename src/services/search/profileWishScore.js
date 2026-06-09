/**
 * Gewichteter Wunsch-Score pro Kriterium (Verkäufer-Logik).
 * Erfüllt = volle Gewichtung · Paket = Teilpunkte · Fehlend = 0.
 */

import { getCleverQuoteTier } from '../cleverQuote/cleverQuoteConstants.js';
import { evaluateModelTrimsAgainstProfile, evaluateVehicleAgainstProfile } from './vehicleFeatureRuleEngine.js';
import { getMatchVariantLabel, getTrimGroupKey } from '../../logic/discoveryDisplay.js';
import { buildFulfillmentLabel } from './wishMatchRanking.js';

/** Gewichtung einzelner Prüfpunkte (summieren sich, werden normalisiert). */
export const PROFILE_CHECK_WEIGHTS = {
  fuel: 30,
  range_km: 30,
  seats_7: 25,
  tow_braked: 20,
  camera_360: 40,
  heat_pump: 25,
  heated_seats: 15,
  towbar: 20,
  rear_camera: 12,
  large_trunk: 15,
  length_mm: 15,
  seats: 10,
};

/** Anteil der Gewichtung bei Paket-Option (40 → 25 Punkte). */
export const PACKAGE_WEIGHT_FACTOR = 0.625;

const DEFAULT_FEATURE_WEIGHT = 15;

function checkWeightKey(check) {
  return check.canonicalId ?? check.id;
}

function rawWeightForCheck(check) {
  const key = checkWeightKey(check);
  return PROFILE_CHECK_WEIGHTS[key] ?? DEFAULT_FEATURE_WEIGHT;
}

function pointsForStatus(status, weight) {
  if (status === 'fulfilled') return weight;
  if (status === 'package') return weight * PACKAGE_WEIGHT_FACTOR;
  if (status === 'unknown') return null;
  return 0;
}

/**
 * Gewichteter Wunsch-Prozentsatz aus Rule-Engine-Checks.
 * @param {Array<{ id: string, canonicalId?: string, status: string }>} checks
 */
export function computeWeightedWishPercent(checks = []) {
  const scorable = checks.filter((c) => c.status !== 'unknown');
  if (!scorable.length) return 100;

  const totalWeight = scorable.reduce((sum, check) => sum + rawWeightForCheck(check), 0);
  if (totalWeight <= 0) return 100;

  let earned = 0;
  for (const check of scorable) {
    const weight = rawWeightForCheck(check);
    const points = pointsForStatus(check.status, weight);
    if (points == null) continue;
    earned += points;
  }

  return Math.round((earned / totalWeight) * 100);
}

const STATUS_RANK = { fulfilled: 3, package: 2, missing: 1, unknown: 0 };

/**
 * Modell-Ebene: bester Status je Kriterium über alle Trims.
 * @param {Array<{ checks: object[] }>} trimEvaluations
 */
export function aggregateModelChecks(trimEvaluations = []) {
  if (!trimEvaluations.length) return [];

  const byId = new Map();
  for (const evaluation of trimEvaluations) {
    for (const check of evaluation.checks ?? []) {
      const key = checkWeightKey(check);
      const existing = byId.get(key);
      if (!existing || STATUS_RANK[check.status] > STATUS_RANK[existing.status]) {
        byId.set(key, { ...check });
      }
    }
  }

  return [...byId.values()];
}

export function modelCheckLabel(check) {
  const isCamera = check.canonicalId === 'camera_360' || check.id === 'camera_360';
  if (isCamera && check.status !== 'missing' && check.status !== 'unknown') {
    return '360° Kamera verfügbar';
  }
  if (check.status === 'package') {
    return `${check.label} (Paket)`;
  }
  return check.label;
}

function buildWishCleverQuote(percent, evaluation, { advisorMode = false } = {}) {
  const tier = getCleverQuoteTier(percent);
  const checks = evaluation?.checks ?? [];

  return {
    percent,
    tier,
    tierLabel: tier.label,
    dot: tier.dot,
    label: `CleverQuote ${percent} %`,
    matched: checks.filter((c) => c.status === 'fulfilled').length,
    scorableTotal: checks.filter((c) => c.status !== 'unknown').length,
    total: checks.length,
    fulfillmentLabel: buildFulfillmentLabel(evaluation),
    unknownCount: evaluation?.unknownCount ?? 0,
    profileTruth: true,
    wishWeighted: true,
    engineVersion: 'wish-weighted',
    ...(advisorMode ? { advisorMode: true } : {}),
    items: checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      fulfilled: check.status === 'fulfilled',
      scorable: check.status !== 'unknown',
    })),
  };
}

function collectGroupListingMatches(group) {
  const byTrim = new Map();
  const allMatches = [
    group.primaryMatch,
    ...(group.variants ?? []),
    ...(group.trimVariants ?? []).map((t) => t.match ?? t),
  ].filter(Boolean);

  for (const match of allMatches) {
    const trimKey = getTrimGroupKey(match);
    const score = match.weightedWishPercent ?? match.cleverQuote?.percent ?? match.score ?? 0;
    const existing = byTrim.get(trimKey);
    const existingScore = existing?.weightedWishPercent ?? existing?.cleverQuote?.percent ?? existing?.score ?? 0;
    if (!existing || score > existingScore) {
      byTrim.set(trimKey, match);
    }
  }

  return [...byTrim.values()];
}

function buildListingTrimEvaluations(profile, matches = []) {
  return matches.map((match) => {
    const evaluation = evaluateVehicleAgainstProfile(profile, match.vehicle);
    const trimKey = getTrimGroupKey(match);
    const trimLabel = getMatchVariantLabel(match) || evaluation.trim || trimKey;
    return {
      ...evaluation,
      trimId: evaluation.trimId || trimKey,
      trim: trimLabel,
    };
  });
}

function syntheticMatchFromEvaluation(evaluation, modelKey) {
  return {
    vehicle: {
      brand: 'Kia',
      model: modelKey.toUpperCase(),
      title: `Kia ${evaluation.model} ${evaluation.trim}`,
      powertrain: 'elektro',
      trimId: evaluation.trimId,
      trim: evaluation.trim,
    },
    model: evaluation.model,
    bestTrim: evaluation.trim,
  };
}

/**
 * Modelllinie: Katalog-Trims bewerten, Modell-Quote + sortierte Ausstattungen.
 * @param {import('./searchProfile.js').SearchProfile} profile
 * @param {object} group – modelLineGroup
 */
export function buildModelLineWishAnalysis(profile, group) {
  if (!profile || !group?.modelLineKey) return null;

  const modelKey = group.modelLineKey;
  const listingMatches = collectGroupListingMatches(group);
  let catalogEvals = evaluateModelTrimsAgainstProfile(profile, modelKey);

  if (!catalogEvals.length && listingMatches.length) {
    catalogEvals = buildListingTrimEvaluations(profile, listingMatches);
  }

  if (!catalogEvals.length) return null;

  const matchByTrim = new Map();
  for (const match of listingMatches) {
    matchByTrim.set(getTrimGroupKey(match), match);
  }

  const trimRows = catalogEvals.map((evaluation) => {
    const weightedPercent = computeWeightedWishPercent(evaluation.checks);
    const trimKey = evaluation.trimId ?? String(evaluation.trim).toLowerCase().replace(/\s+/g, '-');
    const listingMatch = matchByTrim.get(trimKey) ?? syntheticMatchFromEvaluation(evaluation, modelKey);
    const cleverQuote = buildWishCleverQuote(weightedPercent, evaluation, {
      advisorMode: listingMatch.cleverQuote?.advisorMode,
    });

    return {
      trimKey,
      trimLabel: evaluation.trim,
      match: { ...listingMatch, cleverQuote, profileEvaluation: evaluation, weightedWishPercent: weightedPercent },
      weightedPercent,
      evaluation,
      isPrimary: false,
    };
  }).sort((a, b) => b.weightedPercent - a.weightedPercent);

  if (trimRows.length) trimRows[0].isPrimary = true;

  const modelChecks = aggregateModelChecks(catalogEvals);
  const modelWeightedPercent = Math.max(...trimRows.map((t) => t.weightedPercent), 0);
  const modelEvaluation = {
    checks: modelChecks,
    cleverQuotePercent: modelWeightedPercent,
    fulfilledCount: modelChecks.filter((c) => c.status === 'fulfilled').length,
    totalChecks: modelChecks.length,
    unknownCount: modelChecks.filter((c) => c.status === 'unknown').length,
  };

  return {
    modelQuote: buildWishCleverQuote(modelWeightedPercent, modelEvaluation),
    modelChecks,
    modelWeightedPercent,
    trimVariants: trimRows,
    recommendedTrim: trimRows[0] ?? null,
    primaryMatch: trimRows[0]?.match ?? group.primaryMatch,
  };
}

/** Einzelnes Listing mit gewichtetem Wunsch-Score anreichern. */
export function enrichMatchWithWeightedWishQuote(match, profile) {
  if (!match?.vehicle || !profile) return match;
  const evaluation = evaluateVehicleAgainstProfile(profile, match.vehicle);
  const weightedPercent = computeWeightedWishPercent(evaluation.checks);
  const cleverQuote = buildWishCleverQuote(weightedPercent, evaluation, {
    advisorMode: match.cleverQuote?.advisorMode,
  });
  return {
    ...match,
    profileEvaluation: evaluation,
    weightedWishPercent: weightedPercent,
    cleverQuote,
  };
}

/**
 * Modell nur empfehlen, wenn mindestens ein Trim die Pflicht-Wünsche abdeckt.
 */
/** Modelllinien ohne passenden Trim aus Top-Ergebnissen filtern. */
export function filterModelLineGroupsByWishFit(groups = [], profile) {
  if (!profileHasWishCriteria(profile) || !groups.length) return groups;

  return groups.filter((group) => {
    const analysis = buildModelLineWishAnalysis(profile, group);
    if (!analysis) return true;
    return modelMeetsWishThreshold(analysis, profile);
  });
}

export function modelMeetsWishThreshold(analysis, profile, { minPercent = 55 } = {}) {
  if (!analysis) return true;
  const required = profile?.requiredFeatures ?? [];
  if (!required.length) {
    return (analysis.modelWeightedPercent ?? 0) >= minPercent;
  }
  const checks = analysis.modelChecks ?? [];
  const allCoverable = required.every((id) => {
    const check = checks.find((c) => c.id === id || c.canonicalId === id);
    return check && check.status !== 'missing';
  });
  return allCoverable && (analysis.modelWeightedPercent ?? 0) >= minPercent;
}

export function profileHasWishCriteria(profile) {
  if (!profile) return false;
  return Boolean(
    profile.fuel
    || profile.minRangeKm
    || profile.rangeKmMin
    || profile.seatsMin
    || profile.towCapacityKg
    || profile.maxLengthMm
    || profile.maxHeightMm
    || profile.trunkLMin
    || profile.isofixRearMin
    || profile.maxPrice
    || profile.maxMonthlyRate
    || profile.bodyType
    || profile.bodyClass
    || (profile.requiredFeatures?.length > 0),
  );
}
