/**
 * Kia Sportage Plug-in Hybrid – kanonische PDF-Daten
 * Quelle: Kia-Germany-Sportage-PHEV-Preisliste.pdf · Preistabelle S. 4
 */
import { priceNetFromGross } from './sportagePdfCanonical.js';

export const SPORTAGE_PHEV_PDF_META = {
  sourceFile: 'Kia-Germany-Sportage-PHEV-Preisliste.pdf',
  priceListDate: '2026-05-04',
  priceFromGross: 43100,
};

export const SPORTAGE_PHEV_PDF_VARIANTS = [
  { engineId: 'phev-2wd', trimId: 'core', priceGross: 43100 },
  { engineId: 'phev-2wd', trimId: 'vision', priceGross: 45100 },
  { engineId: 'phev-2wd', trimId: 'spirit', priceGross: 49300 },
  { engineId: 'phev-2wd', trimId: 'gt-line', priceGross: 52500 },
  { engineId: 'phev-awd', trimId: 'vision', priceGross: 47600 },
  { engineId: 'phev-awd', trimId: 'spirit', priceGross: 51800 },
  { engineId: 'phev-awd', trimId: 'gt-line', priceGross: 55000 },
].map((v) => ({
  id: `sportage-phev-${v.engineId}-${v.trimId}`,
  ...v,
  priceNet: priceNetFromGross(v.priceGross),
  available: true,
  deliveryTypeDefault: 'konfigurierbar',
}));

export const SPORTAGE_PHEV_PDF_WLTP = {
  'phev-2wd': {
    consumptionCombined: '2,9 l/100 km (gewichtet)',
    consumptionDepleted: '6,1 l/100 km',
    electricConsumption: '10,9 kWh/100 km',
    co2: 67,
    co2Class: 'B',
    co2ClassDepleted: 'E',
  },
  'phev-awd': {
    consumptionCombined: '3,3 l/100 km (gewichtet)',
    consumptionDepleted: '6,7 l/100 km',
    electricConsumption: '11,2 kWh/100 km',
    co2: 75,
    co2Class: 'B',
    co2ClassDepleted: 'E',
  },
};

/** PHEV: P5 DriveWise 2.090 € (ICE: 1.890 €) */
export const SPORTAGE_PHEV_PDF_PACKAGE_PRICES = {
  'p5-drivewise': 2090,
};
