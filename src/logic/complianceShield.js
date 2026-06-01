import { sportage } from '../data/kiaSportage.js';

/** Pflichtfelder – nur aus Herstellerdaten, keine Freitexteingabe */
export const COMPLIANCE_REQUIRED_FIELDS = [
  { id: 'fuel', label: 'Kraftstoff' },
  { id: 'consumption', label: 'Verbrauch (komb.)' },
  { id: 'co2', label: 'CO₂-Emissionen' },
  { id: 'electricConsumption', label: 'Stromverbrauch' },
  { id: 'wltp', label: 'WLTP-Prüfverfahren' },
  { id: 'range', label: 'Reichweite' },
  { id: 'energyClass', label: 'Energieeffizienzklasse' },
];

function getEngine(engineId) {
  return sportage.engines.find((e) => e.id === engineId) ?? null;
}

function getWltp(engineId) {
  return sportage.wltp.find((w) => w.engineId === engineId) ?? null;
}

function formatRange(min, max, unit) {
  if (min == null && max == null) return null;
  if (min === max || max == null) return `${min} ${unit}`;
  return `${min}–${max} ${unit}`;
}

/**
 * Compliance-Werte ausschließlich aus Herstellerdatenbank
 */
export function getOemComplianceValues(engineId) {
  const engine = getEngine(engineId);
  const wltp = getWltp(engineId);
  const isElectric = /elektro|electric/i.test(engine?.fuelType ?? '');

  const consumption = wltp?.consumptionCombined
    ? formatRange(wltp.consumptionCombined.min, wltp.consumptionCombined.max, wltp.consumptionCombined.unit)
    : null;

  const co2 = wltp?.co2Combined
    ? formatRange(wltp.co2Combined.min, wltp.co2Combined.max, wltp.co2Combined.unit)
    : null;

  const electricConsumption = wltp?.electricConsumption
    ? formatRange(
      wltp.electricConsumption.min,
      wltp.electricConsumption.max,
      wltp.electricConsumption.unit,
    )
    : (isElectric ? consumption : 'n. a. (Verbrenner/Hybrid)');

  const range = wltp?.electricRange
    ? formatRange(wltp.electricRange.min, wltp.electricRange.max, wltp.electricRange.unit)
    : (isElectric ? null : 'n. a. (nicht elektrisch)');

  return {
    fuel: engine?.fuelType ?? null,
    consumption,
    co2,
    electricConsumption,
    wltp: wltp ? 'WLTP (EU)' : null,
    range,
    energyClass: wltp?.efficiencyClass ?? wltp?.co2Class ?? null,
  };
}

function fieldSatisfied(fieldId, values, engine) {
  const isElectric = /elektro|electric/i.test(engine?.fuelType ?? '');

  switch (fieldId) {
    case 'fuel':
    case 'consumption':
    case 'co2':
    case 'wltp':
    case 'energyClass':
      return Boolean(values[fieldId]);
    case 'electricConsumption':
      return isElectric ? Boolean(values.electricConsumption) && !String(values.electricConsumption).startsWith('n. a.')
        : Boolean(values.electricConsumption);
    case 'range':
      return isElectric ? Boolean(values.range) && !String(values.range).startsWith('n. a.')
        : Boolean(values.range);
    default:
      return false;
  }
}

export function evaluateVehicleCompliance({ vehicleLabel, engineId }) {
  const engine = getEngine(engineId);
  const values = getOemComplianceValues(engineId);

  const missingFields = COMPLIANCE_REQUIRED_FIELDS.filter(
    (f) => !fieldSatisfied(f.id, values, engine),
  );

  const total = COMPLIANCE_REQUIRED_FIELDS.length;
  const score = Math.round(((total - missingFields.length) / total) * 100);
  const publishBlocked = missingFields.length > 0;

  return {
    vehicleLabel: vehicleLabel ?? `${sportage.brand} ${sportage.model}`,
    engineId,
    engineName: engine?.name ?? '–',
    values,
    missingFields,
    score,
    publishBlocked,
    statusLabel: publishBlocked ? 'Pflichtangaben fehlen' : 'Fahrzeug veröffentlichbar',
    statusEmoji: publishBlocked ? '🔴' : '🟢',
  };
}

export function listComplianceVehicles() {
  return sportage.engines.map((engine) => evaluateVehicleCompliance({
    vehicleLabel: `${sportage.brand} ${sportage.model} · ${engine.name}`,
    engineId: engine.id,
  }));
}
