/**
 * Kia-Modellstammdaten – harte Wahrheit für Rule Engine.
 * KI darf diese Fakten nicht überschreiben.
 */

export const FUEL_TRUTH = {
  electric: 'electric',
  elektro: 'electric',
  hybrid: 'hybrid',
  'plugin-hybrid': 'plugin_hybrid',
  plugin_hybrid: 'plugin_hybrid',
  verbrenner: 'combustion',
  benzin: 'combustion',
  diesel: 'combustion',
  nutzfahrzeug: 'commercial',
};

/** @typedef {'kleinwagen'|'compact'|'compact_suv'|'family_suv'|'large_suv'|'limousine'|'kombi'|'commercial'} BodyClass */

/**
 * @type {Record<string, {
 *   modelKey: string,
 *   label: string,
 *   fuel: string,
 *   powertrains: string[],
 *   seats: number,
 *   isSevenSeater: boolean,
 *   bodyClass: BodyClass,
 *   bodyType: string,
 *   availableAsElectric: boolean,
 *   typicalRangeKm?: number,
 *   towCapacityKg?: number,
 * }>}
 */
export const KIA_MODEL_ATTRIBUTES = {
  picanto: {
    modelKey: 'picanto',
    label: 'Picanto',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'kleinwagen',
    bodyType: 'kleinwagen',
    availableAsElectric: false,
  },
  ev2: {
    modelKey: 'ev2',
    label: 'EV2',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'kleinwagen',
    bodyType: 'kleinwagen',
    availableAsElectric: true,
    typicalRangeKm: 330,
  },
  ev3: {
    modelKey: 'ev3',
    label: 'EV3',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'compact_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 436,
  },
  ev4: {
    modelKey: 'ev4',
    label: 'EV4',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'limousine',
    bodyType: 'limousine',
    availableAsElectric: true,
    typicalRangeKm: 490,
  },
  'ev4-fastback': {
    modelKey: 'ev4-fastback',
    label: 'EV4 Fastback',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'limousine',
    bodyType: 'limousine',
    availableAsElectric: true,
    typicalRangeKm: 580,
  },
  ev5: {
    modelKey: 'ev5',
    label: 'EV5',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 460,
  },
  'ev5-gt': {
    modelKey: 'ev5-gt',
    label: 'EV5 GT',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 430,
  },
  ev6: {
    modelKey: 'ev6',
    label: 'EV6',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 528,
    towCapacityKg: 1600,
  },
  'ev6-gt': {
    modelKey: 'ev6-gt',
    label: 'EV6 GT',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 450,
    towCapacityKg: 1600,
  },
  ev9: {
    modelKey: 'ev9',
    label: 'EV9',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 7,
    isSevenSeater: true,
    isofixRearCount: 2,
    bodyClass: 'large_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 512,
    towCapacityKg: 2500,
  },
  'ev9-gt': {
    modelKey: 'ev9-gt',
    label: 'EV9 GT',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 7,
    isSevenSeater: true,
    bodyClass: 'large_suv',
    bodyType: 'suv',
    availableAsElectric: true,
    typicalRangeKm: 480,
    towCapacityKg: 2500,
  },
  niro: {
    modelKey: 'niro',
    label: 'Niro',
    fuel: 'hybrid',
    powertrains: ['hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'compact_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  'niro-hybrid': {
    modelKey: 'niro-hybrid',
    label: 'Niro Hybrid',
    fuel: 'hybrid',
    powertrains: ['hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'compact_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  sportage: {
    modelKey: 'sportage',
    label: 'Sportage',
    fuel: 'multi',
    powertrains: ['verbrenner', 'hybrid', 'plugin-hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  'sportage-hybrid': {
    modelKey: 'sportage-hybrid',
    label: 'Sportage Hybrid',
    fuel: 'hybrid',
    powertrains: ['hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  'sportage-phev': {
    modelKey: 'sportage-phev',
    label: 'Sportage Plug-in Hybrid',
    fuel: 'plugin_hybrid',
    powertrains: ['plugin-hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'family_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  sorento: {
    modelKey: 'sorento',
    label: 'Sorento',
    fuel: 'multi',
    powertrains: ['verbrenner', 'hybrid', 'plugin-hybrid'],
    seats: 7,
    isSevenSeater: true,
    bodyClass: 'large_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  'sorento-hybrid': {
    modelKey: 'sorento-hybrid',
    label: 'Sorento Hybrid',
    fuel: 'hybrid',
    powertrains: ['hybrid'],
    seats: 7,
    isSevenSeater: true,
    bodyClass: 'large_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  'sorento-phev': {
    modelKey: 'sorento-phev',
    label: 'Sorento Plug-in Hybrid',
    fuel: 'plugin_hybrid',
    powertrains: ['plugin-hybrid'],
    seats: 7,
    isSevenSeater: true,
    isofixRearCount: 3,
    bodyClass: 'large_suv',
    bodyType: 'suv',
    availableAsElectric: false,
    towCapacityKg: 2500,
  },
  stonic: {
    modelKey: 'stonic',
    label: 'Stonic',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'compact_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  ceed: {
    modelKey: 'ceed',
    label: 'Ceed',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'kombi',
    bodyType: 'kombi',
    availableAsElectric: false,
  },
  xceed: {
    modelKey: 'xceed',
    label: 'XCeed',
    fuel: 'combustion',
    powertrains: ['verbrenner', 'plugin-hybrid'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'kombi',
    bodyType: 'kombi',
    availableAsElectric: false,
  },
  seltos: {
    modelKey: 'seltos',
    label: 'Seltos',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'compact_suv',
    bodyType: 'suv',
    availableAsElectric: false,
  },
  k4: {
    modelKey: 'k4',
    label: 'K4',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'limousine',
    bodyType: 'limousine',
    availableAsElectric: false,
  },
  'pv5-passenger': {
    modelKey: 'pv5-passenger',
    label: 'PV5 Passenger',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'commercial',
    bodyType: 'nutzfahrzeug',
    availableAsElectric: true,
    typicalRangeKm: 412,
  },
  'pv5-cargo': {
    modelKey: 'pv5-cargo',
    label: 'PV5 Cargo',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 2,
    isSevenSeater: false,
    bodyClass: 'commercial',
    bodyType: 'nutzfahrzeug',
    availableAsElectric: true,
    typicalRangeKm: 420,
  },
  'pv5-chassis-cab': {
    modelKey: 'pv5-chassis-cab',
    label: 'PV5 Chassis Cab',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 2,
    isSevenSeater: false,
    bodyClass: 'commercial',
    bodyType: 'nutzfahrzeug',
    availableAsElectric: true,
  },
  'pv5-crew': {
    modelKey: 'pv5-crew',
    label: 'PV5 Crew',
    fuel: 'electric',
    powertrains: ['elektro'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'commercial',
    bodyType: 'nutzfahrzeug',
    availableAsElectric: true,
  },
  'k4-sportswagon': {
    modelKey: 'k4-sportswagon',
    label: 'K4 Sportswagon',
    fuel: 'combustion',
    powertrains: ['verbrenner'],
    seats: 5,
    isSevenSeater: false,
    bodyClass: 'kombi',
    bodyType: 'kombi',
    availableAsElectric: false,
  },
};

export function resolveModelAttributeKey(vehicle = {}) {
  let key = String(vehicle.modelKey ?? vehicle.imageModel ?? '').toLowerCase();
  if (!key && vehicle.model) {
    const fromModel = String(vehicle.model).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (KIA_MODEL_ATTRIBUTES[fromModel]) return fromModel;
    key = fromModel;
  }
  if (key.startsWith('ev3')) return 'ev3';
  if (key.startsWith('ev2')) return 'ev2';
  if (key.startsWith('ev4')) return key.includes('fastback') ? 'ev4-fastback' : 'ev4';
  if (key.startsWith('ev5')) return key.includes('gt') ? 'ev5-gt' : 'ev5';
  if (key.startsWith('ev6')) return key.includes('gt') ? 'ev6-gt' : 'ev6';
  if (key.startsWith('ev9')) return key.includes('gt') ? 'ev9-gt' : 'ev9';
  if (key.startsWith('niro')) return key.includes('hybrid') ? 'niro-hybrid' : 'niro';
  if (key.startsWith('sportage')) {
    if (vehicle.powertrain === 'plugin-hybrid') return 'sportage-phev';
    if (vehicle.powertrain === 'hybrid') return 'sportage-hybrid';
    return 'sportage';
  }
  if (key.startsWith('sorento')) {
    if (vehicle.powertrain === 'plugin-hybrid') return 'sorento-phev';
    if (vehicle.powertrain === 'hybrid') return 'sorento-hybrid';
    return 'sorento';
  }
  if (key.startsWith('pv5')) {
    if (key.includes('cargo')) return 'pv5-cargo';
    if (key.includes('chassis')) return 'pv5-chassis-cab';
    if (key.includes('crew')) return 'pv5-crew';
    return 'pv5-passenger';
  }
  return key || null;
}

export function getKiaModelAttributes(vehicle = {}) {
  const key = resolveModelAttributeKey(vehicle);
  if (key && KIA_MODEL_ATTRIBUTES[key]) return KIA_MODEL_ATTRIBUTES[key];
  return inferModelAttributesFromVehicle(vehicle);
}

function inferModelAttributesFromVehicle(vehicle) {
  const powertrain = vehicle.powertrain ?? 'verbrenner';
  const fuel = powertrain === 'elektro' ? 'electric' : powertrain;
  return {
    modelKey: vehicle.modelKey ?? 'unknown',
    label: vehicle.model ?? 'Unbekannt',
    fuel,
    powertrains: [powertrain],
    seats: vehicle.seats ?? 5,
    isSevenSeater: (vehicle.seats ?? 5) >= 7,
    bodyClass: vehicle.bodyType === 'kleinwagen' ? 'kleinwagen' : 'compact_suv',
    bodyType: vehicle.bodyType ?? 'suv',
    availableAsElectric: powertrain === 'elektro',
  };
}

/** Reichert Fahrzeug mit Stammdaten an (für Filter & Rule Engine). */
export function enrichVehicleWithModelAttributes(vehicle = {}) {
  const facts = getKiaModelAttributes(vehicle);
  return {
    ...vehicle,
    seats: facts.seats,
    isSevenSeater: facts.isSevenSeater,
    modelFacts: facts,
  };
}

export function vehicleFuelTruth(vehicle = {}) {
  const pt = vehicle.powertrain ?? vehicle.modelFacts?.powertrains?.[0];
  if (pt === 'elektro') return FUEL_TRUTH.electric;
  if (pt === 'hybrid') return FUEL_TRUTH.hybrid;
  if (pt === 'plugin-hybrid') return FUEL_TRUTH.plugin_hybrid;
  return FUEL_TRUTH.combustion;
}

export const KIA_ELECTRIC_MODEL_KEYS = Object.values(KIA_MODEL_ATTRIBUTES)
  .filter((m) => m.availableAsElectric)
  .map((m) => m.modelKey);

export const KIA_SEVEN_SEATER_MODEL_KEYS = Object.values(KIA_MODEL_ATTRIBUTES)
  .filter((m) => m.isSevenSeater)
  .map((m) => m.modelKey);
