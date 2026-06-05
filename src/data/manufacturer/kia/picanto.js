/**
 * Kia Picanto – Herstellerdatenmodell (manuell verifiziert aus PDF MY2027)
 */
export const kiaPicanto = {
  brand: 'Kia',
  model: 'Picanto',
  modelKey: 'picanto',
  modelYear: '2027',
  priceListDate: '2026-05-29',
  tagline: 'Der urbane Kleinwagen',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-Picanto_Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen OCR-Supplement',
  },

  trims: [
    {
      id: 'core',
      name: 'Core',
      baseEquipment: ['picanto-rueckfahrkamera', 'picanto-parksensoren-hinten'],
      availablePackages: [],
    },
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: [
        'picanto-sitzheizung',
        'picanto-lenkradheizung',
        'picanto-rueckfahrkamera',
        'picanto-parksensoren-hinten',
      ],
      availablePackages: [],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: [
        'picanto-sitzheizung',
        'picanto-lenkradheizung',
        'picanto-rueckfahrkamera',
        'picanto-parksensoren-hinten',
      ],
      availablePackages: ['picanto-drivewise'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'picanto-sitzheizung',
        'picanto-lenkradheizung',
        'picanto-rueckfahrkamera',
        'picanto-parksensoren-hinten',
      ],
      availablePackages: ['picanto-drivewise'],
    },
  ],

  packages: [
    {
      id: 'picanto-drivewise',
      name: 'DriveWise-Paket',
      priceGross: 490,
      rateDelta: 5,
      description: 'Totwinkelassistent, Ausstiegswarner, erweiterter Frontkollisionswarner',
      features: ['picanto-totwinkel'],
      availableTrims: ['spirit', 'gt-line'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'picanto-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'picanto-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'picanto-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'picanto-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'picanto-totwinkel', name: 'Totwinkelassistent', standardInTrims: [], availableViaPackages: ['picanto-drivewise'] },
    { id: 'picanto-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['core', 'vision', 'spirit', 'gt-line'] },
    { id: 'picanto-waermepumpe', name: 'Wärmepumpe', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['core', 'vision', 'spirit', 'gt-line'] },
    { id: 'picanto-anhaenger', name: 'Anhängerkupplung', standardInTrims: [], availableViaPackages: [], notAvailableInTrims: ['core', 'vision', 'spirit', 'gt-line'] },
  ],

  variants: [
    { id: 'picanto-core-mt', trimId: 'core', engineId: 'mt5', priceGross: 17590, baseLeasingRate: 139 },
    { id: 'picanto-vision-mt', trimId: 'vision', engineId: 'mt5', priceGross: 18550, baseLeasingRate: 149 },
    { id: 'picanto-spirit-mt', trimId: 'spirit', engineId: 'mt5', priceGross: 20750, baseLeasingRate: 169 },
    { id: 'picanto-gt-mt', trimId: 'gt-line', engineId: 'mt5', priceGross: 21750, baseLeasingRate: 179 },
    { id: 'picanto-vision-amt', trimId: 'vision', engineId: 'amt', priceGross: 19550, baseLeasingRate: 159 },
    { id: 'picanto-spirit-amt', trimId: 'spirit', engineId: 'amt', priceGross: 21750, baseLeasingRate: 179 },
    { id: 'picanto-gt-amt', trimId: 'gt-line', engineId: 'amt', priceGross: 22750, baseLeasingRate: 189 },
  ],

  engines: [
    { id: 'mt5', name: '1.0 MPI Schaltgetriebe (MT5)', powerKw: 50 },
    { id: 'amt', name: '1.0 MPI Automatik (AMT)', powerKw: 50 },
  ],
};

export default kiaPicanto;
