/**
 * Ausstattungs-Checks aus CleverVehicleRecord (Wahrheit vor Trim-Heuristik).
 */
import { CLEVER_FEATURE_STATUS as S } from '../../data/clever/cleverVehicleRecord.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { toInternalFeatureId } from '../search/canonicalFeatureIds.js';

/** @typedef {'fulfilled'|'missing'|'unknown'|'package'} RecordCheckStatus */

/**
 * @param {boolean|string|null|undefined} value
 * @returns {RecordCheckStatus}
 */
export function resolveCleverFeatureStatus(value) {
  if (value === true || value === S.STANDARD) return 'fulfilled';
  if (value === false || value === S.MISSING) return 'missing';
  if (value === S.PACKAGE || value === S.ACCESSORY) return 'package';
  return 'unknown';
}

/**
 * @param {import('../../data/clever/cleverVehicleRecord.js').CleverVehicleRecord} record
 * @param {string} featureId – interne ID
 * @returns {RecordCheckStatus}
 */
export function evaluateRecordFeature(record, featureId) {
  const id = toInternalFeatureId(featureId);
  const electric = record.electric ?? {};
  const comfort = record.comfort ?? {};

  switch (id) {
    case 'heat_pump':
      if (electric.heatPump === true) return 'fulfilled';
      if (electric.heatPump === false) return 'missing';
      return 'unknown';
    case 'camera_360':
      return resolveCleverFeatureStatus(comfort.camera360);
    case 'rear_camera':
      return resolveCleverFeatureStatus(comfort.camera360 ?? comfort.rearCamera);
    case 'panorama_roof':
      return resolveCleverFeatureStatus(comfort.panoramaRoof);
    case 'power_tailgate':
      return resolveCleverFeatureStatus(comfort.powerTailgate);
    case 'heated_seats':
      return resolveCleverFeatureStatus(comfort.heatedSeats);
    case 'steering_heat':
      return resolveCleverFeatureStatus(comfort.steeringHeat);
    case 'ventilated_seats':
      return resolveCleverFeatureStatus(comfort.ventilatedSeats);
    case 'head_up_display':
      return resolveCleverFeatureStatus(comfort.hud);
    case 'towbar': {
      const kg = record.towing?.brakedKg;
      if (kg != null && kg >= 750) return 'fulfilled';
      if (kg === 0) return 'missing';
      return kg != null ? 'fulfilled' : 'unknown';
    }
    default:
      return 'unknown';
  }
}

/**
 * @param {object} profile
 * @param {import('../../data/clever/cleverVehicleRecord.js').CleverVehicleRecord} record
 */
export function buildRecordFeatureChecks(profile, record) {
  const checks = [];
  const features = profile.requiredFeatures ?? [];

  for (const featureId of features) {
    if (featureId === 'seats_7') continue;
    const status = evaluateRecordFeature(record, featureId);
    if (status === 'unknown') continue;
    checks.push({
      id: featureId,
      label: getFeatureLabel(featureId) ?? featureId,
      status: status === 'package' ? 'package' : status,
    });
  }

  return checks;
}

/** Record-Checks mit Trim-Engine zusammenführen: Trim schlägt Record-unknown. */
export function mergeProfileChecks(recordChecks = [], trimChecks = []) {
  const byId = new Map(recordChecks.map((c) => [c.id, c]));
  for (const trimCheck of trimChecks) {
    const existing = byId.get(trimCheck.id);
    if (!existing) {
      byId.set(trimCheck.id, trimCheck);
      continue;
    }
    if (existing.status === 'unknown' && trimCheck.status !== 'unknown') {
      byId.set(trimCheck.id, trimCheck);
    }
  }
  return [...byId.values()];
}

export function summarizeChecks(checks = []) {
  const fulfilledCount = checks.filter((c) => c.status === 'fulfilled').length;
  const unknownCount = checks.filter((c) => c.status === 'unknown').length;
  const missingCount = checks.filter((c) => c.status === 'missing' || c.status === 'package').length;
  const totalChecks = checks.length;
  const wishPercent = totalChecks > 0 ? Math.round((fulfilledCount / totalChecks) * 100) : 100;

  return {
    checks,
    fulfilledCount,
    unknownCount,
    missingCount,
    totalChecks,
    scorableCount: totalChecks,
    wishPercent,
  };
}
