/**
 * Kia Ceed – Minimal-Registry (Demo/Marketplace; volle PDF folgt)
 * XCeed-Preisliste als Referenz für Kompakt-Segment
 */
export const kiaCeed = {
  brand: 'Kia',
  model: 'Ceed',
  modelKey: 'ceed',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der kompakte Allrounder',

  admin: {
    status: 'draft',
    priceListSource: 'kia.com Modellseite – PDF-Import folgt',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Minimal-Registry',
  },

  trims: [
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: ['ceed-rueckfahrkamera'],
      availablePackages: [],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: ['ceed-rueckfahrkamera', 'ceed-sitzheizung'],
      availablePackages: [],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: ['ceed-rueckfahrkamera', 'ceed-sitzheizung', 'ceed-lenkradheizung'],
      availablePackages: [],
    },
  ],

  packages: [],

  accessories: [],

  equipment: [
    { id: 'ceed-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'ceed-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ceed-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'ceed-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: [] },
  ],

  variants: [
    { id: 'ceed-vision', trimId: 'vision', engineId: 't-gdi', priceGross: 28990, baseLeasingRate: 239 },
    { id: 'ceed-spirit', trimId: 'spirit', engineId: 't-gdi', priceGross: 31990, baseLeasingRate: 259 },
    { id: 'ceed-gt-line', trimId: 'gt-line', engineId: 't-gdi', priceGross: 34990, baseLeasingRate: 279 },
  ],

  engines: [
    { id: 't-gdi', name: '1.5 T-GDI', powerKw: 118 },
  ],
};

export default kiaCeed;
