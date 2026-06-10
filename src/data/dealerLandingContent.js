/** Max. sichtbare Empfehlungen auf der Händler-Landing (Demo / Tagung). */
export const DEALER_MAX_RECOMMENDATIONS = 3;

export const DEALER_SEARCH_PLACEHOLDERS = [
  'Beschreiben Sie Ihr Wunschauto…',
  'Elektroauto bis 300 €',
  'Hybrid mit Anhängerkupplung',
  'Familienauto mit 3 Isofix',
];

/** Strukturierte Mehrfach-Chips – siehe dealerWishChips.js */
export { DEALER_WISH_CHIPS as DEALER_SEARCH_CHIPS } from '../services/dealer/dealerWishChips.js';

/** Kia Modellwelt – große Swipe-Karten direkt unter der Suche */
export const KIA_MODEL_WORLD = [
  {
    id: 'ev2',
    name: 'EV2',
    tagline: 'Der kompakte City-Stromer',
    modelKey: 'ev2',
    rateFrom: 239,
    priceFrom: 26600,
    searchQuery: 'Kia EV2 Elektro',
  },
  {
    id: 'ev3',
    name: 'EV3',
    tagline: 'Der Allrounder für Familien',
    modelKey: 'ev3',
    rateFrom: 299,
    priceFrom: 35990,
    searchQuery: 'Kia EV3 Elektro',
  },
  {
    id: 'ev4',
    name: 'EV4',
    tagline: 'Die elektrische Limousine',
    modelKey: 'ev4',
    rateFrom: 269,
    priceFrom: 37590,
    searchQuery: 'Kia EV4 Elektro',
  },
  {
    id: 'ev5',
    name: 'EV5',
    tagline: 'Das Familien-SUV',
    modelKey: 'ev5',
    rateFrom: 419,
    priceFrom: 45990,
    searchQuery: 'Kia EV5 Elektro',
  },
  {
    id: 'ev6',
    name: 'EV6',
    tagline: 'Das Premium-Elektrofahrzeug',
    modelKey: 'ev6',
    rateFrom: 399,
    priceFrom: 44990,
    searchQuery: 'Kia EV6 Elektro',
  },
  {
    id: 'ev9',
    name: 'EV9',
    tagline: 'Der Elektro-Großraum mit 7 Sitzen',
    modelKey: 'ev9',
    rateFrom: 759,
    priceFrom: 63690,
    searchQuery: 'Kia EV9 7-Sitzer Elektro',
  },
  {
    id: 'niro',
    name: 'Niro EV',
    tagline: 'Kompakt, elektrisch, alltagstauglich',
    modelKey: 'niro',
    rateFrom: 349,
    priceFrom: 39990,
    searchQuery: 'Kia Niro Elektro',
  },
  {
    id: 'sportage',
    name: 'Sportage',
    tagline: 'Das beliebte Familien-SUV',
    modelKey: 'sportage',
    rateFrom: 199,
    priceFrom: 33990,
    searchQuery: 'Kia Sportage Hybrid',
  },
  {
    id: 'sorento',
    name: 'Sorento',
    tagline: 'Der geräumige 7-Sitzer',
    modelKey: 'sorento',
    rateFrom: 499,
    priceFrom: 56690,
    searchQuery: 'Kia Sorento 7-Sitzer',
  },
  {
    id: 'pv5-passenger',
    name: 'PV5',
    tagline: 'Elektro für Gewerbe und Familie',
    modelKey: 'pv5-passenger',
    rateFrom: 339,
    priceFrom: 38290,
    searchQuery: 'Kia PV5 Elektro',
  },
];

export const DEALER_WHY_BENEFITS = [
  { id: 'werkstatt', icon: '🔧', title: 'Eigene Werkstatt' },
  { id: 'elektro', icon: '⚡', title: 'E-Mobilitäts-Spezialist' },
  { id: 'kia', icon: '🚗', title: 'Kia Vertragspartner' },
  { id: 'beratung', icon: '👤', title: 'Persönlicher Ansprechpartner' },
];
