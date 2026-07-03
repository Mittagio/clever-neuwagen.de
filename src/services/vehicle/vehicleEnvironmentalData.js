/**
 * Zentrale EnVKV-/CO₂-Daten für Neuwagen-Angebote.
 * Werte nur aus geprüften OEM-/Admin-Quellen – keine OpenAI-Werte als verified.
 */
import { COMPLIANCE_STATUS } from '../../data/complianceSchema.js';
import { resolveVehicleComplianceProfile } from '../../data/vehicleComplianceRegistry.js';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';

export const ENV_CONFIDENCE = COMPLIANCE_STATUS;

export const FUEL_TYPE = {
  electric: 'electric',
  petrol: 'petrol',
  diesel: 'diesel',
  hybrid: 'hybrid',
  plug_in_hybrid: 'plug_in_hybrid',
  gas: 'gas',
  hydrogen: 'hydrogen',
};

const OPENAI_SOURCE_PATTERNS = [
  /openai/i,
  /\bgpt\b/i,
  /\bllm\b/i,
  /ki-generiert/i,
  /chatgpt/i,
];

const POWERTRAIN_TO_FUEL = {
  bev: FUEL_TYPE.electric,
  ice: FUEL_TYPE.petrol,
  hev: FUEL_TYPE.hybrid,
  phev: FUEL_TYPE.plug_in_hybrid,
};

function isPresent(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return Boolean(s) && !/^n\.?\s*a\.|^–$|^-$/i.test(s);
}

/** @param {string|null|undefined} source */
export function isTrustedEnvironmentalSource(source) {
  if (!source || !String(source).trim()) return false;
  return !OPENAI_SOURCE_PATTERNS.some((pattern) => pattern.test(String(source)));
}

/** @param {string|null|undefined} source */
export function isOpenAiEnvironmentalSource(source) {
  if (!source) return false;
  return OPENAI_SOURCE_PATTERNS.some((pattern) => pattern.test(String(source)));
}

function resolveConfidence(profile, validation) {
  const source = profile.compliance?.source ?? '';
  if (isOpenAiEnvironmentalSource(source)) {
    return ENV_CONFIDENCE.needs_review;
  }
  if (validation.missingFields?.length > 0) {
    return ENV_CONFIDENCE.missing;
  }
  if (validation.publishable) {
    return ENV_CONFIDENCE.verified;
  }
  if (profile.compliance?.status === ENV_CONFIDENCE.needs_review) {
    return ENV_CONFIDENCE.needs_review;
  }
  return ENV_CONFIDENCE.missing;
}

function pickUnitFromValue(value, fallback) {
  if (!isPresent(value)) return fallback;
  const text = String(value);
  if (/kwh/i.test(text)) return 'kWh/100 km';
  if (/l\/100|l\s*\/\s*100/i.test(text)) return 'l/100 km';
  if (/kg\/100|kg\s*\/\s*100/i.test(text)) return 'kg/100 km';
  return fallback;
}

/**
 * @param {object} vehicleRef – Fahrzeug, Angebot, Konfiguration oder Portfolio-Item
 * @returns {import('./vehicleEnvironmentalData.types.js').VehicleEnvironmentalData}
 */
export function resolveVehicleEnvironmentalData(vehicleRef = {}) {
  const profile = resolveVehicleComplianceProfile(vehicleRef);
  if (vehicleRef.compliance) {
    profile.compliance = { ...profile.compliance, ...vehicleRef.compliance };
  }
  const validation = validateVehicleCompliance({ ...vehicleRef, ...profile });
  const wltp = { ...(profile.wltp ?? {}) };
  const powertrain = validation.powertrain ?? profile.powertrainType ?? 'ice';
  const fuelType = vehicleRef.fuelType ?? POWERTRAIN_TO_FUEL[powertrain] ?? FUEL_TYPE.petrol;
  const confidence = resolveConfidence(profile, validation);

  const electricConsumption = wltp.electricConsumptionCombined ?? null;
  const fuelConsumption = wltp.consumptionCombined ?? null;

  return {
    vehicleId: vehicleRef.vehicleId ?? vehicleRef.id ?? profile.engineId ?? null,
    modelKey: vehicleRef.modelKey ?? profile.modelKey ?? null,
    trimId: vehicleRef.trimId ?? null,
    motorId: vehicleRef.engineId ?? vehicleRef.motorId ?? profile.engineId ?? null,
    modelYear: vehicleRef.modelYear ?? profile.modelYear ?? null,
    market: vehicleRef.market ?? 'DE',
    isNewPassengerCar: vehicleRef.isNewPassengerCar !== false,

    fuelType,

    energyConsumptionCombined: electricConsumption ?? fuelConsumption ?? wltp.weightedElectricConsumption ?? wltp.weightedConsumptionCombined ?? null,
    energyConsumptionUnit: pickUnitFromValue(
      electricConsumption ?? wltp.weightedElectricConsumption,
      pickUnitFromValue(fuelConsumption ?? wltp.weightedConsumptionCombined, 'l/100 km'),
    ),

    fuelConsumptionCombined: fuelConsumption,
    fuelConsumptionDischargedBattery: wltp.depletedBatteryConsumption ?? null,
    weightedFuelConsumptionCombined: wltp.weightedConsumptionCombined ?? null,

    electricConsumptionCombined: electricConsumption,
    weightedElectricConsumptionCombined: wltp.weightedElectricConsumption ?? null,

    co2EmissionsCombined: wltp.co2Combined ?? null,
    weightedCo2EmissionsCombined: wltp.weightedCo2Combined ?? null,
    co2Class: wltp.co2Class ?? null,
    co2ClassDischargedBattery: wltp.co2ClassDischargedBattery ?? null,

    electricRange: wltp.electricRange ?? null,
    allElectricRangeCity: wltp.allElectricRangeCity ?? null,

    source: profile.compliance?.source ?? null,
    sourceDocument: profile.compliance?.sourceUrl ?? vehicleRef.sourceDocument ?? null,
    sourcePage: vehicleRef.sourcePage ?? null,
    sourceDate: profile.compliance?.verifiedAt ?? null,
    confidence,
    verifiedBy: profile.compliance?.verifiedBy ?? null,
    verifiedAt: profile.compliance?.verifiedAt ?? null,

    publishable: validation.publishable
      && confidence === ENV_CONFIDENCE.verified
      && !isOpenAiEnvironmentalSource(profile.compliance?.source ?? ''),
    validation,
    powertrain,
    vehicleLabel: profile.label ?? vehicleRef.label ?? null,
  };
}

/** Serialisiert für Portfolio, PDF und Kundenlink – keine UI-Texte. */
export function serializeVehicleEnvironmentalData(envData) {
  if (!envData) return null;
  const {
    validation,
    powertrain,
    vehicleLabel,
    publishable,
    ...payload
  } = envData;
  return {
    ...payload,
    publishable: Boolean(publishable),
  };
}

export function buildAdminEnVkvStatusLabel(envData) {
  if (!envData) return 'CO₂-/Verbrauchsdaten: fehlt';
  const label = envData.vehicleLabel ?? envData.modelKey ?? 'Fahrzeug';
  const statusMap = {
    [ENV_CONFIDENCE.verified]: 'verified',
    [ENV_CONFIDENCE.needs_review]: 'needs_review',
    [ENV_CONFIDENCE.missing]: 'fehlt',
  };
  const status = statusMap[envData.confidence] ?? 'fehlt';
  return `${label} · CO₂-/Verbrauchsdaten: ${status}`;
}
