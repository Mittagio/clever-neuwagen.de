/** Max. sichtbare Empfehlungen auf der Händler-Landing (Demo / Tagung). */
export const DEALER_MAX_RECOMMENDATIONS = 3;

export const DEALER_SEARCH_PLACEHOLDERS = [
  'Suche Elektroauto unter 300 € Leasing …',
  'Suche 7-Sitzer mit großer Reichweite …',
  'Suche Auto für Wohnwagen …',
  'Suche Fahrzeug bis 4 m Länge …',
  'Suche Auto mit 3 Isofix …',
  'Suche Hybrid mit 2 t Anhängelast …',
  'Suche Familienauto bis 35.000 € …',
  'Suche Elektroauto für 7000 km pro Jahr …',
  'Suche Auto für Garage mit 2 m Höhe …',
  'Suche Fahrzeug mit großem Kofferraum …',
];

/** Strukturierte Mehrfach-Chips – siehe dealerWishChips.js */
export { DEALER_WISH_CHIPS as DEALER_SEARCH_CHIPS } from '../services/dealer/dealerWishChips.js';

/** Kia Modellkacheln – Inspiration direkt unter der Suchmaske (swipebar). */
export const KIA_MODEL_WORLD = [
  {
    id: 'ev2',
    name: 'EV2',
    tagline: 'Kompakt für Stadt und Alltag',
    modelKey: 'ev2',
    rateFrom: 239,
    priceFrom: 26600,
    searchQuery: 'Kia EV2 Elektro',
  },
  {
    id: 'ev3',
    name: 'EV3',
    tagline: 'Der Reichweiten-Champion',
    modelKey: 'ev3',
    rateFrom: 299,
    priceFrom: 35990,
    searchQuery: 'Kia EV3 Elektro',
  },
  {
    id: 'ev4',
    name: 'EV4',
    tagline: 'Moderne Elektro-Limousine',
    modelKey: 'ev4',
    rateFrom: 269,
    priceFrom: 37590,
    searchQuery: 'Kia EV4 Elektro',
  },
  {
    id: 'ev5',
    name: 'EV5',
    tagline: 'Großes Elektro-SUV für die Familie',
    modelKey: 'ev5',
    rateFrom: 419,
    priceFrom: 45990,
    searchQuery: 'Kia EV5 Elektro',
  },
  {
    id: 'sportage',
    name: 'Sportage',
    tagline: 'Familien-SUV mit viel Platz',
    modelKey: 'sportage',
    rateFrom: 199,
    priceFrom: 33990,
    searchQuery: 'Kia Sportage Hybrid',
  },
  {
    id: 'pv5-passenger',
    name: 'PV5',
    tagline: 'Flexible Mobilität für Familie und Gewerbe',
    modelKey: 'pv5-passenger',
    rateFrom: 339,
    priceFrom: 38290,
    searchQuery: 'Kia PV5 Elektro',
    kiaPrefix: false,
  },
];

export const DEALER_WHY_BENEFITS = [
  { id: 'werkstatt', icon: '🔧', title: 'Eigene Werkstatt' },
  { id: 'elektro', icon: '⚡', title: 'E-Mobilitäts-Spezialist' },
  { id: 'kia', icon: '🚗', title: 'Kia Vertragspartner' },
  { id: 'beratung', icon: '👤', title: 'Persönlicher Ansprechpartner' },
];
