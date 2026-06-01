/**
 * Compliance Shield – harte Sperre für WLTP / Verbrauch / CO₂
 */
import {
  COMPLIANCE_STATUS,
  COMPLIANCE_STATUS_UI,
  getRequiredFieldsForPowertrain,
} from '../data/complianceSchema.js';
import { resolveVehicleComplianceProfile, listAllComplianceProfiles } from '../data/vehicleComplianceRegistry.js';

export { COMPLIANCE_STATUS, COMPLIANCE_STATUS_UI };
export { getRequiredFieldsForPowertrain } from '../data/complianceSchema.js';
export { listAllComplianceProfiles };

const BLOCKED_COPY_MESSAGE = 'Veröffentlichung blockiert: Pflichtangaben fehlen.';

function isPresent(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (/^n\.?\s*a\.|^–$|^-$/i.test(s)) return false;
  return true;
}

function resolveEffectiveStatus(compliance, missingCount) {
  if (missingCount > 0) return COMPLIANCE_STATUS.missing;
  if (compliance?.status === COMPLIANCE_STATUS.needs_review) return COMPLIANCE_STATUS.needs_review;
  if (compliance?.status === COMPLIANCE_STATUS.verified) return COMPLIANCE_STATUS.verified;
  return COMPLIANCE_STATUS.missing;
}

function buildLegalBlockIce(values) {
  const parts = [];
  if (isPresent(values.consumptionCombined)) {
    parts.push(`Kraftstoffverbrauch kombiniert: ${values.consumptionCombined}`);
  }
  if (isPresent(values.co2Combined)) {
    parts.push(`CO₂-Emissionen kombiniert: ${values.co2Combined}`);
  }
  if (isPresent(values.co2Class)) {
    parts.push(`CO₂-Klasse: ${values.co2Class}`);
  }
  return parts.join('; ') + (parts.length ? '.' : '');
}

function buildLegalBlockBev(values) {
  const parts = [];
  if (isPresent(values.electricConsumptionCombined)) {
    parts.push(`Stromverbrauch kombiniert: ${values.electricConsumptionCombined}`);
  }
  if (isPresent(values.co2Combined)) {
    parts.push(`CO₂-Emissionen kombiniert: ${values.co2Combined}`);
  }
  if (isPresent(values.co2Class)) {
    parts.push(`CO₂-Klasse: ${values.co2Class}`);
  }
  if (isPresent(values.electricRange)) {
    parts.push(`elektrische Reichweite: ${values.electricRange}`);
  }
  return parts.join('; ') + (parts.length ? '.' : '');
}

function buildLegalBlockPhev(values) {
  const parts = [];
  if (isPresent(values.weightedConsumptionCombined)) {
    parts.push(`Kraftstoffverbrauch gewichtet kombiniert: ${values.weightedConsumptionCombined}`);
  }
  if (isPresent(values.weightedElectricConsumption)) {
    parts.push(`Stromverbrauch gewichtet kombiniert: ${values.weightedElectricConsumption}`);
  }
  if (isPresent(values.weightedCo2Combined)) {
    parts.push(`CO₂-Emissionen gewichtet kombiniert: ${values.weightedCo2Combined}`);
  }
  if (isPresent(values.co2Class)) {
    parts.push(`CO₂-Klasse: ${values.co2Class}`);
  }
  if (isPresent(values.depletedBatteryConsumption)) {
    parts.push(`bei entladener Batterie: ${values.depletedBatteryConsumption}`);
  }
  if (isPresent(values.electricRange)) {
    parts.push(`elektrische Reichweite: ${values.electricRange}`);
  }
  return parts.join('; ') + (parts.length ? '.' : '');
}

export function buildRequiredLegalBlock(powertrain, values) {
  switch (powertrain) {
    case 'bev':
      return buildLegalBlockBev(values);
    case 'phev':
      return buildLegalBlockPhev(values);
    case 'hev':
    case 'ice':
    default:
      return buildLegalBlockIce(values);
  }
}

/**
 * @param {object} vehicleOrOffer – Fahrzeug, Angebot, Konfiguration oder { engineId, brand, model, … }
 */
export function validateVehicleCompliance(vehicleOrOffer = {}) {
  const profile = resolveVehicleComplianceProfile(vehicleOrOffer);
  const powertrain = profile.powertrainType ?? 'ice';
  const requiredFields = getRequiredFieldsForPowertrain(powertrain);
  const values = { ...(profile.wltp ?? {}) };
  const warnings = [];

  if (!isPresent(values.dataStandard) && profile.compliance?.dataStandard) {
    values.dataStandard = profile.compliance.dataStandard;
  }

  const missingFields = requiredFields.filter((f) => !isPresent(values[f.id]));

  const engineIds = profile.engineIds ?? (profile.engineId ? [profile.engineId] : []);
  if (vehicleOrOffer.advertiseRange && engineIds.length > 1) {
    warnings.push('Wertebereich nur mit expliziter Variantenangabe zulässig.');
  }

  if (!profile.compliance?.verifiedAt && profile.compliance?.status !== COMPLIANCE_STATUS.verified) {
    warnings.push('WLTP-Daten noch nicht durch Admin freigegeben.');
  }

  const effectiveStatus = resolveEffectiveStatus(profile.compliance, missingFields.length);
  const multiVariantBlocked = engineIds.length > 1 && !vehicleOrOffer.allowMultiVariant;
  if (multiVariantBlocked) {
    warnings.push('Veröffentlichung blockiert: Mehrere Varianten – bitte eine Motorisierung wählen.');
  }

  const publishable = effectiveStatus === COMPLIANCE_STATUS.verified
    && missingFields.length === 0
    && !multiVariantBlocked
    && !(vehicleOrOffer.advertiseRange && engineIds.length > 1);

  const total = requiredFields.length;
  const score = total === 0 ? 0 : Math.round(((total - missingFields.length) / total) * 100);

  const requiredLegalBlock = publishable
    ? buildRequiredLegalBlock(powertrain, values)
    : '';

  const statusUi = COMPLIANCE_STATUS_UI[effectiveStatus] ?? COMPLIANCE_STATUS_UI.missing;

  return {
    publishable,
    score,
    missingFields,
    warnings,
    requiredLegalBlock,
    blockedCopyMessage: BLOCKED_COPY_MESSAGE,
    powertrain,
    values,
    compliance: profile.compliance,
    vehicleLabel: profile.label,
    engineId: profile.engineId,
    engineName: profile.variant ?? '',
    status: effectiveStatus,
    statusEmoji: statusUi.emoji,
    statusLabel: publishable ? statusUi.label : (missingFields.length ? 'Pflichtangaben fehlen' : statusUi.label),
    publishBlocked: !publishable,
    source: profile.compliance?.source ?? '–',
    verifiedAt: profile.compliance?.verifiedAt ?? '–',
    verifiedBy: profile.compliance?.verifiedBy ?? '–',
  };
}

/** @deprecated Alias – nutzt validateVehicleCompliance */
export function evaluateVehicleCompliance({ vehicleLabel, engineId, ...rest } = {}) {
  const result = validateVehicleCompliance({ engineId, label: vehicleLabel, ...rest });
  return {
    ...result,
    values: result.values,
    missingFields: result.missingFields,
  };
}

/** @deprecated */
export function getOemComplianceValues(engineId) {
  return validateVehicleCompliance({ engineId }).values;
}

export function listComplianceVehicles() {
  return listAllComplianceProfiles().map((p) => validateVehicleCompliance(p));
}

export function appendLegalBlockToText(text, validation) {
  if (!validation?.publishable || !validation.requiredLegalBlock) return text;
  const block = validation.requiredLegalBlock.trim();
  if (!block) return text;
  if (text.includes(block)) return text;
  return `${text.trim()}\n\n${block}`;
}

export function canCopyComplianceContent(validation) {
  return Boolean(validation?.publishable);
}
