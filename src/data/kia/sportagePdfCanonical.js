/**
 * Kia Sportage – kanonische PDF-Daten (Kia-Germany-Sportage-Preisliste.pdf)
 * Manuell aus Preistabelle Seite 4 verifiziert · Stand 2026-05-29
 */
export const SPORTAGE_PDF_META = {
  sourceFile: 'Kia-Germany-Sportage-Preisliste.pdf',
  priceListDate: '2026-05-29',
  priceFromGross: 33990,
};

/** @param {number} gross */
export function priceNetFromGross(gross) {
  return Math.round((gross / 1.19) * 100) / 100;
}

export const SPORTAGE_PDF_VARIANTS = [
  { engineId: 'tgi-mt-2wd', trimId: 'core', priceGross: 33990 },
  { engineId: 'tgi-mt-2wd', trimId: 'vision', priceGross: 35640 },
  { engineId: 'tgi-mt-2wd', trimId: 'spirit', priceGross: 39440 },
  { engineId: 'tgi-dct-2wd', trimId: 'vision', priceGross: 37640 },
  { engineId: 'tgi-dct-2wd', trimId: 'spirit', priceGross: 41840 },
  { engineId: 'tgi-dct-2wd', trimId: 'black-edition', priceGross: 42550 },
  { engineId: 'tgi-dct-2wd', trimId: 'gt-line', priceGross: 45340 },
  { engineId: 'tgi-dct-awd', trimId: 'vision', priceGross: 40540 },
  { engineId: 'tgi-dct-awd', trimId: 'spirit', priceGross: 44740 },
  { engineId: 'tgi-dct-awd', trimId: 'black-edition', priceGross: 45450 },
  { engineId: 'tgi-dct-awd', trimId: 'gt-line', priceGross: 48240 },
  { engineId: 'tgi-hybrid-2wd', trimId: 'core', priceGross: 38990 },
  { engineId: 'tgi-hybrid-2wd', trimId: 'vision', priceGross: 40990 },
  { engineId: 'tgi-hybrid-2wd', trimId: 'spirit', priceGross: 45190 },
  { engineId: 'tgi-hybrid-2wd', trimId: 'black-edition', priceGross: 45900 },
  { engineId: 'tgi-hybrid-2wd', trimId: 'gt-line', priceGross: 48690 },
  { engineId: 'tgi-hybrid-awd', trimId: 'vision', priceGross: 43490 },
  { engineId: 'tgi-hybrid-awd', trimId: 'spirit', priceGross: 47690 },
  { engineId: 'tgi-hybrid-awd', trimId: 'black-edition', priceGross: 48400 },
  { engineId: 'tgi-hybrid-awd', trimId: 'gt-line', priceGross: 51190 },
  { engineId: 'crdi-mt-2wd', trimId: 'vision', priceGross: 37840 },
  { engineId: 'crdi-dct-2wd', trimId: 'vision', priceGross: 39840 },
  { engineId: 'crdi-dct-2wd', trimId: 'spirit', priceGross: 44040 },
  { engineId: 'crdi-dct-2wd', trimId: 'gt-line', priceGross: 47540 },
].map((v) => ({
  id: `sportage-${v.engineId}-${v.trimId}`,
  ...v,
  priceNet: Math.round(priceNetFromGross(v.priceGross)),
  available: true,
  deliveryTypeDefault: v.engineId.includes('hybrid') && v.trimId === 'spirit' ? 'lager' : 'konfigurierbar',
}));

export const SPORTAGE_PDF_WLTP = {
  'tgi-mt-2wd': { consumptionCombined: '7,2 l/100 km', co2: 164, co2Class: 'F' },
  'tgi-dct-2wd': { consumptionCombined: '7,3 l/100 km', co2: 165, co2Class: 'F' },
  'tgi-dct-awd': { consumptionCombined: '7,8 l/100 km', co2: 177, co2Class: 'G' },
  'tgi-hybrid-2wd': { consumptionCombined: '5,8 l/100 km', co2: 132, co2Class: 'D' },
  'tgi-hybrid-awd': { consumptionCombined: '6,5 l/100 km', co2: 147, co2Class: 'E' },
  'crdi-mt-2wd': { consumptionCombined: '5,1 l/100 km', co2: 133, co2Class: 'D' },
  'crdi-dct-2wd': { consumptionCombined: '5,5 l/100 km', co2: 145, co2Class: 'E' },
};

export const SPORTAGE_PDF_PACKAGE_PRICES = {
  'p1-comfort': 990,
  'p2-leather': 1390,
  'p3-sound': 690,
  'p4-panorama': 1200,
  'p5-drivewise': 1890,
  'p6-drivewise-be': 990,
};

export const SPORTAGE_PDF_ACCESSORY_PRICES = {
  'acc-anhaenger': 860,
  'acc-standheizung': 2350,
  'acc-induktion': 175,
  'acc-kofferraum-led': 155,
  'acc-abgasanlage': 2485,
  'acc-proj-kia': 140,
  'acc-proj-gt': 165,
  'acc-hauben-lifter': 95,
  'acc-protection': 160,
};

export const SPORTAGE_PDF_COLOR_PRICES = {
  carraraweiss: 0,
  blueflame: 790,
  'experience-green': 790,
  lunarsilber: 790,
  magmarot: 790,
  pentametal: 790,
  wolfgrau: 790,
  zilinaschwarz: 790,
  deluxeweiss: 990,
  'carraraweiss-schwarz': 500,
  'blueflame-schwarz': 1290,
  'experience-green-schwarz': 1290,
  'lunarsilber-schwarz': 1290,
  'magmarot-schwarz': 1290,
  'pentametal-schwarz': 1290,
  'wolfgrau-schwarz': 1290,
  'deluxeweiss-schwarz': 1290,
};
