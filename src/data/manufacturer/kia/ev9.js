/**
 * Kia EV9 – Herstellerdatenmodell
 * Quelle: Kia-Germany-EV9-Preisliste.pdf (2026-05-29)
 */
export const kiaEv9 = {
  brand: 'Kia',
  model: 'EV9',
  modelKey: 'ev9',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der große Elektro-SUV',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-EV9-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  colors: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: [
        'ev9-sitzheizung',
        'ev9-waermepumpe',
        'ev9-rueckfahrkamera',
        'ev9-parksensoren-hinten',
      ],
      availablePackages: ['ev9-komfort', 'ev9-tech'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: [
        'ev9-sitzheizung',
        'ev9-waermepumpe',
        'ev9-heckklappe',
        'ev9-rueckfahrkamera',
        'ev9-parksensoren-vorn',
        'ev9-parksensoren-hinten',
      ],
      availablePackages: ['ev9-tech', 'ev9-design'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ev9-sitzheizung',
        'ev9-sitzheizung-hinten',
        'ev9-waermepumpe',
        'ev9-360-kamera',
        'ev9-totwinkel',
        'ev9-heckklappe',
        'ev9-rueckfahrkamera',
        'ev9-parksensoren-vorn',
        'ev9-parksensoren-hinten',
      ],
      availablePackages: ['ev9-premium', 'ev9-design'],
    },
  ],

  packages: [
    {
      id: 'ev9-komfort',
      name: 'Komfort-Paket',
      priceGross: 1290,
      rateDelta: 13,
      description: 'Panoramadach, Sitzbelüftung',
      features: ['ev9-panorama', 'ev9-sitzbelueftung'],
      availableTrims: ['air'],
    },
    {
      id: 'ev9-tech',
      name: 'Technologie-Paket',
      priceGross: 1890,
      rateDelta: 19,
      description: '360° Kamera, Parkassistent, Head-Up Display',
      features: ['ev9-360-kamera', 'ev9-hud'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev9-design',
      name: 'Design-Paket',
      priceGross: 1490,
      rateDelta: 15,
      description: 'Panoramadach, Ambiente-Beleuchtung',
      features: ['ev9-panorama'],
      availableTrims: ['earth', 'gt-line'],
      requiresPackages: ['ev9-tech'],
    },
    {
      id: 'ev9-premium',
      name: 'Premium-Paket',
      priceGross: 2190,
      rateDelta: 22,
      description: 'Harman Kardon, Head-Up Display, Sitzbelüftung',
      features: ['ev9-harman', 'ev9-hud', 'ev9-sitzbelueftung'],
      availableTrims: ['gt-line'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'ev9-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-sitzheizung-hinten', name: 'Sitzheizung hinten', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev9-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-parksensoren-vorn', name: 'Parksensoren vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-360-kamera', name: '360° Kamera', standardInTrims: ['gt-line'], availableViaPackages: ['ev9-tech'] },
    { id: 'ev9-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev9-heckklappe', name: 'Elektrische Heckklappe', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev9-panorama', name: 'Panoramadach', standardInTrims: [], availableViaPackages: ['ev9-komfort', 'ev9-design'] },
    { id: 'ev9-harman', name: 'Harman Kardon', standardInTrims: [], availableViaPackages: ['ev9-premium'] },
    { id: 'ev9-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev9-tech', 'ev9-premium'] },
    { id: 'ev9-sitzbelueftung', name: 'Sitzbelüftung', standardInTrims: [], availableViaPackages: ['ev9-komfort', 'ev9-premium'] },
  ],

  variants: [
    { id: 'ev9-air-rwd', trimId: 'air', engineId: 'ev-long-rwd', priceGross: 63690, baseLeasingRate: 599 },
    { id: 'ev9-air-rwd-2', trimId: 'air', engineId: 'ev-long-rwd', priceGross: 66690, baseLeasingRate: 619 },
    { id: 'ev9-earth-rwd', trimId: 'earth', engineId: 'ev-long-rwd', priceGross: 74190, baseLeasingRate: 649 },
    { id: 'ev9-air-awd', trimId: 'air', engineId: 'ev-long-awd', priceGross: 70690, baseLeasingRate: 629 },
    { id: 'ev9-earth-awd', trimId: 'earth', engineId: 'ev-long-awd', priceGross: 78190, baseLeasingRate: 669 },
    { id: 'ev9-gt-awd', trimId: 'gt-line', engineId: 'ev-long-awd', priceGross: 84080, baseLeasingRate: 699 },
  ],

  engines: [
    { id: 'ev-long-rwd', name: 'Long Range 99,8 kWh RWD', powerKw: 160, rangeKm: 541 },
    { id: 'ev-long-awd', name: 'Long Range 99,8 kWh AWD', powerKw: 283, rangeKm: 505 },
  ],
};

export default kiaEv9;
