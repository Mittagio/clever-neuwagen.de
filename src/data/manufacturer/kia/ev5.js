/**
 * Kia EV5 – Herstellerdatenmodell
 * Quelle: Kia-Germany-EV5-Preisliste.pdf (2026-05-29)
 */
export const kiaEv5 = {
  brand: 'Kia',
  model: 'EV5',
  modelKey: 'ev5',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der mittelgroße Elektro-SUV',

  admin: {
    status: 'review',
    priceListDate: '2026-05-29',
    priceListSource: 'Kia-Germany-EV5-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: [
        'ev5-navigation',
        'ev5-rueckfahrkamera',
        'ev5-parksensoren-hinten',
      ],
      availablePackages: ['ev5-komfort'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: [
        'ev5-sitzheizung',
        'ev5-waermepumpe',
        'ev5-rueckfahrkamera',
        'ev5-parksensoren-vorn',
        'ev5-parksensoren-hinten',
      ],
      availablePackages: ['ev5-komfort', 'ev5-tech'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ev5-waermepumpe',
        'ev5-sitzheizung',
        'ev5-lenkradheizung',
        'ev5-totwinkel',
        'ev5-rueckfahrkamera',
        'ev5-parksensoren-vorn',
        'ev5-parksensoren-hinten',
      ],
      availablePackages: [],
    },
  ],

  packages: [
    {
      id: 'ev5-komfort',
      name: 'Komfort-Paket',
      priceGross: 450,
      rateDelta: 5,
      description: 'Elektrische Sitze, Memoryfunktion',
      features: ['ev5-sitzheizung', 'ev5-sitzbelueftung'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev5-tech',
      name: 'Technologie-Paket',
      priceGross: 1290,
      rateDelta: 13,
      description: '360° Kamera, Totwinkelassistent, Head-Up Display',
      features: ['ev5-360-kamera', 'ev5-totwinkel', 'ev5-hud'],
      availableTrims: ['earth'],
    },
  ],

  accessories: [
    {
      id: 'ev5-anhaenger',
      name: 'Anhängerkupplung',
      priceGross: 990,
      rateDelta: 10,
      features: ['ev5-anhaenger'],
      availableTrims: ['earth', 'gt-line'],
    },
  ],

  equipment: [
    { id: 'ev5-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev5-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: ['ev5-komfort'] },
    { id: 'ev5-sitzbelueftung', name: 'Sitzbelüftung', standardInTrims: [], availableViaPackages: ['ev5-komfort'] },
    { id: 'ev5-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev5-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['ev5-tech'] },
    { id: 'ev5-navigation', name: 'Navigation', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev5-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev5-parksensoren-vorn', name: 'Parksensoren vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev5-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev5-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['ev5-tech'] },
    { id: 'ev5-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev5-tech'] },
    { id: 'ev5-anhaenger', name: 'Anhängerkupplung', standardInTrims: [], availableViaPackages: [], availableViaAccessories: ['ev5-anhaenger'] },
  ],

  variants: [
    { id: 'ev5-air-58', trimId: 'air', engineId: 'ev-std', priceGross: 45990, baseLeasingRate: 419 },
    { id: 'ev5-earth-81', trimId: 'earth', engineId: 'ev-long', priceGross: 51990, baseLeasingRate: 449 },
    { id: 'ev5-gt-line-81', trimId: 'gt-line', engineId: 'ev-long', priceGross: 55990, baseLeasingRate: 499 },
    { id: 'ev5-gt-line-81-awd', trimId: 'gt-line', engineId: 'ev-long-awd', priceGross: 58990, baseLeasingRate: 519 },
  ],

  engines: [
    { id: 'ev-std', name: 'Standard Range 58,3 kWh', powerKw: 160, rangeKm: 460 },
    { id: 'ev-long', name: 'Long Range 81,4 kWh', powerKw: 160, rangeKm: 530 },
    { id: 'ev-long-awd', name: 'Long Range 81,4 kWh AWD', powerKw: 195, rangeKm: 491 },
  ],
};

export default kiaEv5;
