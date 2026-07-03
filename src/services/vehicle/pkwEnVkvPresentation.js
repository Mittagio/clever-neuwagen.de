import { FUEL_TYPE } from './vehicleEnvironmentalData.js';

function line(label, value) {
  if (!value) return null;
  return { label, value: String(value) };
}

/**
 * Kompakte Zeilen für Karten (Landingpage).
 * @param {import('./vehicleEnvironmentalData.types.js').VehicleEnvironmentalData} env
 */
export function buildPkwEnVkvCompactLines(env) {
  if (!env?.publishable) return [];

  switch (env.fuelType) {
    case FUEL_TYPE.electric:
      return [
        line('Verbrauch', env.electricConsumptionCombined ?? env.energyConsumptionCombined),
        line('CO₂', env.co2EmissionsCombined),
        line('CO₂-Klasse', env.co2Class),
      ].filter(Boolean);

    case FUEL_TYPE.plug_in_hybrid:
      return [
        line('Kraftstoff (gew.)', env.weightedFuelConsumptionCombined),
        line('Strom (gew.)', env.weightedElectricConsumptionCombined),
        line('CO₂ (gew.)', env.weightedCo2EmissionsCombined ?? env.co2EmissionsCombined),
        line('CO₂-Klasse', env.co2Class),
      ].filter(Boolean);

    case FUEL_TYPE.hybrid:
    case FUEL_TYPE.petrol:
    case FUEL_TYPE.diesel:
    case FUEL_TYPE.gas:
    case FUEL_TYPE.hydrogen:
    default:
      return [
        line('Verbrauch', env.fuelConsumptionCombined ?? env.energyConsumptionCombined),
        line('CO₂', env.co2EmissionsCombined),
        line('CO₂-Klasse', env.co2Class),
      ].filter(Boolean);
  }
}

/**
 * Detailzeilen für Kundenportal / Angebotsseite.
 * @param {import('./vehicleEnvironmentalData.types.js').VehicleEnvironmentalData} env
 */
export function buildPkwEnVkvDetailLines(env) {
  if (!env?.publishable) return [];

  const rows = [];

  if (env.fuelType === FUEL_TYPE.electric) {
    rows.push(
      line('Stromverbrauch kombiniert', env.electricConsumptionCombined),
      line('CO₂-Emissionen kombiniert', env.co2EmissionsCombined),
      line('CO₂-Klasse', env.co2Class),
      line('Elektrische Reichweite', env.electricRange),
    );
  } else if (env.fuelType === FUEL_TYPE.plug_in_hybrid) {
    rows.push(
      line('Kraftstoffverbrauch gewichtet kombiniert', env.weightedFuelConsumptionCombined),
      line('Stromverbrauch gewichtet kombiniert', env.weightedElectricConsumptionCombined),
      line('CO₂-Emissionen gewichtet kombiniert', env.weightedCo2EmissionsCombined ?? env.co2EmissionsCombined),
      line('CO₂-Klasse', env.co2Class),
      line('Kraftstoffverbrauch bei entladener Batterie', env.fuelConsumptionDischargedBattery),
      line('CO₂-Klasse bei entladener Batterie', env.co2ClassDischargedBattery),
      line('Elektrische Reichweite', env.electricRange),
    );
  } else {
    rows.push(
      line('Kraftstoffverbrauch kombiniert', env.fuelConsumptionCombined),
      line('CO₂-Emissionen kombiniert', env.co2EmissionsCombined),
      line('CO₂-Klasse', env.co2Class),
    );
  }

  return rows.filter(Boolean);
}

/**
 * Vollständiger Label-Block für PDF / Pkw-Label.
 * @param {import('./vehicleEnvironmentalData.types.js').VehicleEnvironmentalData} env
 */
export function buildPkwEnVkvLabelBlock(env) {
  if (!env?.publishable) return '';
  const lines = buildPkwEnVkvDetailLines(env);
  return lines.map((row) => `${row.label}: ${row.value}`).join('; ');
}
