/**
 * Kia Ceed – Herstellerdatenmodell
 * Quelle: Kia-Germany-Ceed-Preisliste.pdf (2026-05-29)
 */
export const kiaCeed = {
  brand: 'Kia',
  model: 'Ceed',
  modelKey: 'ceed',
  modelYear: '2027',
  priceListDate: '2026-05-29',
  tagline: 'Der kompakte Allrounder',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-Ceed-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  colors: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],

  trims: [
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: ['ceed-rueckfahrkamera', 'ceed-parksensoren-hinten'],
      availablePackages: ['ceed-komfort'],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: ['ceed-rueckfahrkamera', 'ceed-sitzheizung', 'ceed-parksensoren-hinten'],
      availablePackages: ['ceed-komfort', 'ceed-tech'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ceed-rueckfahrkamera',
        'ceed-sitzheizung',
        'ceed-lenkradheizung',
        'ceed-parksensoren-hinten',
      ],
      availablePackages: ['ceed-tech', 'ceed-drivewise'],
    },
  ],

  packages: [
    {
      id: 'ceed-komfort',
      name: 'Komfort-Paket',
      priceGross: 590,
      rateDelta: 6,
      description: 'Sitzheizung, Lenkradheizung',
      features: ['ceed-sitzheizung', 'ceed-lenkradheizung'],
      availableTrims: ['vision'],
    },
    {
      id: 'ceed-tech',
      name: 'Technik-Paket',
      priceGross: 890,
      rateDelta: 9,
      description: 'Navigation, Smart-Key, Totwinkelassistent',
      features: ['ceed-navigation', 'ceed-totwinkel'],
      availableTrims: ['spirit', 'gt-line'],
    },
    {
      id: 'ceed-drivewise',
      name: 'DriveWise-Paket',
      priceGross: 1190,
      rateDelta: 12,
      description: '360° Kamera, Parkassistent',
      features: ['ceed-360-kamera'],
      availableTrims: ['gt-line'],
      requiresPackages: ['ceed-tech'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'ceed-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: ['ceed-komfort'] },
    { id: 'ceed-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ceed-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'ceed-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'ceed-navigation', name: 'Navigation', standardInTrims: [], availableViaPackages: ['ceed-tech'] },
    { id: 'ceed-totwinkel', name: 'Totwinkelassistent', standardInTrims: [], availableViaPackages: ['ceed-tech'] },
    { id: 'ceed-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['ceed-drivewise'] },
  ],

  variants: [
    { id: 'ceed-vision', trimId: 'vision', engineId: 't-gdi', priceGross: 28990, baseLeasingRate: 239 },
    { id: 'ceed-spirit', trimId: 'spirit', engineId: 't-gdi', priceGross: 31990, baseLeasingRate: 259 },
    { id: 'ceed-gt-line', trimId: 'gt-line', engineId: 't-gdi', priceGross: 34990, baseLeasingRate: 279 },
  ],

  engines: [
    { id: 't-gdi', name: '1.5 T-GDI', powerKw: 118, powerPs: 160 },
  ],
};

export default kiaCeed;
