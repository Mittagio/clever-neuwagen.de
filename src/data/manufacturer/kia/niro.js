/**
 * Kia Niro Hybrid – Herstellerdatenmodell
 * Quelle: Kia-Germany-Niro-HEV-Preisliste.pdf (2026-05-29)
 */
export const kiaNiro = {
  brand: 'Kia',
  model: 'Niro',
  modelKey: 'niro',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der effiziente Hybrid-SUV',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-Niro-HEV-Preisliste.pdf',
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
      baseEquipment: ['niro-rueckfahrkamera', 'niro-parksensoren-hinten'],
      availablePackages: ['niro-komfort'],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: ['niro-rueckfahrkamera', 'niro-sitzheizung', 'niro-parksensoren-hinten'],
      availablePackages: ['niro-komfort', 'niro-tech'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'niro-rueckfahrkamera',
        'niro-sitzheizung',
        'niro-lenkradheizung',
        'niro-parksensoren-hinten',
      ],
      availablePackages: ['niro-tech', 'niro-drivewise'],
    },
  ],

  packages: [
    {
      id: 'niro-komfort',
      name: 'Komfort-Paket',
      priceGross: 690,
      rateDelta: 7,
      description: 'Sitzheizung, Lenkradheizung',
      features: ['niro-sitzheizung', 'niro-lenkradheizung'],
      availableTrims: ['vision'],
    },
    {
      id: 'niro-tech',
      name: 'Technik-Paket',
      priceGross: 990,
      rateDelta: 10,
      description: 'Navigation, Smart-Key, Totwinkelassistent',
      features: ['niro-navigation', 'niro-totwinkel'],
      availableTrims: ['spirit', 'gt-line'],
    },
    {
      id: 'niro-drivewise',
      name: 'DriveWise-Paket',
      priceGross: 1290,
      rateDelta: 13,
      description: '360° Kamera, Parkassistent',
      features: ['niro-360-kamera'],
      availableTrims: ['gt-line'],
      requiresPackages: ['niro-tech'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'niro-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: ['niro-komfort'] },
    { id: 'niro-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'niro-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'niro-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'niro-navigation', name: 'Navigation', standardInTrims: [], availableViaPackages: ['niro-tech'] },
    { id: 'niro-totwinkel', name: 'Totwinkelassistent', standardInTrims: [], availableViaPackages: ['niro-tech'] },
    { id: 'niro-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['niro-drivewise'] },
  ],

  variants: [
    { id: 'niro-vision', trimId: 'vision', engineId: 'hybrid', priceGross: 33990, baseLeasingRate: 279 },
    { id: 'niro-spirit', trimId: 'spirit', engineId: 'hybrid', priceGross: 36990, baseLeasingRate: 299 },
    { id: 'niro-gt-line', trimId: 'gt-line', engineId: 'hybrid', priceGross: 39990, baseLeasingRate: 329 },
  ],

  engines: [
    { id: 'hybrid', name: '1.6 T-GDI Hybrid', powerKw: 104, powerPs: 141 },
  ],
};

export default kiaNiro;
