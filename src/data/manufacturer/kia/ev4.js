/**
 * Kia EV4 – Herstellerdatenmodell (Sprint 33c / Registry-Erweiterung)
 * Quelle: Kia-Germany-EV4-Preisliste.pdf (2026-05-29)
 */
export const kiaEv4 = {
  brand: 'Kia',
  model: 'EV4',
  modelKey: 'ev4',
  modelYear: '2026',
  priceListDate: '2026-05-29',
  tagline: 'Der kompakte Elektro-Limousine',

  admin: {
    status: 'review',
    priceListDate: '2026-05-29',
    priceListSource: 'Kia-Germany-EV4-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  trims: [
    {
      id: 'air',
      name: 'Air',
      baseEquipment: [
        'ev4-navigation',
        'ev4-rueckfahrkamera',
        'ev4-parksensoren-vorn',
        'ev4-parksensoren-hinten',
      ],
      availablePackages: ['ev4-winter', 'ev4-upgrade', 'ev4-technology-pack', 'ev4-technik-earth', 'ev4-sound'],
    },
    {
      id: 'earth',
      name: 'Earth',
      baseEquipment: [
        'ev4-sitzheizung',
        'ev4-lenkradheizung',
        'ev4-rueckfahrkamera',
        'ev4-parksensoren-vorn',
        'ev4-parksensoren-hinten',
      ],
      availablePackages: [
        'ev4-winter',
        'ev4-upgrade',
        'ev4-technology-pack',
        'ev4-technik-earth',
        'ev4-sound',
      ],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'ev4-waermepumpe',
        'ev4-sitzheizung',
        'ev4-lenkradheizung',
        'ev4-totwinkel',
        'ev4-harman',
        'ev4-rueckfahrkamera',
        'ev4-parksensoren-vorn',
        'ev4-parksensoren-hinten',
      ],
      availablePackages: ['ev4-park-gt', 'ev4-comfort-gt'],
    },
  ],

  packages: [
    {
      id: 'ev4-winter',
      name: 'Winter-Paket',
      priceGross: 1100,
      rateDelta: 11,
      description: 'Wärmepumpe, Sitzheizung, Lenkradheizung',
      features: ['ev4-waermepumpe', 'ev4-sitzheizung', 'ev4-lenkradheizung'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev4-upgrade',
      name: 'Upgrade-Paket',
      priceGross: 1350,
      rateDelta: 14,
      description: 'Privacy-Verglasung, Totwinkelassistent, Sitzheizung hinten',
      features: ['ev4-totwinkel', 'ev4-sitzheizung-hinten'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev4-technology-pack',
      name: 'Technology-Paket',
      priceGross: 1190,
      rateDelta: 12,
      description: 'Elektrische Heckklappe, Adaptive LED-Scheinwerfer',
      features: ['ev4-heckklappe'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev4-technik-earth',
      name: 'DriveWise ADAS-Paket',
      priceGross: 1390,
      rateDelta: 14,
      description: '360° Kamera, Remote Parkassistent, Totwinkel-Monitor',
      features: ['ev4-360-kamera', 'ev4-remote-parken', 'ev4-totwinkel-monitor'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev4-sound',
      name: 'Sound-Paket',
      priceGross: 690,
      rateDelta: 7,
      description: 'Harman Kardon Premium Soundsystem',
      features: ['ev4-harman'],
      availableTrims: ['air', 'earth'],
    },
    {
      id: 'ev4-park-gt',
      name: 'DriveWise Park-Paket',
      priceGross: 1690,
      rateDelta: 17,
      description: '360° Kamera, Head-Up Display, Remote Parkassistent',
      features: ['ev4-360-kamera', 'ev4-hud', 'ev4-remote-parken', 'ev4-totwinkel-monitor'],
      availableTrims: ['gt-line'],
    },
    {
      id: 'ev4-comfort-gt',
      name: 'Comfort-Paket',
      priceGross: 1390,
      rateDelta: 14,
      description: 'Sitzventilation, Sitzheizung hinten, elektrische Heckklappe',
      features: ['ev4-heckklappe', 'ev4-sitzbelueftung', 'ev4-sitzheizung-hinten'],
      availableTrims: ['gt-line'],
    },
  ],

  accessories: [
    {
      id: 'ev4-anhaenger',
      name: 'Anhängerkupplung',
      priceGross: 890,
      rateDelta: 9,
      features: ['ev4-anhaenger'],
      availableTrims: ['air', 'earth', 'gt-line'],
    },
  ],

  equipment: [
    { id: 'ev4-waermepumpe', name: 'Wärmepumpe', standardInTrims: ['gt-line'], availableViaPackages: ['ev4-winter'] },
    { id: 'ev4-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['earth', 'gt-line'], availableViaPackages: ['ev4-winter'] },
    { id: 'ev4-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['earth', 'gt-line'], availableViaPackages: ['ev4-winter'] },
    { id: 'ev4-sitzheizung-hinten', name: 'Sitzheizung hinten', standardInTrims: [], availableViaPackages: ['ev4-upgrade', 'ev4-comfort-gt'] },
    { id: 'ev4-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['ev4-upgrade'] },
    { id: 'ev4-totwinkel-monitor', name: 'Totwinkel-Monitor', standardInTrims: [], availableViaPackages: ['ev4-technik-earth', 'ev4-park-gt'] },
    { id: 'ev4-navigation', name: 'Navigation', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev4-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev4-parksensoren-vorn', name: 'Parksensoren vorne', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev4-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['air', 'earth', 'gt-line'], availableViaPackages: [] },
    { id: 'ev4-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['ev4-technik-earth', 'ev4-park-gt'] },
    { id: 'ev4-hud', name: 'Head-Up Display', standardInTrims: [], availableViaPackages: ['ev4-park-gt'] },
    { id: 'ev4-harman', name: 'Harman Kardon', standardInTrims: ['gt-line'], availableViaPackages: ['ev4-sound'] },
    { id: 'ev4-heckklappe', name: 'Elektrische Heckklappe', standardInTrims: [], availableViaPackages: ['ev4-technology-pack', 'ev4-comfort-gt'] },
    { id: 'ev4-remote-parken', name: 'Remote Parkassistent', standardInTrims: [], availableViaPackages: ['ev4-technik-earth', 'ev4-park-gt'] },
    { id: 'ev4-sitzbelueftung', name: 'Sitzbelüftung', standardInTrims: [], availableViaPackages: ['ev4-comfort-gt'] },
    { id: 'ev4-panorama', name: 'Panoramadach', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['air', 'earth', 'gt-line'] },
    { id: 'ev4-anhaenger', name: 'Anhängerkupplung', standardInTrims: [], availableViaPackages: [], availableViaAccessories: ['ev4-anhaenger'] },
  ],

  variants: [
    { id: 'ev4-air-58', trimId: 'air', engineId: 'ev-std', priceGross: 37590, baseLeasingRate: 313 },
    { id: 'ev4-earth-58', trimId: 'earth', engineId: 'ev-std', priceGross: 39890, baseLeasingRate: 332 },
    { id: 'ev4-air-81', trimId: 'air', engineId: 'ev-long', priceGross: 43240, baseLeasingRate: 360 },
    { id: 'ev4-earth-81', trimId: 'earth', engineId: 'ev-long', priceGross: 45540, baseLeasingRate: 379 },
    { id: 'ev4-gt-line-81', trimId: 'gt-line', engineId: 'ev-long', priceGross: 49440, baseLeasingRate: 412 },
  ],

  engines: [
    { id: 'ev-std', name: 'Standard Range 58,3 kWh', powerKw: 150, rangeKm: 425 },
    { id: 'ev-long', name: 'Long Range 81,4 kWh', powerKw: 150, rangeKm: 594 },
  ],
};

export default kiaEv4;
