/**
 * Kia EV6 – Herstellerdatenmodell
 * Quelle: Kia-Germany-EV6_Pricelist.pdf (2026-05-29)
 */
export const kiaEv6 = {
  brand: 'Kia',
  model: 'EV6',
  modelKey: 'ev6',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der sportliche Elektro-Crossover',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-EV6_Pricelist.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  colors: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: ['ev6-rueckfahrkamera', 'ev6-parksensoren-hinten'],
      availablePackages: ['ev6-komfort'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: [
        'ev6-sitzheizung',
        'ev6-waermepumpe',
        'ev6-rueckfahrkamera',
        'ev6-parksensoren-vorn',
        'ev6-parksensoren-hinten',
      ],
      availablePackages: ['ev6-komfort', 'ev6-tech'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ev6-waermepumpe',
        'ev6-sitzheizung',
        'ev6-360-kamera',
        'ev6-totwinkel',
        'ev6-heckklappe',
        'ev6-rueckfahrkamera',
        'ev6-parksensoren-vorn',
        'ev6-parksensoren-hinten',
      ],
      availablePackages: ['ev6-premium', 'ev6-tech'],
    },
  ],

  packages: [
    {
      id: 'ev6-komfort',
      name: 'Komfort-Paket',
      priceGross: 890,
      rateDelta: 9,
      description: 'Sitzheizung, Wärmepumpe, Lenkradheizung',
      features: ['ev6-sitzheizung', 'ev6-waermepumpe', 'ev6-lenkradheizung'],
      availableTrims: ['air'],
    },
    {
      id: 'ev6-tech',
      name: 'Technologie-Paket',
      priceGross: 1190,
      rateDelta: 12,
      description: '360° Kamera, Totwinkelassistent, Parkassistent',
      features: ['ev6-360-kamera', 'ev6-totwinkel'],
      availableTrims: ['earth'],
    },
    {
      id: 'ev6-premium',
      name: 'Premium-Paket',
      priceGross: 1890,
      rateDelta: 19,
      description: 'Harman Kardon, Head-Up Display',
      features: ['ev6-harman', 'ev6-hud'],
      availableTrims: ['gt-line'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'ev6-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['earth', 'gt-line'], availableViaPackages: ['ev6-komfort'] },
    { id: 'ev6-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: ['ev6-komfort'] },
    { id: 'ev6-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: ['ev6-komfort'] },
    { id: 'ev6-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev6-parksensoren-vorn', name: 'Parksensoren vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev6-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev6-360-kamera', name: '360° Kamera', standardInTrims: ['gt-line'], availableViaPackages: ['ev6-tech'] },
    { id: 'ev6-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['ev6-tech'] },
    { id: 'ev6-heckklappe', name: 'Elektrische Heckklappe', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev6-harman', name: 'Harman Kardon', standardInTrims: [], availableViaPackages: ['ev6-premium'] },
    { id: 'ev6-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev6-premium'] },
  ],

  variants: [
    { id: 'ev6-air-63', trimId: 'air', engineId: 'ev-std', priceGross: 44990, baseLeasingRate: 399 },
    { id: 'ev6-earth-63', trimId: 'earth', engineId: 'ev-std', priceGross: 47190, baseLeasingRate: 429 },
    { id: 'ev6-air-84', trimId: 'air', engineId: 'ev-long', priceGross: 49990, baseLeasingRate: 419 },
    { id: 'ev6-earth-84', trimId: 'earth', engineId: 'ev-long', priceGross: 52190, baseLeasingRate: 449 },
    { id: 'ev6-gt-84', trimId: 'gt-line', engineId: 'ev-long', priceGross: 57890, baseLeasingRate: 479 },
    { id: 'ev6-air-84-awd', trimId: 'air', engineId: 'ev-long-awd', priceGross: 53990, baseLeasingRate: 449 },
    { id: 'ev6-earth-84-awd', trimId: 'earth', engineId: 'ev-long-awd', priceGross: 56190, baseLeasingRate: 469 },
    { id: 'ev6-gt-84-awd', trimId: 'gt-line', engineId: 'ev-long-awd', priceGross: 61890, baseLeasingRate: 499 },
  ],

  engines: [
    { id: 'ev-std', name: 'Standard Range 63 kWh RWD', powerKw: 125, rangeKm: 394 },
    { id: 'ev-long', name: 'Long Range 84 kWh RWD', powerKw: 168, rangeKm: 528 },
    { id: 'ev-long-awd', name: 'Long Range 84 kWh AWD', powerKw: 239, rangeKm: 484 },
  ],
};

export default kiaEv6;
