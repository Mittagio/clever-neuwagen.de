import { resolveModelAttributeKey } from '../kia/kiaModelAttributes.js';
import { inferTrimFromTitle } from '../features/trimFeatureMapping.js';
import { mergeCleverRecordWithOverrides } from '../../services/admin/vehicleStammdatenOverrideService.js';
import { KIA_CLEVER_RECORDS } from './kiaCleverRecords.js';

function normalizeTrimId(vehicle = {}) {
  if (vehicle.trimId) return String(vehicle.trimId).toLowerCase();
  const fromTitle = inferTrimFromTitle(vehicle.title ?? vehicle.trim ?? '');
  return fromTitle || null;
}

/**
 * Clever Record für Fahrzeug – exakter Trim oder Modell-Fallback.
 * @param {object} vehicle
 * @returns {import('./cleverVehicleRecord.js').CleverVehicleRecord|null}
 */
export function resolveCleverRecord(vehicle = {}) {
  if (vehicle.cleverRecord) return vehicle.cleverRecord;
  const modelKey = resolveModelAttributeKey(vehicle);
  const trimId = normalizeTrimId(vehicle);
  if (!modelKey) return null;

  const brand = (vehicle.brand ?? 'Kia').toLowerCase();
  if (brand !== 'kia') return null;

  const candidates = KIA_CLEVER_RECORDS.filter((r) => r.modelKey === modelKey);
  if (!candidates.length) return null;

  let record;
  if (trimId) {
    const trimMatch = candidates.find((r) => r.trimId === trimId);
    if (trimMatch) record = trimMatch;
  }
  if (!record) {
    record = candidates.find((r) => !r.trimId) ?? candidates[0];
  }

  return record ? mergeCleverRecordWithOverrides(record, modelKey) : null;
}

/** Fahrzeug mit Clever Record anreichern (ohne KI). */
export function enrichVehicleWithCleverRecord(vehicle = {}) {
  const cleverRecord = resolveCleverRecord(vehicle);
  if (!cleverRecord) return vehicle;

  const towing = cleverRecord.towing ?? {};
  const family = cleverRecord.family ?? {};
  const electric = cleverRecord.electric ?? {};

  return {
    ...vehicle,
    cleverRecord,
    seats: family.seats ?? vehicle.seats,
    isSevenSeater: (family.seats ?? 0) >= 7,
    towCapacityKg: towing.brakedKg ?? vehicle.towCapacityKg ?? null,
    towUnbrakedKg: towing.unbrakedKg ?? null,
    electricRangeKm: electric.wltpRangeKm ?? vehicle.electricRangeKm,
    rangeKm: electric.wltpRangeKm ?? vehicle.rangeKm,
    technicalSpecs: {
      ...(vehicle.technicalSpecs ?? {}),
      electricRangeKm: electric.wltpRangeKm,
      batteryKwh: electric.batteryNetKwh,
      trunkL: family.trunkL,
      lengthMm: cleverRecord.dimensions?.lengthMm,
      widthMm: cleverRecord.dimensions?.widthMm,
      heightMm: cleverRecord.dimensions?.heightMm,
      wheelbaseMm: cleverRecord.dimensions?.wheelbaseMm,
      turningCircleM: cleverRecord.dimensions?.turningCircleM,
      towBrakedKg: towing.brakedKg,
      towUnbrakedKg: towing.unbrakedKg,
      roofLoadKg: towing.roofLoadKg,
    },
  };
}

export function listCleverRecords() {
  return [...KIA_CLEVER_RECORDS];
}
