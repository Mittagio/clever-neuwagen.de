/**
 * Kia Technische Stammdaten – Abmessungen, Reichweite, WLTP-Referenz
 * Quelle: Kia Deutschland Modellseiten / Preislisten (Stand 2026-05)
 * @typedef {{ lengthMm: number, widthMm: number, heightMm: number, wheelbaseMm: number, trunkL?: number, electricRangeKm?: number|null, wltpSummary?: string }} KiaTechnicalSpec
 */

/** @type {Record<string, KiaTechnicalSpec>} */
export const KIA_TECHNICAL_SPECS = {
  picanto: {
    lengthMm: 3595,
    widthMm: 1595,
    heightMm: 1485,
    wheelbaseMm: 2400,
    trunkL: 255,
  },
  stonic: {
    lengthMm: 4165,
    widthMm: 1760,
    heightMm: 1495,
    wheelbaseMm: 2580,
    trunkL: 352,
  },
  xceed: {
    lengthMm: 4395,
    widthMm: 1825,
    heightMm: 1490,
    wheelbaseMm: 2650,
    trunkL: 426,
  },
  k4: {
    lengthMm: 4545,
    widthMm: 1800,
    heightMm: 1450,
    wheelbaseMm: 2720,
    trunkL: 490,
  },
  'k4-sportswagon': {
    lengthMm: 4545,
    widthMm: 1800,
    heightMm: 1465,
    wheelbaseMm: 2720,
    trunkL: 543,
  },
  ceed: {
    lengthMm: 4310,
    widthMm: 1800,
    heightMm: 1455,
    wheelbaseMm: 2650,
    trunkL: 395,
  },
  seltos: {
    lengthMm: 4365,
    widthMm: 1800,
    heightMm: 1620,
    wheelbaseMm: 2610,
    trunkL: 498,
  },
  sportage: {
    lengthMm: 4515,
    widthMm: 1865,
    heightMm: 1645,
    wheelbaseMm: 2680,
    trunkL: 587,
  },
  'sportage-phev': {
    lengthMm: 4515,
    widthMm: 1865,
    heightMm: 1645,
    wheelbaseMm: 2680,
    trunkL: 527,
    electricRangeKm: 67,
  },
  'sportage-hybrid': {
    lengthMm: 4515,
    widthMm: 1865,
    heightMm: 1645,
    wheelbaseMm: 2680,
    trunkL: 587,
  },
  sorento: {
    lengthMm: 4815,
    widthMm: 1900,
    heightMm: 1700,
    wheelbaseMm: 2815,
    trunkL: 616,
  },
  'sorento-hybrid': {
    lengthMm: 4815,
    widthMm: 1900,
    heightMm: 1700,
    wheelbaseMm: 2815,
    trunkL: 616,
  },
  'sorento-phev': {
    lengthMm: 4815,
    widthMm: 1900,
    heightMm: 1700,
    wheelbaseMm: 2815,
    trunkL: 616,
    electricRangeKm: 57,
  },
  'niro-hybrid': {
    lengthMm: 4420,
    widthMm: 1825,
    heightMm: 1545,
    wheelbaseMm: 2720,
    trunkL: 451,
  },
  niro: {
    lengthMm: 4420,
    widthMm: 1825,
    heightMm: 1545,
    wheelbaseMm: 2720,
    trunkL: 451,
  },
  ev2: {
    lengthMm: 3995,
    widthMm: 1770,
    heightMm: 1550,
    wheelbaseMm: 2580,
    trunkL: 332,
    electricRangeKm: 350,
  },
  ev3: {
    lengthMm: 4300,
    widthMm: 1850,
    heightMm: 1560,
    wheelbaseMm: 2680,
    trunkL: 460,
    electricRangeKm: 605,
  },
  ev4: {
    lengthMm: 4730,
    widthMm: 1820,
    heightMm: 1450,
    wheelbaseMm: 2820,
    trunkL: 490,
    electricRangeKm: 594,
  },
  'ev4-fastback': {
    lengthMm: 4730,
    widthMm: 1820,
    heightMm: 1480,
    wheelbaseMm: 2820,
    trunkL: 435,
    electricRangeKm: 610,
  },
  ev5: {
    lengthMm: 4695,
    widthMm: 1890,
    heightMm: 1710,
    wheelbaseMm: 2900,
    trunkL: 513,
    electricRangeKm: 530,
  },
  'ev5-gt': {
    lengthMm: 4695,
    widthMm: 1890,
    heightMm: 1710,
    wheelbaseMm: 2900,
    trunkL: 513,
    electricRangeKm: 480,
  },
  ev6: {
    lengthMm: 4695,
    widthMm: 1890,
    heightMm: 1550,
    wheelbaseMm: 2900,
    trunkL: 490,
    electricRangeKm: 528,
  },
  'ev6-gt': {
    lengthMm: 4695,
    widthMm: 1895,
    heightMm: 1550,
    wheelbaseMm: 2900,
    trunkL: 490,
    electricRangeKm: 450,
  },
  ev9: {
    lengthMm: 5010,
    widthMm: 1980,
    heightMm: 1755,
    wheelbaseMm: 3100,
    trunkL: 571,
    electricRangeKm: 541,
  },
  'ev9-gt': {
    lengthMm: 5010,
    widthMm: 1980,
    heightMm: 1755,
    wheelbaseMm: 3100,
    trunkL: 571,
    electricRangeKm: 505,
  },
  'pv5-passenger': {
    lengthMm: 4695,
    widthMm: 1895,
    heightMm: 1895,
    wheelbaseMm: 2995,
    trunkL: 1200,
    electricRangeKm: 412,
  },
  'pv5-cargo': {
    lengthMm: 4695,
    widthMm: 1895,
    heightMm: 1895,
    wheelbaseMm: 2995,
    trunkL: 4200,
    electricRangeKm: 420,
  },
  'pv5-chassis-cab': {
    lengthMm: 4695,
    widthMm: 1895,
    heightMm: 1895,
    wheelbaseMm: 2995,
    electricRangeKm: 400,
  },
  'pv5-crew': {
    lengthMm: 4695,
    widthMm: 1895,
    heightMm: 1895,
    wheelbaseMm: 2995,
    trunkL: 900,
    electricRangeKm: 400,
  },
};

/** @param {string} modelKey */
export function getKiaTechnicalSpec(modelKey = '') {
  const key = String(modelKey).toLowerCase();
  if (KIA_TECHNICAL_SPECS[key]) return KIA_TECHNICAL_SPECS[key];
  if (key.startsWith('ev4')) return key.includes('fastback') ? KIA_TECHNICAL_SPECS['ev4-fastback'] : KIA_TECHNICAL_SPECS.ev4;
  if (key.startsWith('ev5')) return KIA_TECHNICAL_SPECS[key.includes('gt') ? 'ev5-gt' : 'ev5'];
  if (key.startsWith('ev6')) return KIA_TECHNICAL_SPECS[key.includes('gt') ? 'ev6-gt' : 'ev6'];
  if (key.startsWith('ev9')) return KIA_TECHNICAL_SPECS[key.includes('gt') ? 'ev9-gt' : 'ev9'];
  if (key.startsWith('sorento')) return KIA_TECHNICAL_SPECS.sorento;
  if (key.includes('sportage')) {
    if (key.includes('phev')) return KIA_TECHNICAL_SPECS['sportage-phev'];
    if (key.includes('hybrid')) return KIA_TECHNICAL_SPECS['sportage-hybrid'];
    return KIA_TECHNICAL_SPECS.sportage;
  }
  if (key.startsWith('pv5')) {
    if (key.includes('cargo')) return KIA_TECHNICAL_SPECS['pv5-cargo'];
    if (key.includes('chassis')) return KIA_TECHNICAL_SPECS['pv5-chassis-cab'];
    if (key.includes('crew')) return KIA_TECHNICAL_SPECS['pv5-crew'];
    return KIA_TECHNICAL_SPECS['pv5-passenger'];
  }
  return null;
}
