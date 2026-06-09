/**
 * Clever Data Engine – strukturierte Abfrage, keine KI-Schätzungen.
 */
import { mapIntentFuel } from '../search/searchProfile.js';
import { enrichVehicleWithCleverRecord, resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { CLEVER_FIELD_UNKNOWN } from '../../data/clever/cleverVehicleRecord.js';
import { evaluateVehicleAgainstProfile } from '../search/vehicleFeatureRuleEngine.js';
import {
  formatLengthLimitLabel,
  formatHeightLimitLabel,
  formatTrunkMinLabel,
  formatIsofixRearLabel,
} from './vehicleDimensions.js';
import { buildRecordFeatureChecks, mergeProfileChecks, summarizeChecks } from './recordFeatureEvaluation.js';

export {
  resolveVehicleLengthMm,
  formatLengthLimitLabel,
  formatHeightLimitLabel,
  formatTrunkMinLabel,
  formatIsofixRearLabel,
  LARGE_TRUNK_MIN_L,
} from './vehicleDimensions.js';

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
    scoreMax += 1;
    if (status === 'fulfilled') scoreSum += 1;
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

  if (profile.maxLengthMm != null) {
    const len = record.dimensions?.lengthMm;
    const label = formatLengthLimitLabel(profile.maxLengthMm);
    if (len == null) {
      add('length_mm', label, 'unknown');
    } else {
      add(
        'length_mm',
        label,
        len <= profile.maxLengthMm ? 'fulfilled' : 'missing',
        `${(len / 1000).toFixed(2).replace('.', ',')} m`,
      );
    }
  }

  if (profile.maxHeightMm != null) {
    const height = record.dimensions?.heightMm;
    const label = formatHeightLimitLabel(profile.maxHeightMm);
    if (height == null) {
      add('height_mm', label, 'unknown');
    } else {
      add(
        'height_mm',
        label,
        height <= profile.maxHeightMm ? 'fulfilled' : 'missing',
        `${(height / 1000).toFixed(2).replace('.', ',')} m`,
      );
    }
  }

  if (profile.trunkLMin != null) {
    const trunk = record.family?.trunkL;
    const label = formatTrunkMinLabel(profile.trunkLMin);
    if (trunk == null) {
      add('trunk_l', label, 'unknown');
    } else {
      add('trunk_l', label, trunk >= profile.trunkLMin ? 'fulfilled' : 'missing', `${trunk} l`);
    }
  }

  if (profile.isofixRearMin != null) {
    const count = record.family?.isofixRearCount
      ?? (record.family?.isofixRear === true ? 2 : null);
    const label = formatIsofixRearLabel(profile.isofixRearMin);
    if (count == null) {
      add('isofix_rear', label, 'unknown');
    } else {
      add('isofix_rear', label, count >= profile.isofixRearMin ? 'fulfilled' : 'missing', `${count}× hinten`);
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

  for (const featureCheck of buildRecordFeatureChecks(profile, record)) {
    if (checks.some((c) => c.id === featureCheck.id)) continue;
    checks.push(featureCheck);
  }

  return {
    recordId: record.id,
    ...summarizeChecks(checks),
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
    const mergedChecks = mergeProfileChecks(recordEval.checks, legacy.checks);
    const mergedSummary = summarizeChecks(mergedChecks);

    return {
      ...legacy,
      cleverRecordId: record.id,
      checks: mergedSummary.checks,
      cleverQuotePercent: mergedSummary.wishPercent,
      fulfilledCount: mergedSummary.fulfilledCount,
      totalChecks: mergedSummary.totalChecks,
      scorableCount: mergedSummary.scorableCount,
      unknownCount: mergedSummary.unknownCount,
      recordEval: { ...recordEval, ...mergedSummary, checks: mergedSummary.checks },
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
