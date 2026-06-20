/**
 * Kia Stonic – Herstellerdatenmodell
 * Quelle: Kia-Germany-Stonic-Preisliste.pdf (2026-05-29)
 */
export const kiaStonic = {
  brand: 'Kia',
  model: 'Stonic',
  modelKey: 'stonic',
  modelYear: '2027',
  priceListDate: '2026-05-29',
  tagline: 'Der urbane Crossover',

  admin: {
    status: 'review',
    priceListSource: 'Kia-Germany-Stonic-Preisliste.pdf',
    lastUpdated: '2026-05-29',
    updatedBy: 'Clever-Neuwagen Import',
  },

  colors: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 790 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'sparklingsilver', label: 'Sparkling Silver', priceGross: 790 },
    { id: 'astrogray', label: 'Astro Gray', priceGross: 790 },
    { id: 'smokeblue', label: 'Smoke Blue', priceGross: 790 },
    { id: 'yachtblue', label: 'Yacht Blue', priceGross: 790 },
    { id: 'signalred', label: 'Signal Red', priceGross: 790 },
    { id: 'adventurousgreen', label: 'Adventurous Green', priceGross: 790 },
  ],

  trims: [
    {
      id: 'core',
      name: 'Core',
      baseEquipment: ['stonic-rueckfahrkamera', 'stonic-parksensoren-hinten'],
      availablePackages: [],
    },
    {
      id: 'vision',
      name: 'Vision',
      baseEquipment: ['stonic-rueckfahrkamera', 'stonic-parksensoren-hinten', 'stonic-sitzheizung'],
      availablePackages: ['stonic-komfort'],
    },
    {
      id: 'spirit',
      name: 'Spirit',
      baseEquipment: [
        'stonic-sitzheizung',
        'stonic-lenkradheizung',
        'stonic-rueckfahrkamera',
        'stonic-parksensoren-hinten',
      ],
      availablePackages: ['stonic-komfort', 'stonic-drivewise'],
    },
    {
      id: 'gt-line',
      name: 'GT-Line',
      baseEquipment: [
        'stonic-sitzheizung',
        'stonic-lenkradheizung',
        'stonic-totwinkel',
        'stonic-rueckfahrkamera',
        'stonic-parksensoren-hinten',
      ],
      availablePackages: ['stonic-drivewise', 'stonic-tech'],
    },
  ],

  packages: [
    {
      id: 'stonic-komfort',
      name: 'Komfort-Paket',
      priceGross: 490,
      rateDelta: 5,
      description: 'Sitzheizung, Lenkradheizung',
      features: ['stonic-sitzheizung', 'stonic-lenkradheizung'],
      availableTrims: ['vision'],
    },
    {
      id: 'stonic-drivewise',
      name: 'DriveWise-Paket',
      priceGross: 690,
      rateDelta: 7,
      description: 'Totwinkelassistent, Ausstiegswarner',
      features: ['stonic-totwinkel'],
      availableTrims: ['spirit', 'gt-line'],
    },
    {
      id: 'stonic-tech',
      name: 'Technik-Paket',
      priceGross: 990,
      rateDelta: 10,
      description: '360° Kamera, Parkassistent',
      features: ['stonic-360-kamera'],
      availableTrims: ['gt-line'],
      requiresPackages: ['stonic-drivewise'],
    },
  ],

  accessories: [],

  equipment: [
    { id: 'stonic-sitzheizung', name: 'Sitzheizung vorne', standardInTrims: ['vision', 'spirit', 'gt-line'], availableViaPackages: ['stonic-komfort'] },
    { id: 'stonic-lenkradheizung', name: 'Lenkradheizung', standardInTrims: ['spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'stonic-rueckfahrkamera', name: 'Rückfahrkamera', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'stonic-parksensoren-hinten', name: 'Parksensoren hinten', standardInTrims: ['core', 'vision', 'spirit', 'gt-line'], availableViaPackages: [] },
    { id: 'stonic-totwinkel', name: 'Totwinkelassistent', standardInTrims: ['gt-line'], availableViaPackages: ['stonic-drivewise'] },
    { id: 'stonic-360-kamera', name: '360° Kamera', standardInTrims: [], availableViaPackages: ['stonic-tech'] },
  ],

  variants: [
    { id: 'stonic-core-mt', trimId: 'core', engineId: 'tgi-mt', priceGross: 23790, baseLeasingRate: 199 },
    { id: 'stonic-vision-mt', trimId: 'vision', engineId: 'tgi-mt', priceGross: 25490, baseLeasingRate: 219 },
    { id: 'stonic-spirit-mt', trimId: 'spirit', engineId: 'tgi-mt', priceGross: 28090, baseLeasingRate: 249 },
    { id: 'stonic-gt-mt', trimId: 'gt-line', engineId: 'tgi-mt', priceGross: 29090, baseLeasingRate: 269 },
    { id: 'stonic-spirit-dct', trimId: 'spirit', engineId: 'tgi-dct', priceGross: 29890, baseLeasingRate: 259 },
    { id: 'stonic-gt-dct', trimId: 'gt-line', engineId: 'tgi-dct', priceGross: 31290, baseLeasingRate: 279 },
  ],

  engines: [
    { id: 'tgi-mt', name: '1.0 T-GDI Schaltgetriebe (MT6)', powerKw: 74, powerPs: 100 },
    { id: 'tgi-dct', name: '1.0 T-GDI Automatik (DCT7)', powerKw: 84.6, powerPs: 115 },
  ],
};

export default kiaStonic;
