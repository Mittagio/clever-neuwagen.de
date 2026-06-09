/**
 * Rule Engine: Fahrzeugdatenbank ist die Wahrheit.
 * Prüft jedes Modell/Trim gegen SearchProfile – OpenAI wählt hier nichts aus.
 */

import {
  getModelTrims,
  getTrimConfig,
  inferTrimFromTitle,
  normalizeModelKey,
} from '../../data/features/trimFeatureMapping.js';
import {
  enrichVehicleWithModelAttributes,
  getKiaModelAttributes,
  vehicleFuelTruth,
} from '../../data/kia/kiaModelAttributes.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { toCanonicalFeatureId, toInternalFeatureId } from './canonicalFeatureIds.js';
import { mapIntentFuel } from './searchProfile.js';
import {
  prepareProfileForEvaluation,
  isFeatureCoveredByStructuralProfile,
} from './profileCriteriaCanonical.js';
import {
  resolveVehicleLengthMm,
  resolveVehicleHeightMm,
  resolveVehicleTrunkL,
  resolveIsofixRearCount,
  resolveTowBrakedKg,
  formatHeightLimitLabel,
  formatTrunkMinLabel,
  formatIsofixRearLabel,
} from '../cleverData/vehicleDimensions.js';

/**
 * @typedef {'fulfilled'|'package'|'missing'} FeatureStatus
 */

/**
 * @param {object} trim
 * @param {string} featureId – interne ID
 */
function profileFuelMatchesVehicle(want, vehicle, facts) {
  const have = vehicleFuelTruth(vehicle);
  if (want === have) return true;
  if (want === 'electric' && have === 'electric') return true;
  if (want === 'hybrid' && (have === 'hybrid' || have === 'plugin_hybrid')) return true;
  if (want === 'plugin_hybrid' && have === 'plugin_hybrid') return true;
  if (facts?.fuel && facts.fuel !== 'multi' && want === facts.fuel) return true;
  return false;
}

export function evaluateTrimFeature(trim, featureId) {
  if (!trim) return { status: 'missing', via: null };
  const internal = toInternalFeatureId(featureId);
  if (trim.standardFeatures?.includes(internal)) {
    return { status: 'fulfilled', via: 'standard' };
  }
  if (trim.availableViaPackage?.includes(internal)) {
    return { status: 'package', via: 'package' };
  }
  return { status: 'missing', via: null };
}

/**
 * @param {object} profile – SearchProfile
 * @param {object} vehicle
 */
export function evaluateVehicleAgainstProfile(profile, vehicle) {
  const { profile: canonicalProfile, valid, errors } = prepareProfileForEvaluation(profile);
  if (!valid && process.env.NODE_ENV !== 'production') {
    console.warn('[profileCriteria]', errors.join('; '));
  }

  const v = enrichVehicleWithModelAttributes(vehicle);
  const facts = v.modelFacts ?? getKiaModelAttributes(v);
  const modelKey = normalizeModelKey(v.brand, v.model);
  const trimId = inferTrimFromTitle(v.title ?? v.trim ?? '');
  const trim = getTrimConfig(modelKey, trimId);

  const checks = [];
  const p = canonicalProfile;
  let scoreSum = 0;
  let scoreMax = 0;

  if (p.fuel) {
    const want = mapIntentFuel(p.fuel) ?? p.fuel;
    const ok = profileFuelMatchesVehicle(want, v, facts);
    const fuelLabel = want === 'electric'
      ? 'Elektro'
      : want === 'hybrid'
        ? 'Hybrid'
        : want === 'plugin_hybrid'
          ? 'Plug-in Hybrid'
          : 'Antrieb';
    checks.push({
      id: 'fuel',
      label: fuelLabel,
      status: ok ? 'fulfilled' : 'missing',
      canonicalId: 'fuel',
    });
    scoreMax += 1;
    if (ok) scoreSum += 1;
  }

  const minRange = p.minRangeKm ?? p.rangeKmMin ?? null;
  if (minRange != null) {
    const range = v.electricRangeKm ?? v.rangeKm ?? facts.typicalRangeKm ?? null;
    if (range == null) {
      checks.push({
        id: 'range_km',
        label: `Reichweite ≥ ${minRange} km`,
        status: 'unknown',
      });
    } else {
      const ok = range >= minRange;
      checks.push({
        id: 'range_km',
        label: `Reichweite ≥ ${minRange} km`,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${range} km`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  if (p.seatsMin != null) {
    const seats = facts.seats ?? v.seats ?? 5;
    const ok = seats >= p.seatsMin || facts.isSevenSeater;
    checks.push({
      id: 'seats',
      label: `${p.seatsMin} Sitze`,
      status: ok ? 'fulfilled' : 'missing',
    });
    scoreMax += 1;
    if (ok) scoreSum += 1;
  }

  if (p.maxLengthMm != null) {
    const len = resolveVehicleLengthMm(v);
    const maxM = p.maxLengthMm / 1000;
    const label = `bis ${Number.isInteger(maxM) ? maxM : maxM.toFixed(1).replace('.', ',')} m Länge`;
    if (len == null) {
      checks.push({ id: 'length_mm', label, status: 'unknown' });
    } else {
      const ok = len <= p.maxLengthMm;
      checks.push({
        id: 'length_mm',
        label,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${(len / 1000).toFixed(2).replace('.', ',')} m`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  if (p.maxHeightMm != null) {
    const height = resolveVehicleHeightMm(v);
    const label = formatHeightLimitLabel(p.maxHeightMm);
    if (height == null) {
      checks.push({ id: 'height_mm', label, status: 'unknown' });
    } else {
      const ok = height <= p.maxHeightMm;
      checks.push({
        id: 'height_mm',
        label,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${(height / 1000).toFixed(2).replace('.', ',')} m`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  if (p.trunkLMin != null) {
    const trunk = resolveVehicleTrunkL(v);
    const label = formatTrunkMinLabel(p.trunkLMin);
    if (trunk == null) {
      checks.push({ id: 'trunk_l', label, status: 'unknown' });
    } else {
      const ok = trunk >= p.trunkLMin;
      checks.push({
        id: 'trunk_l',
        label,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${trunk} l`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  if (p.isofixRearMin != null) {
    const count = resolveIsofixRearCount(v);
    const label = formatIsofixRearLabel(p.isofixRearMin);
    if (count == null) {
      checks.push({ id: 'isofix_rear', label, status: 'unknown' });
    } else {
      const ok = count >= p.isofixRearMin;
      checks.push({
        id: 'isofix_rear',
        label,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${count}× hinten`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  if (p.towCapacityKg != null) {
    const braked = resolveTowBrakedKg(v);
    const wantT = Math.round(p.towCapacityKg / 100) / 10;
    const label = `Anhängelast ≥ ${wantT} t`;
    if (braked == null) {
      checks.push({ id: 'tow_braked', label, status: 'unknown' });
    } else {
      const ok = braked >= p.towCapacityKg;
      checks.push({
        id: 'tow_braked',
        label,
        status: ok ? 'fulfilled' : 'missing',
        detail: `${braked} kg`,
      });
      if (ok) scoreSum += 1;
    }
    scoreMax += 1;
  }

  for (const featureId of p.requiredFeatures ?? []) {
    const internal = toInternalFeatureId(featureId);

    if (isFeatureCoveredByStructuralProfile(internal, p)) {
      continue;
    }

    const result = evaluateTrimFeature(trim, internal);
    const label = getFeatureLabel(internal) ?? toCanonicalFeatureId(internal);
    checks.push({
      id: internal,
      canonicalId: toCanonicalFeatureId(internal),
      label,
      status: result.status,
      via: result.via,
    });
    scoreMax += 1;
    if (result.status === 'fulfilled') scoreSum += 1;
    // Paket-Features zählen nicht als 100 %-Treffer (Kunde erwartet Serienausstattung)
  }

  const fulfilledCount = checks.filter((c) => c.status === 'fulfilled').length;
  const unknownCount = checks.filter((c) => c.status === 'unknown').length;
  const percent = checks.length > 0 ? Math.round((fulfilledCount / checks.length) * 100) : 100;

  return {
    model: facts.label ?? v.model,
    trim: trim?.name ?? trimId,
    modelKey,
    trimId,
    rangeKm: v.electricRangeKm ?? v.rangeKm ?? facts.typicalRangeKm ?? null,
    checks,
    cleverQuotePercent: percent,
    fulfilledCount,
    totalChecks: checks.length,
    scorableCount: checks.length,
    unknownCount,
  };
}

/**
 * Alle Trims eines Modells prüfen – z. B. EV3 Earth vs GT-Line.
 */
export function evaluateModelTrimsAgainstProfile(profile, modelKey) {
  const trims = getModelTrims(modelKey);
  if (!trims.length) return [];

  const facts = getKiaModelAttributes({ brand: 'Kia', model: modelKey, modelKey });
  const powertrain = facts?.powertrains?.[0] ?? facts?.fuel ?? null;
  const modelLabel = facts?.label ?? modelKey.toUpperCase();

  return trims.map((trim) => {
    const vehicle = {
      brand: 'Kia',
      model: modelLabel,
      modelKey,
      title: `Kia ${modelLabel} ${trim.name}`,
      trimId: trim.id,
      powertrain: powertrain ?? undefined,
    };
    return evaluateVehicleAgainstProfile(profile, vehicle);
  }).sort((a, b) => b.cleverQuotePercent - a.cleverQuotePercent);
}

/** SearchProfile → JSON wie in der API-Doku (OpenAI Structured Output). */
export function searchProfileToApiJson(profile) {
  return {
    fuel: profile.fuel ?? null,
    minRangeKm: profile.minRangeKm ?? profile.rangeKmMin ?? null,
    requiredFeatures: (profile.requiredFeatures ?? []).map(toCanonicalFeatureId),
    softPreferences: profile.softPreferences ?? [],
    budget: profile.maxMonthlyRate != null
      ? { type: profile.payment ?? 'leasing', maxMonthlyRate: profile.maxMonthlyRate }
      : profile.maxPrice != null
        ? { type: 'cash', maxPrice: profile.maxPrice }
        : null,
    seatsMin: profile.seatsMin ?? null,
  };
}
