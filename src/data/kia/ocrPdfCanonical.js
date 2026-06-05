/**
 * OCR-/Encoding-kaputte Kia-PDFs – manuell verifizierte Preistabellen
 * Quelle: kia.com PDF-Preislisten (MY2027) · Stand 2026-05-29
 */

/** @param {number} gross */
export function priceNetFromGross(gross) {
  return Math.round((gross / 1.19) * 100) / 100;
}

/** @param {Array<{trimId:string,trim:string,priceGross:number,engine?:string,drive?:string,power?:string}>} rows */
function mapVariants(rows) {
  return rows.map((v) => ({
    trim: v.trim,
    trimId: v.trimId,
    priceNet: priceNetFromGross(v.priceGross),
    priceGross: v.priceGross,
    engine: v.engine ?? '',
    transmission: v.transmission ?? '',
    drive: v.drive ?? '',
    power: v.power ?? '',
    consumption: v.consumption ?? '',
    co2: v.co2 ?? '',
    co2Class: v.co2Class ?? '',
  }));
}

export const SORENTO_DIESEL_VARIANTS = mapVariants([
  { trimId: 'vision', trim: 'Vision', priceGross: 56690, engine: '2.2 CRDi Diesel DCT8', drive: 'AWD', power: '142 kW (194 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 61690, engine: '2.2 CRDi Diesel DCT8', drive: 'AWD', power: '142 kW (194 PS)' },
  { trimId: 'platinum', trim: 'Platinum', priceGross: 65690, engine: '2.2 CRDi Diesel DCT8', drive: 'AWD', power: '142 kW (194 PS)' },
]);

export const SORENTO_HYBRID_VARIANTS = mapVariants([
  { trimId: 'vision', trim: 'Vision', priceGross: 55190, engine: '1.6 T-GDI Hybrid', transmission: 'Automatik', drive: '2WD', power: '176 kW (239 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 60190, engine: '1.6 T-GDI Hybrid', transmission: 'Automatik', drive: '2WD', power: '176 kW (239 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 57190, engine: '1.6 T-GDI Hybrid', transmission: 'Automatik', drive: 'AWD', power: '176 kW (239 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 62190, engine: '1.6 T-GDI Hybrid', transmission: 'Automatik', drive: 'AWD', power: '176 kW (239 PS)' },
  { trimId: 'platinum', trim: 'Platinum', priceGross: 65690, engine: '1.6 T-GDI Hybrid', transmission: 'Automatik', drive: 'AWD', power: '176 kW (239 PS)' },
]);

export const SORENTO_PHEV_VARIANTS = mapVariants([
  { trimId: 'vision', trim: 'Vision', priceGross: 61140, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 66140, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
  { trimId: 'platinum', trim: 'Platinum', priceGross: 69640, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
]);

export const K4_SPORTSWAGON_VARIANTS = mapVariants([
  { trimId: 'core', trim: 'Core', priceGross: 29890, engine: '1.0 T-GDI', transmission: 'Schaltgetriebe', power: '85 kW (115 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 31890, engine: '1.0 T-GDI', transmission: 'Schaltgetriebe', power: '85 kW (115 PS)' },
  { trimId: 'core', trim: 'Core', priceGross: 31890, engine: '1.0 T-GDI 48V', transmission: 'DCT7', power: '85 kW (115 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 34090, engine: '1.0 T-GDI 48V', transmission: 'DCT7', power: '85 kW (115 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 35390, engine: '1.6 T-GDI', transmission: 'DCT7', power: '110 kW (150 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 37490, engine: '1.6 T-GDI', transmission: 'DCT7', power: '110 kW (150 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 38890, engine: '1.6 T-GDI', transmission: 'DCT7', power: '110 kW (150 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 38490, engine: '1.6 T-GDI', transmission: 'DCT7', power: '132 kW (180 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 39890, engine: '1.6 T-GDI', transmission: 'DCT7', power: '132 kW (180 PS)' },
]);

export const EV6_VARIANTS = mapVariants([
  { trimId: 'air', trim: 'Air', priceGross: 44990, engine: '63-kWh-Batterie', drive: 'RWD', power: '125 kW (170 PS)' },
  { trimId: 'earth', trim: 'Earth', priceGross: 47190, engine: '63-kWh-Batterie', drive: 'RWD', power: '125 kW (170 PS)' },
  { trimId: 'air', trim: 'Air', priceGross: 49990, engine: '84-kWh-Batterie', drive: 'RWD', power: '168 kW (229 PS)' },
  { trimId: 'earth', trim: 'Earth', priceGross: 52190, engine: '84-kWh-Batterie', drive: 'RWD', power: '168 kW (229 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 57890, engine: '84-kWh-Batterie', drive: 'RWD', power: '168 kW (229 PS)' },
  { trimId: 'air', trim: 'Air', priceGross: 53990, engine: '84-kWh-Batterie', drive: 'AWD', power: '239 kW (325 PS)' },
  { trimId: 'earth', trim: 'Earth', priceGross: 56190, engine: '84-kWh-Batterie', drive: 'AWD', power: '239 kW (325 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 61890, engine: '84-kWh-Batterie', drive: 'AWD', power: '239 kW (325 PS)' },
]);

export const PICANTO_VARIANTS = mapVariants([
  { trimId: 'core', trim: 'Core', priceGross: 17590, engine: '1.0 MPI (50 kW/68 PS), Schaltgetriebe MT5, 4 Sitze', transmission: 'MT5', power: '50 kW (68 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 18550, engine: '1.0 MPI (50 kW/68 PS), Schaltgetriebe MT5, 4 Sitze', transmission: 'MT5', power: '50 kW (68 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 20750, engine: '1.0 MPI (50 kW/68 PS), Schaltgetriebe MT5, 5 Sitze', transmission: 'MT5', power: '50 kW (68 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 21750, engine: '1.0 MPI (50 kW/68 PS), Schaltgetriebe MT5, 5 Sitze', transmission: 'MT5', power: '50 kW (68 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 19550, engine: '1.0 MPI (50 kW/68 PS), Automatik AMT, 4 Sitze', transmission: 'AMT', power: '50 kW (68 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 21750, engine: '1.0 MPI (50 kW/68 PS), Automatik AMT, 5 Sitze', transmission: 'AMT', power: '50 kW (68 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 22750, engine: '1.0 MPI (50 kW/68 PS), Automatik AMT, 5 Sitze', transmission: 'AMT', power: '50 kW (68 PS)' },
]);

export const SPORTAGE_PHEV_IMPORT_VARIANTS = mapVariants([
  { trimId: 'core', trim: 'Core', priceGross: 43100, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: '2WD', power: '212 kW (288 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 45100, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: '2WD', power: '212 kW (288 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 49300, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: '2WD', power: '212 kW (288 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 52500, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: '2WD', power: '212 kW (288 PS)' },
  { trimId: 'vision', trim: 'Vision', priceGross: 47600, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
  { trimId: 'spirit', trim: 'Spirit', priceGross: 51800, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
  { trimId: 'gt-line', trim: 'GT-Line', priceGross: 55000, engine: '1.6 T-GDI Plug-in Hybrid', transmission: 'Automatik', drive: 'AWD', power: '212 kW (288 PS)' },
]);

/** Für scripts/parse-kia-pricelists.py → manual-supplements.json */
export const OCR_PDF_SUPPLEMENTS = {
  picanto: {
    replace: true,
    variants: PICANTO_VARIANTS,
    trims: [
      { id: 'core', name: 'Core' },
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'gt-line', name: 'GT-Line' },
    ],
  },
  'sportage-phev': {
    replace: true,
    variants: SPORTAGE_PHEV_IMPORT_VARIANTS,
    trims: [
      { id: 'core', name: 'Core' },
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'gt-line', name: 'GT-Line' },
    ],
  },
  sorento: {
    variants: SORENTO_DIESEL_VARIANTS,
    trims: [
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'platinum', name: 'Platinum' },
    ],
  },
  'sorento-hybrid': {
    variants: SORENTO_HYBRID_VARIANTS,
    trims: [
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'platinum', name: 'Platinum' },
    ],
  },
  'sorento-phev': {
    variants: SORENTO_PHEV_VARIANTS,
    trims: [
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'platinum', name: 'Platinum' },
    ],
  },
  'k4-sportswagon': {
    variants: K4_SPORTSWAGON_VARIANTS,
    trims: [
      { id: 'core', name: 'Core' },
      { id: 'vision', name: 'Vision' },
      { id: 'spirit', name: 'Spirit' },
      { id: 'gt-line', name: 'GT-Line' },
    ],
  },
  ev6: {
    variants: EV6_VARIANTS,
    trims: [
      { id: 'air', name: 'Air' },
      { id: 'earth', name: 'Earth' },
      { id: 'gt-line', name: 'GT-Line' },
    ],
  },
};
