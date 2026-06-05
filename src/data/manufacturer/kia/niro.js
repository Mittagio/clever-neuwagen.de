/**
 * Kia Niro Hybrid – Minimal-Registry (offizielle UPE, Paketdetails folgen mit PDF)
 * Quelle: kiaOfficialPriceList.js · WLTP laut kia.com
 */
export const kiaNiro = {
  brand: 'Kia',
  model: 'Niro',
  modelKey: 'niro',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der effiziente Hybrid-SUV',

  admin: {
    status: 'draft',
    priceListSource: 'kia.com/de/broschuere – PDF-Import folgt',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Minimal-Registry',
  },

  trims: [
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: ['niro-rueckfahrkamera'],
      availablePackages: [],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: ['niro-rueckfahrkamera', 'niro-sitzheizung'],
      availablePackages: [],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: ['niro-rueckfahrkamera', 'niro-sitzheizung', 'niro-lenkradheizung'],
      availablePackages: [],
    },
  ],

  packages: [],

  accessories: [],

  equipment: [
    { id: 'niro-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'niro-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'niro-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'niro-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: [] },
    { id: 'niro-waermepumpe', name: 'Wärmepumpe', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['vision', 'spirit', 'gt-line'] },
  ],

  variants: [
    { id: 'niro-vision', trimId: 'vision', engineId: 'hybrid', priceGross: 33990, baseLeasingRate: 279 },
    { id: 'niro-spirit', trimId: 'spirit', engineId: 'hybrid', priceGross: 36990, baseLeasingRate: 299 },
    { id: 'niro-gt-line', trimId: 'gt-line', engineId: 'hybrid', priceGross: 39990, baseLeasingRate: 329 },
  ],

  engines: [
    { id: 'hybrid', name: '1.6 T-GDI Hybrid', powerKw: 104 },
  ],
};

export default kiaNiro;
