/**
 * Kia EV3 – zentrales Herstellerdatenmodell (Demo / Sprint 23+)
 * Händler pflegen nur Rabatte, LF, Bestand – nicht Stammdaten.
 */
export const kiaEv3 = {
  brand: 'Kia',
  model: 'EV3',
  modelKey: 'ev3',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der kompakte Elektro-SUV',

  admin: {
    status: 'review',
    priceListDate: '2026-05-29',
    priceListSource: 'Kia-Germany-EV3-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: ['ev3-navigation', 'ev3-rueckfahrkamera', 'ev3-parksensoren-hinten'],
      availablePackages: ['ev3-komfort'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: [
        'ev3-sitzheizung',
        'ev3-rueckfahrkamera',
        'ev3-parksensoren-vorn',
        'ev3-parksensoren-hinten',
        'ev3-waermepumpe',
      ],
      availablePackages: ['ev3-technik', 'ev3-komfort'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ev3-waermepumpe',
        'ev3-sitzheizung',
        'ev3-totwinkel',
        'ev3-navigation',
        'ev3-lenkradheizung',
        'ev3-rueckfahrkamera',
        'ev3-parksensoren-vorn',
        'ev3-parksensoren-hinten',
      ],
      availablePackages: ['ev3-premium', 'ev3-technik', 'ev3-komfort'],
    },
  ],

  packages: [
    {
      id: 'ev3-premium',
      name: 'Premium Paket',
      priceGross: 1890,
      rateDelta: 18,
      description: 'Head-Up Display, Harman Kardon, elektrische Heckklappe',
      features: ['ev3-hud', 'ev3-harman', 'ev3-heckklappe'],
      availableTrims: ['gt-line'],
    },
    {
      id: 'ev3-technik',
      name: 'Technik Paket',
      priceGross: 1800,
      rateDelta: 19,
      description: '360° Kamera, Totwinkelassistent, Parkassistent',
      features: ['ev3-360-kamera', 'ev3-totwinkel', 'ev3-remote-parken'],
      availableTrims: ['earth', 'gt-line'],
    },
    {
      id: 'ev3-komfort',
      name: 'Komfort Paket',
      priceGross: 1200,
      rateDelta: 12,
      description: 'Elektrische Heckklappe, Sitzheizung hinten',
      features: ['ev3-heckklappe', 'ev3-sitzheizung-hinten'],
      availableTrims: ['air', 'earth', 'gt-line'],
    },
  ],

  accessories: [
    {
      id: 'ev3-anhaenger',
      name: 'Anhängerkupplung',
      priceGross: 990,
      rateDelta: 7,
      features: ['ev3-anhaenger'],
      availableTrims: ['earth', 'gt-line'],
    },
  ],

  equipment: [
    { id: 'ev3-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-sitzheizung-hinten', name: 'Sitzheizung hinten', standardInTrims: [], availableViaPackages: ['ev3-komfort'] },
    { id: 'ev3-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['ev3-technik'] },
    { id: 'ev3-navigation', name: 'Navigation', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev3-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-parksensoren-vorn', name: 'Parksensoren vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['ev3-technik'] },
    { id: 'ev3-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev3-premium'] },
    { id: 'ev3-harman', name: 'Harman Kardon', standardInTrims: [], availableViaPackages: ['ev3-premium'] },
    { id: 'ev3-heckklappe', name: 'Elektrische Heckklappe', standardInTrims: [], availableViaPackages: ['ev3-komfort', 'ev3-premium'] },
    { id: 'ev3-remote-parken', name: 'Parkassistent', standardInTrims: [], availableViaPackages: ['ev3-technik'] },
    { id: 'ev3-sitzbelueftung', name: 'Sitzbelüftung', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['air', 'earth', 'gt-line'] },
    { id: 'ev3-panorama', name: 'Panoramadach', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['air', 'earth', 'gt-line'] },
    { id: 'ev3-anhaenger', name: 'Anhängerkupplung', standardInTrims: [], availableViaPackages: [], availableViaAccessories: ['ev3-anhaenger'], notAvailableInTrims: ['air'] },
  ],

  variants: [
    { id: 'ev3-air-58', trimId: 'air', engineId: 'ev-std', priceGross: 35990, baseLeasingRate: 299 },
    { id: 'ev3-earth-58', trimId: 'earth', engineId: 'ev-std', priceGross: 38290, baseLeasingRate: 318 },
    { id: 'ev3-air-81', trimId: 'air', engineId: 'ev-long', priceGross: 41390, baseLeasingRate: 329 },
    { id: 'ev3-earth-81', trimId: 'earth', engineId: 'ev-long', priceGross: 43690, baseLeasingRate: 349 },
    { id: 'ev3-gt-line-81', trimId: 'gt-line', engineId: 'ev-long', priceGross: 48690, baseLeasingRate: 379 },
    { id: 'ev3-earth-81-awd', trimId: 'earth', engineId: 'ev-long-awd', priceGross: 46880, baseLeasingRate: 369 },
    { id: 'ev3-gt-line-81-awd', trimId: 'gt-line', engineId: 'ev-long-awd', priceGross: 51190, baseLeasingRate: 399 },
  ],

  engines: [
    { id: 'ev-std', name: 'Standard Range 58,3 kWh', powerKw: 150, rangeKm: 436 },
    { id: 'ev-long', name: 'Long Range 81,4 kWh', powerKw: 150, rangeKm: 605 },
    { id: 'ev-long-awd', name: 'Long Range 81,4 kWh AWD', powerKw: 195, rangeKm: 572 },
  ],
};

export default kiaEv3;
