import { enrichVehicleWithCleverRecord, resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { getKiaTechnicalSpec } from '../../data/kia/kiaTechnicalSpecs.js';
import { normalizeModelKey } from '../../data/features/trimFeatureMapping.js';
import { getKiaModelAttributes } from '../../data/kia/kiaModelAttributes.js';

/** Schwellwert „großer Kofferraum“ (Familien-SUV, Online-Recherche / ADAC). */
export const LARGE_TRUNK_MIN_L = 500;

/** Fahrzeuglänge in mm – Clever Record, Bestand oder Kia-Specs. */
export function resolveVehicleLengthMm(vehicle = {}) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);
  if (record?.dimensions?.lengthMm != null) return record.dimensions.lengthMm;
  if (enriched.technicalSpecs?.lengthMm != null) return enriched.technicalSpecs.lengthMm;
  if (enriched.lengthMm != null) return enriched.lengthMm;
  const modelKey = normalizeModelKey(enriched.brand, enriched.model);
  return getKiaTechnicalSpec(modelKey)?.lengthMm ?? null;
}

export function resolveVehicleHeightMm(vehicle = {}) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);
  if (record?.dimensions?.heightMm != null) return record.dimensions.heightMm;
  if (enriched.technicalSpecs?.heightMm != null) return enriched.technicalSpecs.heightMm;
  if (enriched.heightMm != null) return enriched.heightMm;
  const modelKey = normalizeModelKey(enriched.brand, enriched.model);
  return getKiaTechnicalSpec(modelKey)?.heightMm ?? null;
}

export function resolveVehicleTrunkL(vehicle = {}) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);
  if (record?.family?.trunkL != null) return record.family.trunkL;
  if (enriched.technicalSpecs?.trunkL != null) return enriched.technicalSpecs.trunkL;
  if (enriched.trunkLiters != null) return enriched.trunkLiters;
  const modelKey = normalizeModelKey(enriched.brand, enriched.model);
  return getKiaTechnicalSpec(modelKey)?.trunkL ?? null;
}

export function resolveTowBrakedKg(vehicle = {}) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);
  if (record?.towing?.brakedKg != null) return record.towing.brakedKg;
  const facts = getKiaModelAttributes(enriched);
  if (facts.towCapacityKg != null) return facts.towCapacityKg;
  return enriched.towCapacityKg ?? enriched.technicalSpecs?.towBrakedKg ?? null;
}

/** Isofix-Punkte zweite Sitzreihe (nicht Beifahrersitz). */
export function resolveIsofixRearCount(vehicle = {}) {
  const enriched = enrichVehicleWithCleverRecord(vehicle);
  const record = resolveCleverRecord(enriched);
  if (record?.family?.isofixRearCount != null) return record.family.isofixRearCount;
  const facts = getKiaModelAttributes(enriched);
  if (facts.isofixRearCount != null) return facts.isofixRearCount;
  const family = record?.family;
  if (family?.isofixRear === true) return 2;
  return null;
}

export function formatLengthLimitLabel(maxLengthMm) {
  const m = maxLengthMm / 1000;
  const text = Number.isInteger(m) ? String(m) : m.toFixed(1).replace('.', ',');
  return `bis ${text} m Länge`;
}

export function formatHeightLimitLabel(maxHeightMm) {
  const m = maxHeightMm / 1000;
  const text = Number.isInteger(m) ? String(m) : m.toFixed(2).replace('.', ',');
  return `Garage bis ${text} m Höhe`;
}

export function formatTrunkMinLabel(trunkLMin) {
  return `Kofferraum ≥ ${trunkLMin} l`;
}

export function formatIsofixRearLabel(isofixRearMin) {
  return isofixRearMin >= 3 ? '3 Isofix hinten' : `${isofixRearMin}× Isofix hinten`;
}
