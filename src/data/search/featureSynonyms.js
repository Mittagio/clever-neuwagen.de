/**
 * Feature-Synonyme für Intent-Parsing (längere Phrasen zuerst matchen)
 */

import { buildFeatureSynonymGroupsFromDictionary } from './customerFeatureDictionary.js';

const DICTIONARY_GROUPS = buildFeatureSynonymGroupsFromDictionary();

export const FEATURE_SYNONYM_GROUPS = [
  ...DICTIONARY_GROUPS,
  {
    id: 'parking_front',
    patterns: [
      'parksensoren vorne',
      'pdc vorne',
      'einparkhilfe vorne',
      'parkpiepser vorne',
      'parksensor vorne',
    ],
  },
  {
    id: 'rear_camera',
    patterns: [
      'rückfahrkamera',
      'rueckfahrkamera',
      'rückkamera',
      'rueckkamera',
      'heckkamera',
      'kamera hinten',
      'kamerea hinten',
      'rear camera',
    ],
  },
  {
    id: 'parking_rear',
    patterns: [
      'parksensoren hinten',
      'pdc hinten',
    ],
  },
  {
    id: 'blind_spot',
    patterns: [
      'totwinkelassistent',
      'totwinkel',
      'toter winkel',
      'blind spot',
      'spurwechselassistent',
      'bca',
    ],
  },
  {
    id: 'towbar',
    patterns: [
      'anhänger ziehen',
      'anhaenger ziehen',
      'abschleppkupplung',
    ],
  },
  {
    id: 'navigation',
    patterns: ['navi', 'navigation', 'navi 10', 'navi 12'],
  },
  {
    id: 'panorama_roof',
    patterns: ['panoramadach', 'panorama dach', 'glasdach', 'schiebedach', 'glass roof'],
  },
  {
    id: 'head_up_display',
    patterns: ['head-up display', 'head up display', 'hud', 'projektionsdisplay'],
  },
  {
    id: 'remote_parking',
    patterns: ['remote park', 'fernparken', 'remote parking'],
  },
  {
    id: 'fast_charge',
    patterns: [
      'schnellladen',
      'schnell laden',
      'dc schnellladen',
      'dc-laden',
      'dc laden',
      'ccs lader',
      'ccs lade',
      'ccs',
      'ionity',
      'schnelllader',
      'ultraschnell laden',
      'fast charge',
      'ladesaeule schnell',
      'ladesäule schnell',
    ],
  },
  {
    id: 'charge_800v',
    patterns: ['800v technik', '800-volt', '800 volt', '800 v', '800v'],
  },
];

/** Geschützte Zahlen-Kontexte – „360“ nicht als Modell */
export const PROTECTED_NUMBER_CONTEXTS = [
  {
    id: 'camera_360',
    numberPattern: /\b360\b/,
    requireNearby: /\b(grad|°|kamera|cam|rundum|view|sensor|surround|bird|park)/i,
    window: 40,
  },
  {
    id: 'range_km',
    numberPattern: /\b(\d{2,4})\b/,
    requireNearby: /\b(km|kilometer|reichweite|range|weit)/i,
    window: 30,
  },
  {
    id: 'tow_ton',
    numberPattern: /\b2\b/,
    requireNearby: /\b(tonnen?|t\b|anhängelast|anhaengelast|ziehen)/i,
    window: 35,
  },
];

export const FUEL_SYNONYMS = {
  elektro: [
    'elektro',
    'elektroauto',
    'e-auto',
    'e auto',
    'stromer',
    'bev',
    'elektrisch',
    'vollelektrisch',
  ],
  hybrid: ['vollhybrid', 'hybrid', 'hev'],
  plugin_hybrid: ['plugin-hybrid', 'plugin hybrid', 'plug-in', 'plugin', 'phev', 'steckerhybrid', 'plug in hybrid'],
  verbrenner: ['benziner', 'benzin', 'verbrenner', 'otto'],
  diesel: ['diesel', 'crdi', 'tdi'],
};

export const PAYMENT_SYNONYMS = {
  leasing: ['leasing', 'lease', 'monatlich', 'monatsrate', 'rate'],
  cash: ['kauf', 'bar', 'barzahlung', 'sofortkauf', 'einmalzahlung'],
  finance: ['finanzierung', 'finanzieren', 'kredit'],
};

export const AVAILABILITY_SYNONYMS = {
  sofort: [
    'sofort verfügbar',
    'sofort verfuegbar',
    'sofort lieferbar',
    'lagernd',
    'auf lager',
    'steht da',
    'kurzfristig',
    'direkt verfügbar',
    'zeitnahe verfügbarkeit',
    'zeitnahe verfuegbarkeit',
    'zeitnahe lieferung',
    'zeitnah verfügbar',
    'zeitnah verfuegbar',
    'zeitnah',
    'schnell verfügbar',
    'schnell verfuegbar',
    'sofort',
    'lagerfahrzeug',
    'lagerwagen',
    'vom hof',
    'vorführwagen',
    'vorfuehrwagen',
    'bestandsfahrzeug',
    'bestandswagen',
  ],
};

export const MODEL_CATALOG = [
  { brand: 'Kia', model: 'Sportage Plug-in Hybrid', patterns: ['sportage plug-in', 'sportage phev', 'sportage plug in hybrid'] },
  { brand: 'Kia', model: 'Sportage Hybrid', patterns: ['sportage hybrid'] },
  { brand: 'Kia', model: 'Sportage', patterns: ['sportage'] },
  { brand: 'Kia', model: 'EV9 GT', patterns: ['ev9 gt', 'ev 9 gt'] },
  { brand: 'Kia', model: 'EV9', patterns: ['ev9', 'ev 9'] },
  { brand: 'Kia', model: 'EV6 GT', patterns: ['ev6 gt', 'ev 6 gt'] },
  { brand: 'Kia', model: 'EV6', patterns: ['ev6', 'ev 6'] },
  { brand: 'Kia', model: 'EV5 GT', patterns: ['ev5 gt', 'ev 5 gt'] },
  { brand: 'Kia', model: 'EV5', patterns: ['ev5', 'ev 5'] },
  { brand: 'Kia', model: 'EV4 Fastback', patterns: ['ev4 fastback', 'ev 4 fastback'] },
  { brand: 'Kia', model: 'EV4', patterns: ['ev4', 'ev 4'] },
  { brand: 'Kia', model: 'EV3', patterns: ['ev3', 'ev 3'] },
  { brand: 'Kia', model: 'EV2', patterns: ['ev2', 'ev 2'] },
  { brand: 'Kia', model: 'Niro EV', patterns: ['niro ev'] },
  { brand: 'Kia', model: 'Niro Hybrid', patterns: ['niro hybrid'] },
  { brand: 'Kia', model: 'Niro EV', patterns: ['niro'] },
  { brand: 'Kia', model: 'Ceed SW', patterns: ['ceed sw', 'ceed'] },
  { brand: 'Kia', model: 'Picanto', patterns: ['picanto'] },
  { brand: 'Kia', model: 'Sorento', patterns: ['sorento'] },
  { brand: 'Kia', model: 'Carnival', patterns: ['carnival'] },
  { brand: 'Kia', model: 'Stonic', patterns: ['stonic'] },
  { brand: 'Ford', model: 'Kuga', patterns: ['kuga'] },
  { brand: 'Ferrari', model: '360', patterns: ['ferrari 360', 'ferrari'], requireBrand: true },
];

export const BRAND_PATTERNS = [
  { brand: 'Kia', patterns: ['kia'] },
  { brand: 'Ford', patterns: ['ford'] },
  { brand: 'Hyundai', patterns: ['hyundai'] },
  { brand: 'MG', patterns: ['mg'] },
  { brand: 'Ferrari', patterns: ['ferrari'] },
];

export const TRIM_PATTERNS = [
  { trim: 'Vision', patterns: ['vision'] },
  { trim: 'Spirit', patterns: ['spirit'] },
  { trim: 'GT-Line', patterns: ['gt-line', 'gt line'] },
  { trim: 'GT-Line AWD', patterns: ['gt-line awd'] },
  { trim: 'Air', patterns: [' air', '^air '] },
];
