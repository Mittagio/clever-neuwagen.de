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
} from '../../data/kia/kiaModelAttributes.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { toCanonicalFeatureId, toInternalFeatureId } from './canonicalFeatureIds.js';
import { mapIntentFuel } from './searchProfile.js';
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
  const v = enrichVehicleWithModelAttributes(vehicle);
  const facts = v.modelFacts ?? getKiaModelAttributes(v);
  const modelKey = normalizeModelKey(v.brand, v.model);
  const trimId = inferTrimFromTitle(v.title ?? v.trim ?? '');
  const trim = getTrimConfig(modelKey, trimId);

  const checks = [];
  let scoreSum = 0;
  let scoreMax = 0;

  if (profile.fuel) {
    const want = mapIntentFuel(profile.fuel) ?? profile.fuel;
    const vehicleFuel = facts.fuel ?? (v.powertrain === 'elektro' ? 'electric' : v.powertrain);
    const ok = want === vehicleFuel
      || (want === 'electric' && vehicleFuel === 'electric');
    checks.push({
      id: 'fuel',
      label: want === 'electric' ? 'Elektro' : 'Antrieb',
      status: ok ? 'fulfilled' : 'missing',
      canonicalId: 'fuel',
    });
    scoreMax += 1;
    if (ok) scoreSum += 1;
  }

  const minRange = profile.minRangeKm ?? profile.rangeKmMin ?? null;
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

  if (profile.seatsMin != null) {
    const seats = facts.seats ?? v.seats ?? 5;
    const ok = seats >= profile.seatsMin || facts.isSevenSeater;
    checks.push({
      id: 'seats',
      label: `${profile.seatsMin} Sitze`,
      status: ok ? 'fulfilled' : 'missing',
    });
    scoreMax += 1;
    if (ok) scoreSum += 1;
  }

  if (profile.maxLengthMm != null) {
    const len = resolveVehicleLengthMm(v);
    const maxM = profile.maxLengthMm / 1000;
    const label = `bis ${Number.isInteger(maxM) ? maxM : maxM.toFixed(1).replace('.', ',')} m Länge`;
    if (len == null) {
      checks.push({ id: 'length_mm', label, status: 'unknown' });
    } else {
      const ok = len <= profile.maxLengthMm;
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

  if (profile.maxHeightMm != null) {
    const height = resolveVehicleHeightMm(v);
    const label = formatHeightLimitLabel(profile.maxHeightMm);
    if (height == null) {
      checks.push({ id: 'height_mm', label, status: 'unknown' });
    } else {
      const ok = height <= profile.maxHeightMm;
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

  if (profile.trunkLMin != null) {
    const trunk = resolveVehicleTrunkL(v);
    const label = formatTrunkMinLabel(profile.trunkLMin);
    if (trunk == null) {
      checks.push({ id: 'trunk_l', label, status: 'unknown' });
    } else {
      const ok = trunk >= profile.trunkLMin;
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

  if (profile.isofixRearMin != null) {
    const count = resolveIsofixRearCount(v);
    const label = formatIsofixRearLabel(profile.isofixRearMin);
    if (count == null) {
      checks.push({ id: 'isofix_rear', label, status: 'unknown' });
    } else {
      const ok = count >= profile.isofixRearMin;
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

  if (profile.towCapacityKg != null) {
    const braked = resolveTowBrakedKg(v);
    const wantT = Math.round(profile.towCapacityKg / 100) / 10;
    const label = `Anhängelast ≥ ${wantT} t`;
    if (braked == null) {
      checks.push({ id: 'tow_braked', label, status: 'unknown' });
    } else {
      const ok = braked >= profile.towCapacityKg;
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

  for (const featureId of profile.requiredFeatures ?? []) {
    const internal = toInternalFeatureId(featureId);

    // Strukturelles Merkmal (Modell-Fakten), kein Trim-Paket
    if (internal === 'seats_7') {
      const seats = facts.seats ?? v.seats ?? 5;
      const ok = seats >= 7 || facts.isSevenSeater;
      checks.push({
        id: internal,
        canonicalId: 'seats_7',
        label: '7 Sitze',
        status: ok ? 'fulfilled' : 'missing',
      });
      scoreMax += 1;
      if (ok) scoreSum += 1;
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
  return trims.map((trim) => {
    const vehicle = {
      brand: 'Kia',
      model: getModelTrims(modelKey)[0] ? modelKey : modelKey,
      title: `Kia ${modelKey.toUpperCase()} ${trim.name}`,
      powertrain: 'elektro',
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
