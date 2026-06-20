/**
 * Kia XCeed – Herstellerdatenmodell
 * Quelle: Kia-Germany-XCeed_Pricelist.pdf (2026-05-29)
 */
export const kiaXceed = {
  brand: 'Kia',
  model: 'XCeed',
  modelKey: 'xceed',
  modelYear: '2027',
  priceListDate: '2026-05-29',
  tagline: 'Der Crossover-Kombi',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-XCeed_Pricelist.pdf',
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
      id: 'core',
      name: 'Core',
      baseEquipment: ['xceed-rueckfahrkamera', 'xceed-parksensoren-hinten'],
      availablePackages: [],
    },
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: ['xceed-rueckfahrkamera', 'xceed-parksensoren-hinten', 'xceed-sitzheizung'],
      availablePackages: ['xceed-komfort', 'xceed-tech'],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: [
        'xceed-sitzheizung',
        'xceed-lenkradheizung',
        'xceed-rueckfahrkamera',
        'xceed-parksensoren-hinten',
      ],
      availablePackages: ['xceed-komfort', 'xceed-tech', 'xceed-drivewise'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'xceed-sitzheizung',
        'xceed-lenkradheizung',
        'xceed-totwinkel',
        'xceed-rueckfahrkamera',
        'xceed-parksensoren-hinten',
      ],
      availablePackages: ['xceed-tech', 'xceed-drivewise', 'xceed-sound'],
    },
  ],

  packages: [
    {
      id: 'xceed-komfort',
      name: 'Komfort-Paket',
      priceGross: 590,
      rateDelta: 6,
      description: 'Sitzheizung, Lenkradheizung',
      features: ['xceed-sitzheizung', 'xceed-lenkradheizung'],
      availableTrims: ['vision'],
    },
    {
      id: 'xceed-tech',
      name: 'Technik-Paket',
      priceGross: 890,
      rateDelta: 9,
      description: 'Navigation, Smart-Key, Totwinkelassistent',
      features: ['xceed-navigation', 'xceed-totwinkel'],
      availableTrims: ['vision', 'spirit', 'gt-line'],
    },
    {
      id: 'xceed-drivewise',
      name: 'DriveWise-Paket',
      priceGross: 1190,
      rateDelta: 12,
      description: '360° Kamera, Parkassistent',
      features: ['xceed-360-kamera'],
      availableTrims: ['spirit', 'gt-line'],
      requiresPackages: ['xceed-tech'],
    },
    {
      id: 'xceed-sound',
      name: 'Sound-Paket',
      priceGross: 690,
      rateDelta: 7,
      description: 'Harman Kardon Soundsystem',
      features: ['xceed-harman'],
      availableTrims: ['gt-line'],
      requiresPackages: ['xceed-tech'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'xceed-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: ['xceed-komfort'] },
    { id: 'xceed-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'xceed-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'xceed-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'xceed-navigation', name: 'Navigation', standardInTrims: [], availableViaPackages: ['xceed-tech'] },
    { id: 'xceed-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['xceed-tech'] },
    { id: 'xceed-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['xceed-drivewise'] },
    { id: 'xceed-harman', name: 'Harman Kardon', standardInTrims: [], availableViaPackages: ['xceed-sound'] },
  ],

  variants: [
    { id: 'xceed-core-mt', trimId: 'core', engineId: 'tgi-mt', priceGross: 26990, baseLeasingRate: 229 },
    { id: 'xceed-vision-mt', trimId: 'vision', engineId: 'tgi-mt', priceGross: 28090, baseLeasingRate: 239 },
    { id: 'xceed-core-dct', trimId: 'core', engineId: 'tgi-dct', priceGross: 28990, baseLeasingRate: 249 },
    { id: 'xceed-vision-dct', trimId: 'vision', engineId: 'tgi-dct', priceGross: 30090, baseLeasingRate: 259 },
    { id: 'xceed-spirit-dct', trimId: 'spirit', engineId: 'tgi-dct-150', priceGross: 33490, baseLeasingRate: 279 },
    { id: 'xceed-gt-dct', trimId: 'gt-line', engineId: 'tgi-dct-180', priceGross: 34890, baseLeasingRate: 289 },
  ],

  engines: [
    { id: 'tgi-mt', name: '1.0 T-GDI Schaltgetriebe (MT6)', powerKw: 85, powerPs: 115 },
    { id: 'tgi-dct', name: '1.0 T-GDI Automatik (DCT7)', powerKw: 85, powerPs: 115 },
    { id: 'tgi-dct-150', name: '1.6 T-GDI Automatik (DCT7) 150 PS', powerKw: 110, powerPs: 150 },
    { id: 'tgi-dct-180', name: '1.6 T-GDI Automatik (DCT7) 180 PS', powerKw: 132, powerPs: 180 },
  ],
};

export default kiaXceed;
