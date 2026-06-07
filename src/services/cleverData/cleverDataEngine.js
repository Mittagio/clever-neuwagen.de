/**
 * Clever Data Engine – strukturierte Abfrage, keine KI-Schätzungen.
 */
import { mapIntentFuel } from '../search/searchProfile.js';
import { enrichVehicleWithCleverRecord, resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { CLEVER_FIELD_UNKNOWN } from '../../data/clever/cleverVehicleRecord.js';
import { evaluateVehicleAgainstProfile } from '../search/vehicleFeatureRuleEngine.js';

/**
 * @typedef {'fulfilled'|'missing'|'unknown'|'package'} CleverCheckStatus
 */

/**
 * Profil gegen Clever Record prüfen (harte Fakten).
 * @param {object} profile SearchProfile
 * @param {import('../../data/clever/cleverVehicleRecord.js').CleverVehicleRecord} record
 */
export function evaluateProfileAgainstRecord(profile, record) {
  const checks = [];
  let scoreSum = 0;
  let scoreMax = 0;

  const add = (id, label, status, detail = null) => {
    checks.push({ id, label, status, detail, scorable: status !== 'unknown' });
    if (status !== 'unknown') {
      scoreMax += 1;
      if (status === 'fulfilled') scoreSum += 1;
    }
  };

  if (profile.fuel) {
    const want = mapIntentFuel(profile.fuel) ?? profile.fuel;
    const pt = record.basis?.powertrain ?? CLEVER_FIELD_UNKNOWN;
    const isElectric = pt === 'elektro';
    const isPhev = pt === 'plugin-hybrid';
    let ok = false;
    if (want === 'electric') ok = isElectric;
    else if (want === 'plugin_hybrid') ok = isPhev;
    else if (want === 'combustion') ok = !isElectric && !isPhev;
    add('fuel', want === 'electric' ? 'Elektro' : 'Antrieb', ok ? 'fulfilled' : 'missing');
  }

  if (profile.seatsMin != null) {
    const seats = record.family?.seats;
    if (seats == null) {
      add('seats', `${profile.seatsMin} Sitze`, 'unknown');
    } else {
      add('seats', `${profile.seatsMin} Sitze`, seats >= profile.seatsMin ? 'fulfilled' : 'missing', `${seats} Sitze`);
    }
  }

  const towMin = profile.towCapacityKg ?? null;
  if (towMin != null || (profile.requiredFeatures ?? []).includes('towbar')) {
    const braked = record.towing?.brakedKg;
    const minKg = towMin ?? 2000;
    if (braked == null) {
      add('tow_braked', `Anhängelast ≥ ${Math.round(minKg / 100) / 10} t`, 'unknown');
    } else {
      add(
        'tow_braked',
        `Anhängelast ≥ ${Math.round(minKg / 100) / 10} t`,
        braked >= minKg ? 'fulfilled' : 'missing',
        `${braked} kg gebremst`,
      );
    }
  }

  const minRange = profile.minRangeKm ?? profile.rangeKmMin ?? null;
  if (minRange != null) {
    const range = record.electric?.wltpRangeKm;
    if (range == null) {
      add('range_km', `Reichweite ≥ ${minRange} km`, 'unknown');
    } else {
      add('range_km', `Reichweite ≥ ${minRange} km`, range >= minRange ? 'fulfilled' : 'missing', `${range} km WLTP`);
    }
  }

  const wishPercent = scoreMax > 0 ? Math.round((scoreSum / scoreMax) * 100) : 100;
  const unknownCount = checks.filter((c) => c.status === 'unknown').length;

  return {
    recordId: record.id,
    checks,
    wishPercent,
    fulfilledCount: checks.filter((c) => c.status === 'fulfilled').length,
    scorableCount: scoreMax,
    unknownCount,
  };
}

/**
 * Kombiniert Clever Record (wenn vorhanden) mit bestehender Rule Engine.
 */
export function evaluateVehicleForProfile(profile, vehicle) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);

  if (record) {
    const recordEval = evaluateProfileAgainstRecord(profile, record);
    const legacy = evaluateVehicleAgainstProfile(profile, enriched);
    const mergedChecks = recordEval.checks.length >= legacy.checks.length
      ? recordEval.checks
      : [...recordEval.checks, ...legacy.checks.filter((c) => !recordEval.checks.some((r) => r.id === c.id))];

    return {
      ...legacy,
      cleverRecordId: record.id,
      checks: mergedChecks,
      cleverQuotePercent: recordEval.wishPercent,
      fulfilledCount: recordEval.fulfilledCount,
      totalChecks: recordEval.scorableCount,
      unknownCount: recordEval.unknownCount,
      recordEval,
    };
  }

  return evaluateVehicleAgainstProfile(profile, enriched);
}

/** Technische Highlights für UI (nur bekannte Werte). */
export function buildTechnicalHighlights(vehicle = {}) {
  const v = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(v);
  const ts = v.technicalSpecs ?? {};
  const family = record?.family ?? {};
  const electric = record?.electric ?? {};
  const towing = record?.towing ?? {};
  const items = [];

  const seats = family.seats ?? v.seats;
  if (seats != null) items.push({ id: 'seats', icon: '👥', label: `${seats} Sitze` });

  const range = electric.wltpRangeKm ?? v.electricRangeKm ?? v.rangeKm ?? ts.electricRangeKm;
  if (range != null) items.push({ id: 'range', icon: '⚡', label: `${range} km WLTP` });

  const battery = electric.batteryNetKwh ?? ts.batteryKwh;
  if (battery != null) items.push({ id: 'battery', icon: '🔋', label: `${battery} kWh netto` });

  const braked = towing.brakedKg ?? ts.towBrakedKg ?? v.towCapacityKg;
  if (braked != null) {
    items.push({
      id: 'tow',
      icon: '🔗',
      label: `Anhängelast ${Math.round(braked / 100) / 10} t`,
    });
  }

  const trunk = family.trunkL ?? ts.trunkL;
  if (trunk != null) items.push({ id: 'trunk', icon: '🧳', label: `${trunk} l Kofferraum` });

  const dc = electric.dcKw;
  if (dc != null) items.push({ id: 'dc', icon: '⚡', label: `DC bis ${dc} kW` });

  return items.slice(0, 6);
}

/** Datenbank-Query: Profile gegen Fahrzeugliste (keine Freitextlogik). */
export function queryCleverDatabase(profile, vehicles = []) {
  return vehicles
    .map((vehicle) => {
      const evaluation = evaluateVehicleForProfile(profile, vehicle);
      return { vehicle: enrichVehicleWithCleverRecord(vehicle), evaluation };
    })
    .filter((row) => row.evaluation.unknownCount === 0 || row.evaluation.fulfilledCount > 0);
}
