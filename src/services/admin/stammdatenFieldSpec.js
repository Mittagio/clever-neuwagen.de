/**
 * Admin-Eingabe pro Stammdaten-Feld (offene Kundenfrage → Record-Patch).
 * @typedef {import('../search/vehicleQueryIntent.js').VehicleFactField} VehicleFactField
 */

/** @typedef {'number'|'text'|'select'|'boolean'} StammdatenInputType */

/**
 * @typedef {object} StammdatenFieldSpec
 * @property {string} label
 * @property {StammdatenInputType} inputType
 * @property {string} [unit]
 * @property {string} [placeholder]
 * @property {string[]} [options]
 * @property {(raw: string) => unknown} [parse]
 * @property {(value: unknown) => object} buildPatch
 */

const COMFORT_OPTIONS = ['standard', 'package', 'accessory', 'missing', 'unknown'];

/** @param {string} label @param {string} comfortKey */
function comfortSelectSpec(label, comfortKey) {
  return {
    label,
    inputType: 'select',
    options: COMFORT_OPTIONS,
    parse: (v) => String(v),
    buildPatch: (v) => ({ comfort: { [comfortKey]: v } }),
  };
}

/** @type {Record<VehicleFactField, StammdatenFieldSpec>} */
export const STAMMDATEN_FIELD_SPECS = {
  batteryKwh: {
    label: 'Batterie',
    inputType: 'number',
    unit: 'kWh',
    parse: (v) => Number(String(v).replace(',', '.')),
    buildPatch: (v) => ({ electric: { batteryGrossKwh: v, batteryNetKwh: v } }),
  },
  wltpRange: {
    label: 'WLTP-Reichweite',
    inputType: 'number',
    unit: 'km',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ electric: { wltpRangeKm: v } }),
  },
  length: {
    label: 'Länge',
    inputType: 'number',
    unit: 'mm',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ dimensions: { lengthMm: v } }),
  },
  height: {
    label: 'Höhe',
    inputType: 'number',
    unit: 'mm',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ dimensions: { heightMm: v } }),
  },
  width: {
    label: 'Breite',
    inputType: 'number',
    unit: 'mm',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ dimensions: { widthMm: v } }),
  },
  towingCapacity: {
    label: 'Anhängelast (gebremst)',
    inputType: 'number',
    unit: 'kg',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ towing: { brakedKg: v } }),
  },
  trunkVolume: {
    label: 'Kofferraum',
    inputType: 'number',
    unit: 'Liter',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ family: { trunkL: v } }),
  },
  seats: {
    label: 'Sitze',
    inputType: 'number',
    unit: '',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ family: { seats: v } }),
  },
  price: {
    label: 'Listenpreis',
    inputType: 'number',
    unit: '€',
    parse: (v) => Number(String(v).replace(/\./g, '').replace(',', '.')),
    buildPatch: (v) => ({ basis: { listPriceGross: v } }),
  },
  charging: {
    label: 'DC-Ladezeit 10–80 %',
    inputType: 'number',
    unit: 'Minuten',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ electric: { dcCharge10_80Min: v } }),
  },
  roofLoad: {
    label: 'Dachlast',
    inputType: 'number',
    unit: 'kg',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ towing: { roofLoadKg: v } }),
  },
  isofix: {
    label: 'Isofix hinten (Anzahl)',
    inputType: 'number',
    unit: '',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ family: { isofixRearCount: v, isofixRear: v >= 1 } }),
  },
  heatPump: {
    label: 'Wärmepumpe',
    inputType: 'boolean',
    parse: (v) => v === true || v === 'true' || v === '1',
    buildPatch: (v) => ({ electric: { heatPump: Boolean(v) } }),
  },
  v2l: {
    label: 'V2L',
    inputType: 'boolean',
    parse: (v) => v === true || v === 'true' || v === '1',
    buildPatch: (v) => ({ electric: { v2l: Boolean(v) } }),
  },
  voltage800v: {
    label: '800-Volt-Technik',
    inputType: 'boolean',
    parse: (v) => v === true || v === 'true' || v === '1',
    buildPatch: (v) => ({ electric: { has800V: Boolean(v) } }),
  },
  camera360: comfortSelectSpec('360°-Kamera', 'camera360'),
  hud: comfortSelectSpec('Head-Up Display', 'hud'),
  matrixLed: comfortSelectSpec('Matrix LED', 'matrixLed'),
  panoramaRoof: comfortSelectSpec('Panoramadach', 'panoramaRoof'),
  leather: comfortSelectSpec('Leder', 'leather'),
  warranty: {
    label: 'Garantie',
    inputType: 'number',
    unit: 'Jahre',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ basis: { warrantyYears: v } }),
  },
  deliveryTime: {
    label: 'Lieferzeit',
    inputType: 'text',
    placeholder: 'z. B. 6–8 Wochen',
    parse: (v) => String(v).trim(),
    buildPatch: (v) => ({ basis: { deliveryWeeks: v } }),
  },
  consumption: {
    label: 'Stromverbrauch WLTP',
    inputType: 'number',
    unit: 'kWh/100 km',
    parse: (v) => Number(String(v).replace(',', '.')),
    buildPatch: (v) => ({ performance: { consumptionKwhPer100: v } }),
  },
  powerHp: {
    label: 'Leistung',
    inputType: 'number',
    unit: 'PS',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ performance: { powerPs: v } }),
  },
  acceleration: {
    label: '0–100 km/h',
    inputType: 'number',
    unit: 'Sekunden',
    parse: (v) => Number(String(v).replace(',', '.')),
    buildPatch: (v) => ({ performance: { acceleration0_100Sec: v } }),
  },
  driveType: {
    label: 'Antrieb',
    inputType: 'select',
    options: ['FWD', 'RWD', 'AWD'],
    parse: (v) => String(v),
    buildPatch: (v) => ({ performance: { driveType: v } }),
  },
  leasingRate: {
    label: 'Leasing ab',
    inputType: 'number',
    unit: '€/Monat',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ basis: { leasingRate: v } }),
  },
  finance: {
    label: 'Finanzierung ab',
    inputType: 'number',
    unit: '€/Monat',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ basis: { financeRate: v } }),
  },
  dimensionsOverview: {
    label: 'Länge (für Maß-Übersicht)',
    inputType: 'number',
    unit: 'mm',
    parse: (v) => Number(v),
    buildPatch: (v) => ({ dimensions: { lengthMm: v } }),
  },
};

/**
 * @param {VehicleFactField | null | undefined} field
 * @returns {StammdatenFieldSpec | null}
 */
export function getStammdatenFieldSpec(field) {
  if (!field) return null;
  return STAMMDATEN_FIELD_SPECS[field] ?? null;
}
