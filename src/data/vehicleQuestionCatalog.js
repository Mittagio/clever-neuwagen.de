/**
 * Fragenkatalog – häufige Fahrzeugfragen → Intent → Stammdaten-Feld.
 * Kein LLM: Muster + Fahrzeugdatenbank.
 *
 * @typedef {import('../services/search/vehicleQueryIntent.js').VehicleFactField} VehicleFactField
 * @typedef {{
 *   id: string,
 *   category: string,
 *   factField: VehicleFactField,
 *   patterns: RegExp[],
 * }} VehicleQuestionIntent
 */

/** @type {VehicleQuestionIntent[]} */
export const VEHICLE_QUESTION_INTENTS = [
  {
    id: 'battery_size',
    category: 'Batterie',
    factField: 'batteryKwh',
    patterns: [
      /wie\s+gro[sß]\s+ist\s+die\s+batterie/i,
      /welche\s+batterie/i,
      /wie\s+viele\s+kwh/i,
      /akkugr[oö][sß]e/i,
      /\bbatteriekapazit[aä]t\b/i,
      /\bbatterie\b/i,
      /\bakku\b/i,
      /\bkwh\b/i,
    ],
  },
  {
    id: 'range',
    category: 'Reichweite',
    factField: 'wltpRange',
    patterns: [
      /wie\s+weit\s+kommt/i,
      /\breichweite\b/i,
      /schaffe\s+ich\s+\d+\s*km/i,
      /wie\s+viele\s+kilometer/i,
      /\bwlpt\b/i,
      /\b500\s*km\b/i,
    ],
  },
  {
    id: 'dimensions_length',
    category: 'Maße',
    factField: 'length',
    patterns: [/wie\s+lang\b/i, /\bl[aä]nge\b/i],
  },
  {
    id: 'dimensions_width',
    category: 'Maße',
    factField: 'width',
    patterns: [/wie\s+breit\b/i, /\bbreite\b/i],
  },
  {
    id: 'dimensions_height',
    category: 'Maße',
    factField: 'height',
    patterns: [
      /wie\s+hoch\b/i,
      /\bh[oö]he\b/i,
      /passt\s+er\s+in\s+(meine\s+)?garage/i,
      /garage\s+2\s*m/i,
    ],
  },
  {
    id: 'dimensions_overview',
    category: 'Maße',
    factField: 'dimensionsOverview',
    patterns: [/wie\s+gro[sß]\s+ist\s+der/i, /\bmaße\b/i, /\babmessungen\b/i],
  },
  {
    id: 'trunk_size',
    category: 'Kofferraum',
    factField: 'trunkVolume',
    patterns: [
      /kofferraum/i,
      /kinderwagen/i,
      /wie\s+viele\s+liter/i,
      /kofferraumvolumen/i,
      /\bladeraum\b/i,
    ],
  },
  {
    id: 'towing_capacity',
    category: 'Anhängelast',
    factField: 'towingCapacity',
    patterns: [
      /was\s+darf\s+er\s+ziehen/i,
      /anh[aä]ngelast/i,
      /wohnwagen/i,
      /pferdeanh[aä]nger/i,
      /\bahk\b/i,
      /anhänger\s+geeignet/i,
    ],
  },
  {
    id: 'roof_load',
    category: 'Dachlast',
    factField: 'roofLoad',
    patterns: [/\bdachlast\b/i, /dachbox/i, /fahrradtr[aä]ger/i],
  },
  {
    id: 'charging',
    category: 'Laden',
    factField: 'charging',
    patterns: [
      /wie\s+schnell\s+l[aä]dt/i,
      /\bac-?laden\b/i,
      /\bdc-?laden\b/i,
      /schnellladen/i,
      /ladezeit/i,
      /ladeleistung/i,
    ],
  },
  {
    id: 'seats',
    category: 'Sitze',
    factField: 'seats',
    patterns: [
      /\b7\s*-?\s*sitz/i,
      /\b6\s*-?\s*sitz/i,
      /wie\s+viele\s+(sitze|personen|plätze)/i,
      /\bsitze\b/i,
      /\bsitzer\b/i,
    ],
  },
  {
    id: 'isofix',
    category: 'Isofix',
    factField: 'isofix',
    patterns: [/\bisofix\b/i, /kindersitz/i],
  },
  {
    id: 'heat_pump',
    category: 'Wärmepumpe',
    factField: 'heatPump',
    patterns: [/w[aä]rmepumpe/i],
  },
  {
    id: 'v2l',
    category: 'V2L',
    factField: 'v2l',
    patterns: [/\bv2l\b/i, /vehicle\s+to\s+load/i, /steckdose\s+auto/i],
  },
  {
    id: 'voltage_800v',
    category: '800 Volt',
    factField: 'voltage800v',
    patterns: [/800\s*v/i, /800-?volt/i],
  },
  {
    id: 'camera_360',
    category: '360° Kamera',
    factField: 'camera360',
    patterns: [/360\s*°?\s*kamera/i, /rundumsicht/i],
  },
  {
    id: 'hud',
    category: 'Head-Up Display',
    factField: 'hud',
    patterns: [/head-?up/i, /\bhud\b/i],
  },
  {
    id: 'matrix_led',
    category: 'Matrix LED',
    factField: 'matrixLed',
    patterns: [/matrix\s*led/i],
  },
  {
    id: 'panorama_roof',
    category: 'Panoramadach',
    factField: 'panoramaRoof',
    patterns: [/panorama/i, /schiebedach/i, /glasschiebedach/i],
  },
  {
    id: 'leather',
    category: 'Leder',
    factField: 'leather',
    patterns: [/\bleder\b/i, /lederausstattung/i],
  },
  {
    id: 'warranty',
    category: 'Garantie',
    factField: 'warranty',
    patterns: [/\bgarantie\b/i, /hersteller-garantie/i],
  },
  {
    id: 'delivery_time',
    category: 'Lieferzeit',
    factField: 'deliveryTime',
    patterns: [/lieferzeit/i, /wann\s+kann\s+ich\s+liefern/i, /sofort\s+verf[uü]gbar/i],
  },
  {
    id: 'consumption',
    category: 'Verbrauch',
    factField: 'consumption',
    patterns: [/verbrauch/i, /\bkwh\/100\b/i, /stromverbrauch/i],
  },
  {
    id: 'power_hp',
    category: 'Leistung',
    factField: 'powerHp',
    patterns: [/\bps\b/i, /leistung/i, /wie\s+stark/i],
  },
  {
    id: 'acceleration',
    category: 'Beschleunigung',
    factField: 'acceleration',
    patterns: [/0\s*[-–]\s*100/i, /beschleunigung/i, /wie\s+schnell\s+von\s+0/i],
  },
  {
    id: 'drive_type',
    category: 'Antrieb',
    factField: 'driveType',
    patterns: [/\ballrad\b/i, /frontantrieb/i, /heckantrieb/i, /\bawd\b/i, /\b2wd\b/i],
  },
  {
    id: 'price',
    category: 'Preis',
    factField: 'price',
    patterns: [/was\s+kostet/i, /\bpreis\b/i, /listenpreis/i],
  },
  {
    id: 'leasing_rate',
    category: 'Leasing',
    factField: 'leasingRate',
    patterns: [/leasingrate/i, /leasing\s+ab/i, /monatliche\s+rate/i, /\bleasing\b/i],
  },
  {
    id: 'finance',
    category: 'Finanzierung',
    factField: 'finance',
    patterns: [/finanzierung/i, /finanzierungsrate/i],
  },
];

/** @type {Record<string, VehicleQuestionIntent>} */
export const VEHICLE_QUESTION_INTENT_BY_ID = Object.fromEntries(
  VEHICLE_QUESTION_INTENTS.map((intent) => [intent.id, intent]),
);
