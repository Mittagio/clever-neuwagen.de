/**
 * Kia EV3 – zentrales Herstellerdatenmodell (Demo / Sprint 23)
 * Händler pflegen nur Rabatte, LF, Bestand – nicht Stammdaten.
 */
export const kiaEv3 = {
  brand: 'Kia',
  model: 'EV3',
  modelKey: 'ev3',
  modelYear: '2026',
  tagline: 'Der kompakte Elektro-SUV',

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: ['ev3-navigation', 'ev3-rueckfahrkamera'],
      availablePackages: ['ev3-komfort'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: ['ev3-sitzheizung', 'ev3-totwinkel', 'ev3-navigation', 'ev3-waermepumpe'],
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
      priceGross: 990,
      rateDelta: 9,
      description: 'Remote Parken, 360° Kamera, erweiterte Assistenten',
      features: ['ev3-remote-parken', 'ev3-360-kamera'],
      availableTrims: ['earth', 'gt-line'],
    },
    {
      id: 'ev3-komfort',
      name: 'Komfort Paket',
      priceGross: 1290,
      rateDelta: 12,
      description: 'Relaxsitze, Sitzbelüftung',
      features: ['ev3-sitzbelueftung'],
      availableTrims: ['air', 'earth', 'gt-line'],
    },
  ],

  accessories: [
    {
      id: 'ev3-anhaenger',
      name: 'Anhängerkupplung',
      priceGross: 890,
      rateDelta: 6,
      features: ['ev3-anhaenger'],
      availableTrims: ['earth', 'gt-line'],
    },
  ],

  equipment: [
    { id: 'ev3-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-sitzheizung', name: 'Sitzheizung', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-navigation', name: 'Navigation', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev3-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['gt-line'], availableViaPackages: [] },
    { id: 'ev3-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['ev3-technik'] },
    { id: 'ev3-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev3-premium'] },
    { id: 'ev3-harman', name: 'Harman Kardon', standardInTrims: [], availableViaPackages: ['ev3-premium'] },
    { id: 'ev3-heckklappe', name: 'Elektrische Heckklappe', standardInTrims: [], availableViaPackages: ['ev3-premium'] },
    { id: 'ev3-remote-parken', name: 'Remote Parken', standardInTrims: [], availableViaPackages: ['ev3-technik'] },
    { id: 'ev3-sitzbelueftung', name: 'Sitzbelüftung', standardInTrims: [], availableViaPackages: ['ev3-komfort'] },
    { id: 'ev3-panorama', name: 'Panoramadach', standardInTrims: [], availableViaPackages: [] },
    { id: 'ev3-anhaenger', name: 'Anhängerkupplung', standardInTrims: [], availableViaPackages: [], availableViaAccessories: ['ev3-anhaenger'] },
  ],

  variants: [
    { id: 'ev3-air', trimId: 'air', engineId: 'ev-std', priceGross: 32990, baseLeasingRate: 279 },
    { id: 'ev3-earth', trimId: 'earth', engineId: 'ev-long', priceGross: 36990, baseLeasingRate: 309 },
    { id: 'ev3-gt-line', trimId: 'gt-line', engineId: 'ev-long', priceGross: 39990, baseLeasingRate: 329 },
  ],

  engines: [
    { id: 'ev-std', name: 'Standard Range', powerKw: 150, rangeKm: 436 },
    { id: 'ev-long', name: 'Long Range', powerKw: 150, rangeKm: 605 },
  ],
};

export default kiaEv3;
