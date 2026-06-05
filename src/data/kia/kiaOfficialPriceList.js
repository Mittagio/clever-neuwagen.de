/**
 * Kia Deutschland – offizielle Preislisten-Übersicht
 * Quelle: https://www.kia.com/de/broschuere/
 * Stand: Kia Preislisten · Angebotsraten gültig bis 30.06.2026
 *
 * Enthält UPE ab, Leasing-/Finanzierungsrate ab und WLTP-Hinweise der Modellseite.
 * Detaillierte Ausstattungslinien/Pakete: Registry (sportage.js, ev3.js) bzw. PDF je Modell.
 */
export const KIA_PRICE_LIST_META = {
  brand: 'Kia',
  publisher: 'Kia Deutschland GmbH',
  sourceUrl: 'https://www.kia.com/de/broschuere/',
  sourceLabel: 'Kia Preislisten',
  validUntil: '2026-06-30',
  importedAt: '2026-05-29',
  currency: 'EUR',
  rateDisclaimer:
    'Bei den dargestellten Raten handelt es sich um Leasing- und Finanzierungsraten mit und ohne Anzahlung. ' +
    'Individuelle Angebote unter kia.com/de/specials/finanzierung-und-leasing/',
  imageDisclaimer: 'Abbildungen können kostenpflichtige Sonderausstattung zeigen.',
};

export const KIA_NAV_CATEGORIES = [
  { id: 'stadt', label: 'Stadt' },
  { id: 'familie', label: 'Familie' },
  { id: 'suv', label: 'SUV' },
  { id: 'kompakt', label: 'Kompakt' },
  { id: 'kombi', label: 'Kombi' },
  { id: 'gt', label: 'GT' },
  { id: 'elektro-hybrid', label: 'Elektro/Hybrid' },
  { id: 'pbv', label: 'PBV' },
];

/**
 * @typedef {Object} KiaOfficialModel
 * @property {string} id
 * @property {string} name
 * @property {string} fullName
 * @property {string[]} categories
 * @property {string} segment
 * @property {'verbrenner'|'hybrid'|'plugin-hybrid'|'elektro'|'nutzfahrzeug'} powertrain
 * @property {number|null} priceFromGross UPE ab in EUR
 * @property {number|null} monthlyRateFrom Rate ab in EUR/Monat
 * @property {boolean} monthlyRateAvailable
 * @property {string|null} wltpText
 * @property {string|null} co2Class
 * @property {boolean} priceListAvailable
 * @property {boolean} orderable
 * @property {string|null} orderNote
 * @property {string|null} registryKey Verknüpfung zur Clever-Neuwagen Registry
 * @property {number} sortOrder
 */

/** @type {KiaOfficialModel[]} */
export const KIA_OFFICIAL_MODELS = [
  {
    id: 'picanto',
    name: 'Picanto',
    fullName: 'Kia Picanto',
    categories: ['stadt'],
    segment: 'Kleinwagen',
    powertrain: 'verbrenner',
    priceFromGross: 17590,
    monthlyRateFrom: 139,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 5,2 – 5,9 l/100 km; CO₂-Emissionen kombiniert 127 – 135 g/km.',
    co2Class: 'D',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'picanto',
    sortOrder: 10,
  },
  {
    id: 'stonic',
    name: 'Stonic',
    fullName: 'Kia Stonic',
    categories: ['stadt', 'suv'],
    segment: 'Kompakt-SUV',
    powertrain: 'verbrenner',
    priceFromGross: 23790,
    monthlyRateFrom: 199,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 5,6 – 5,9 l/100 km; CO₂-Emissionen kombiniert 127 – 133 g/km.',
    co2Class: 'D',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 20,
  },
  {
    id: 'xceed',
    name: 'XCeed',
    fullName: 'Kia XCeed',
    categories: ['kompakt'],
    segment: 'Kompakt-Crossover',
    powertrain: 'verbrenner',
    priceFromGross: 26990,
    monthlyRateFrom: 189,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 6,1 – 6,7 l/100 km; CO₂-Emissionen kombiniert 137 – 152 g/km.',
    co2Class: 'E',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 30,
  },
  {
    id: 'k4',
    name: 'K4',
    fullName: 'Kia K4',
    categories: ['kompakt'],
    segment: 'Kompaktlimousine',
    powertrain: 'verbrenner',
    priceFromGross: 28890,
    monthlyRateFrom: 209,
    monthlyRateAvailable: true,
    wltpText: 'Kia K4 1.6 T-GDI DCT; 132,4 kW (180 PS): Kraftstoffverbrauch kombiniert 6,9 l/100 km; CO₂-Emissionen kombiniert 155 g/km.',
    co2Class: 'E',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 40,
  },
  {
    id: 'k4-sportswagon',
    name: 'K4 Sportswagon',
    fullName: 'Kia K4 Sportswagon',
    categories: ['kombi', 'familie'],
    segment: 'Kombi',
    powertrain: 'verbrenner',
    priceFromGross: 29890,
    monthlyRateFrom: 239,
    monthlyRateAvailable: true,
    wltpText: 'Kia K4 Sportswagon 1.6 T-GDI DCT 132,4 kW (180 PS): Kraftstoffverbrauch kombiniert 7,2 l/100 km; CO₂-Emissionen kombiniert 161 g/km.',
    co2Class: 'F',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 50,
  },
  {
    id: 'ev2',
    name: 'EV2',
    fullName: 'Kia EV2',
    categories: ['elektro-hybrid', 'stadt'],
    segment: 'Elektro-Kleinwagen',
    powertrain: 'elektro',
    priceFromGross: 26600,
    monthlyRateFrom: 239,
    monthlyRateAvailable: true,
    wltpText: 'Kia EV2 (99,5 kW/135 PS): Stromverbrauch kombiniert 16,3 kWh/100 km. CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 60,
  },
  {
    id: 'niro-hybrid',
    name: 'Niro Hybrid',
    fullName: 'Kia Niro Hybrid',
    categories: ['elektro-hybrid', 'suv'],
    segment: 'Hybrid-SUV',
    powertrain: 'hybrid',
    priceFromGross: 33990,
    monthlyRateFrom: 349,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 4,5 – 4,9 l/100 km; CO₂-Emissionen kombiniert 102 – 112 g/km.',
    co2Class: 'C',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'niro',
    sortOrder: 70,
  },
  {
    id: 'seltos',
    name: 'Seltos',
    fullName: 'Kia Seltos',
    categories: ['suv'],
    segment: 'Kompakt-SUV',
    powertrain: 'verbrenner',
    priceFromGross: 34190,
    monthlyRateFrom: 295,
    monthlyRateAvailable: true,
    wltpText: 'Kia Seltos 1.6 T-GDI AWD (132 kW/180 PS): Kraftstoffverbrauch kombiniert 7,5 l/100 km; CO₂-Emissionen kombiniert 169 g/km.',
    co2Class: 'F',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 80,
  },
  {
    id: 'sportage',
    name: 'Sportage',
    fullName: 'Kia Sportage',
    categories: ['suv', 'familie'],
    segment: 'Kompakt-SUV',
    powertrain: 'verbrenner',
    priceFromGross: 33990,
    monthlyRateFrom: 199,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 5,0 – 7,8 l/100 km; CO₂-Emissionen kombiniert 131 – 177 g/km.',
    co2Class: 'D – F',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sportage',
    sortOrder: 90,
  },
  {
    id: 'sportage-hybrid',
    name: 'Sportage Hybrid',
    fullName: 'Kia Sportage Hybrid',
    categories: ['suv', 'elektro-hybrid', 'familie'],
    segment: 'Hybrid-SUV',
    powertrain: 'hybrid',
    priceFromGross: 38990,
    monthlyRateFrom: 245,
    monthlyRateAvailable: true,
    wltpText: 'Kraftstoffverbrauch kombiniert 5,5 – 6,4 l/100 km; CO₂-Emissionen kombiniert 125 – 144 g/km.',
    co2Class: 'D – E',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sportage',
    sortOrder: 100,
  },
  {
    id: 'sportage-phev',
    name: 'Sportage Plug-in Hybrid',
    fullName: 'Kia Sportage Plug-in Hybrid',
    categories: ['suv', 'elektro-hybrid', 'familie'],
    segment: 'Plug-in-Hybrid-SUV',
    powertrain: 'plugin-hybrid',
    priceFromGross: 43100,
    monthlyRateFrom: 459,
    monthlyRateAvailable: true,
    wltpText:
      'Kraftstoffverbrauch gewichtet kombiniert 1,2 l/100 km; Stromverbrauch gewichtet kombiniert 18,5 – 18,8 kWh/100 km; ' +
      'CO₂-Emissionen gewichtet kombiniert 27 – 28 g/km. CO₂-Klasse B. ' +
      'Kraftstoffverbrauch bei entladener Batterie kombiniert 6,8 – 6,9 l/100 km; CO₂-Klasse bei entladener Batterie F.',
    co2Class: 'B',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sportage',
    sortOrder: 110,
  },
  {
    id: 'ev3',
    name: 'EV3',
    fullName: 'Kia EV3',
    categories: ['elektro-hybrid', 'suv'],
    segment: 'Elektro-SUV',
    powertrain: 'elektro',
    priceFromGross: 35990,
    monthlyRateFrom: 299,
    monthlyRateAvailable: true,
    wltpText:
      'Kia EV3 (Air) 150 kW (204 PS): Stromverbrauch kombiniert 15,8 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km. ' +
      'Kia EV3 (Earth/GT-line) 150 kW (204 PS): Stromverbrauch kombiniert 16,2 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'ev3',
    sortOrder: 120,
  },
  {
    id: 'ev4',
    name: 'EV4',
    fullName: 'Kia EV4',
    categories: ['elektro-hybrid', 'kompakt'],
    segment: 'Elektro-Limousine',
    powertrain: 'elektro',
    priceFromGross: 37590,
    monthlyRateFrom: 269,
    monthlyRateAvailable: true,
    wltpText: 'Stromverbrauch kombiniert 14,6 – 15,8 kWh/100 km. CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'ev4',
    sortOrder: 130,
  },
  {
    id: 'ev4-fastback',
    name: 'EV4 Fastback',
    fullName: 'Kia EV4 Fastback',
    categories: ['elektro-hybrid', 'kompakt'],
    segment: 'Elektro-Fastback',
    powertrain: 'elektro',
    priceFromGross: 41490,
    monthlyRateFrom: 425,
    monthlyRateAvailable: true,
    wltpText: 'Stromverbrauch kombiniert 14,3 – 14,9 kWh/100 km. CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'ev4',
    sortOrder: 140,
  },
  {
    id: 'ev5',
    name: 'EV5',
    fullName: 'Kia EV5',
    categories: ['elektro-hybrid', 'suv', 'familie'],
    segment: 'Elektro-SUV',
    powertrain: 'elektro',
    priceFromGross: 45990,
    monthlyRateFrom: 419,
    monthlyRateAvailable: true,
    wltpText: 'Stromverbrauch kombiniert 16,9 – 17,8 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'ev5',
    sortOrder: 150,
  },
  {
    id: 'ev5-gt',
    name: 'EV5 GT',
    fullName: 'Kia EV5 GT',
    categories: ['elektro-hybrid', 'suv', 'gt'],
    segment: 'Elektro-SUV GT',
    powertrain: 'elektro',
    priceFromGross: 59990,
    monthlyRateFrom: 0,
    monthlyRateAvailable: false,
    wltpText: 'Kia EV5 GT 225 kW (306 PS): Stromverbrauch kombiniert 18,6 kWh/100 km; CO₂-Emission kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: 'Rate laut Kia-Website: 0 € pro Monat (Sonderkondition prüfen)',
    registryKey: 'ev5',
    sortOrder: 160,
  },
  {
    id: 'ev6',
    name: 'EV6',
    fullName: 'Kia EV6',
    categories: ['elektro-hybrid', 'suv'],
    segment: 'Elektro-Crossover',
    powertrain: 'elektro',
    priceFromGross: 44990,
    monthlyRateFrom: 399,
    monthlyRateAvailable: true,
    wltpText: 'Kia EV6 (Earth) 168 kW (229 PS): Stromverbrauch kombiniert 16,9 kWh/100 km. CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 170,
  },
  {
    id: 'ev6-gt',
    name: 'EV6 GT',
    fullName: 'Kia EV6 GT',
    categories: ['elektro-hybrid', 'gt'],
    segment: 'Elektro-GT',
    powertrain: 'elektro',
    priceFromGross: 69990,
    monthlyRateFrom: 693,
    monthlyRateAvailable: true,
    wltpText: 'Stromverbrauch kombiniert 20,6 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 180,
  },
  {
    id: 'sorento',
    name: 'Sorento',
    fullName: 'Kia Sorento',
    categories: ['suv', 'familie'],
    segment: 'Mittelklasse-SUV',
    powertrain: 'verbrenner',
    priceFromGross: 56590,
    monthlyRateFrom: 535,
    monthlyRateAvailable: true,
    wltpText: 'Kia Sorento 2.2 CRDi (142 kW/194 PS): Kraftstoffverbrauch kombiniert 6,6 l/100 km; CO₂-Emissionen kombiniert 174 g/km.',
    co2Class: 'F',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sorento',
    sortOrder: 190,
  },
  {
    id: 'sorento-hybrid',
    name: 'Sorento Hybrid',
    fullName: 'Kia Sorento Hybrid',
    categories: ['suv', 'elektro-hybrid', 'familie'],
    segment: 'Hybrid-SUV',
    powertrain: 'hybrid',
    priceFromGross: 55190,
    monthlyRateFrom: 525,
    monthlyRateAvailable: true,
    wltpText: 'Kia Sorento Hybrid (176 kW/239 PS): Kraftstoffverbrauch kombiniert 6,6 – 7,0 l/100 km; CO₂-Emissionen kombiniert 150 – 159 g/km.',
    co2Class: 'E – F',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sorento',
    sortOrder: 200,
  },
  {
    id: 'sorento-phev',
    name: 'Sorento Plug-in Hybrid',
    fullName: 'Kia Sorento Plug-in Hybrid',
    categories: ['suv', 'elektro-hybrid', 'familie'],
    segment: 'Plug-in-Hybrid-SUV',
    powertrain: 'plugin-hybrid',
    priceFromGross: 61140,
    monthlyRateFrom: 635,
    monthlyRateAvailable: true,
    wltpText:
      'Kraftstoffverbrauch gewichtet kombiniert 1,6 l/100 km; Stromverbrauch gewichtet kombiniert 18,4 kWh/100 km; ' +
      'CO₂-Emissionen gewichtet kombiniert 38 g/km. CO₂-Klasse B. ' +
      'Kraftstoffverbrauch bei entladener Batterie kombiniert 7,6 l/100 km; CO₂-Klasse bei entladener Batterie F.',
    co2Class: 'B',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: 'sorento',
    sortOrder: 210,
  },
  {
    id: 'ev9',
    name: 'EV9',
    fullName: 'Kia EV9',
    categories: ['elektro-hybrid', 'suv', 'familie'],
    segment: 'Elektro-Großraum-SUV',
    powertrain: 'elektro',
    priceFromGross: 63690,
    monthlyRateFrom: 759,
    monthlyRateAvailable: true,
    wltpText: 'Stromverbrauch kombiniert 20,2 – 22,8 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 220,
  },
  {
    id: 'ev9-gt',
    name: 'EV9 GT',
    fullName: 'Kia EV9 GT',
    categories: ['elektro-hybrid', 'suv', 'gt', 'familie'],
    segment: 'Elektro-GT-SUV',
    powertrain: 'elektro',
    priceFromGross: 90490,
    monthlyRateFrom: 1082,
    monthlyRateAvailable: true,
    wltpText: 'Kia EV9 GT 374 kW (508 PS): Stromverbrauch kombiniert 22,8 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 230,
  },
  {
    id: 'pv5-passenger',
    name: 'PV5 Passenger',
    fullName: 'Kia PV5 Passenger',
    categories: ['pbv'],
    segment: 'Elektro-Nutzfahrzeug',
    powertrain: 'nutzfahrzeug',
    priceFromGross: 38290,
    monthlyRateFrom: 339,
    monthlyRateAvailable: true,
    wltpText:
      'Elektromotor, 120 kW, FWD, 71,2-kWh-Batterie; 120 kW (163 PS): Stromverbrauch kombiniert 19,3 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 240,
  },
  {
    id: 'pv5-cargo-l2h1',
    name: 'PV5 Cargo L2H1',
    fullName: 'Kia PV5 Cargo L2H1',
    categories: ['pbv'],
    segment: 'Elektro-Transporter',
    powertrain: 'nutzfahrzeug',
    priceFromGross: 39190,
    monthlyRateFrom: 387,
    monthlyRateAvailable: true,
    wltpText:
      '4-Türer Elektromotor, 120 kW, FWD, 71,2-kWh-Batterie; 120 kW (163 PS): Stromverbrauch kombiniert 19,1 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 250,
  },
  {
    id: 'pv5-chassis-cab',
    name: 'PV5 Chassis Cab',
    fullName: 'Kia PV5 Chassis Cab',
    categories: ['pbv'],
    segment: 'Elektro-Fahrgestell',
    powertrain: 'nutzfahrzeug',
    priceFromGross: 38390,
    monthlyRateFrom: null,
    monthlyRateAvailable: false,
    wltpText: 'Stromverbrauch kombiniert: aufbauabhängig; CO₂-Emissionen kombiniert: 0 g/km.',
    co2Class: 'A',
    priceListAvailable: true,
    orderable: true,
    orderNote: null,
    registryKey: null,
    sortOrder: 260,
  },
  {
    id: 'pv5-crew',
    name: 'PV5 Crew',
    fullName: 'Kia PV5 Crew',
    categories: ['pbv'],
    segment: 'Elektro-Nutzfahrzeug',
    powertrain: 'nutzfahrzeug',
    priceFromGross: null,
    monthlyRateFrom: null,
    monthlyRateAvailable: false,
    wltpText:
      'Der Kia PV5 Crew steht noch nicht zum Verkauf. Homologation und Energieverbrauchsermittlung erfolgen unmittelbar vor der Markteinführung.',
    co2Class: null,
    priceListAvailable: false,
    orderable: true,
    orderNote: 'Jetzt bestellbar – Preis folgt mit Markteinführung',
    registryKey: null,
    sortOrder: 270,
  },
];

const MODEL_BY_ID = new Map(KIA_OFFICIAL_MODELS.map((m) => [m.id, m]));

export function getKiaOfficialModel(modelId) {
  return MODEL_BY_ID.get(modelId) ?? null;
}

export function listKiaOfficialModels(filter = {}) {
  let list = [...KIA_OFFICIAL_MODELS];
  if (filter.category) {
    list = list.filter((m) => m.categories.includes(filter.category));
  }
  if (filter.powertrain) {
    list = list.filter((m) => m.powertrain === filter.powertrain);
  }
  if (filter.registryOnly) {
    list = list.filter((m) => m.registryKey);
  }
  if (filter.withPrice) {
    list = list.filter((m) => m.priceFromGross != null);
  }
  return list.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getKiaOfficialModelIds() {
  return KIA_OFFICIAL_MODELS.map((m) => m.id);
}

export function getKiaOfficialModelsByRegistryKey(registryKey) {
  return KIA_OFFICIAL_MODELS.filter((m) => m.registryKey === registryKey);
}

export function formatKiaPriceFrom(priceGross) {
  if (priceGross == null) return 'Preis folgt';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(priceGross);
}

export function formatKiaMonthlyRate(rate) {
  if (rate == null) return '–';
  if (rate === 0) return '0 €/Monat';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(rate) + '/Monat';
}

export function getKiaOfficialCatalogSummary() {
  return {
    meta: KIA_PRICE_LIST_META,
    modelCount: KIA_OFFICIAL_MODELS.length,
    withFullRegistry: KIA_OFFICIAL_MODELS.filter((m) =>
      ['sportage', 'ev3'].includes(m.registryKey),
    ).length,
    categories: KIA_NAV_CATEGORIES,
  };
}

/** Ceed – auf Kia-Website unter Kompakt, Preis über Händler/Modellseite; Marketplace-Referenz */
export const KIA_OFFICIAL_MODEL_ALIASES = {
  ceed: {
    id: 'ceed',
    name: 'Ceed',
    fullName: 'Kia Ceed',
    note: 'Modell auf kia.com/de – Preisliste über Modell-Konfigurator; im Clever-Marketplace als Demo.',
    registryKey: 'ceed',
  },
};
