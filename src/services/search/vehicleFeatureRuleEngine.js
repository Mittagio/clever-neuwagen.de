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
    const ok = range != null && range >= minRange;
    checks.push({
      id: 'range_km',
      label: `Reichweite ≥ ${minRange} km`,
      status: ok ? 'fulfilled' : 'missing',
      detail: range != null ? `${range} km` : null,
    });
    scoreMax += 1;
    if (ok) scoreSum += 1;
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

  const percent = scoreMax > 0 ? Math.round((scoreSum / scoreMax) * 100) : 100;

  return {
    model: facts.label ?? v.model,
    trim: trim?.name ?? trimId,
    modelKey,
    trimId,
    rangeKm: v.electricRangeKm ?? v.rangeKm ?? facts.typicalRangeKm ?? null,
    checks,
    cleverQuotePercent: percent,
    fulfilledCount: checks.filter((c) => c.status === 'fulfilled').length,
    totalChecks: checks.length,
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
