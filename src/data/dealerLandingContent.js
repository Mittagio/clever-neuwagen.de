export const DEALER_SEARCH_PLACEHOLDERS = [
  'Elektroauto über 400 km Reichweite für Familie unter 400 €',
  '7-Sitzer mit Anhängerkupplung',
  'Sofort verfügbares Elektroauto',
];

export const DEALER_SEARCH_CHIPS = [
  { label: 'SUV Familie', query: 'SUV Familie unter 400 Euro' },
  { label: 'Elektro bis 400 €', query: 'Elektro bis 400 Euro' },
  { label: 'Sofort verfügbar', query: 'Sofort verfügbar' },
  { label: 'Sportage Hybrid', query: 'Sportage Hybrid' },
  { label: '7-Sitzer', query: '7-Sitzer SUV' },
  { label: 'Anhängerkupplung', query: 'Anhängerkupplung SUV' },
];

/** Kia Modellwelt – Swipe-Karten nach der Suche */
export const KIA_MODEL_WORLD = [
  {
    id: 'ev2',
    name: 'EV2',
    tagline: 'Der kompakte City-Stromer',
    modelKey: 'ev2',
    rateFrom: 239,
    priceFrom: 26600,
    searchQuery: 'Kia EV2',
  },
  {
    id: 'ev3',
    name: 'EV3',
    tagline: 'Der Allrounder für Familien',
    modelKey: 'ev3',
    rateFrom: 299,
    priceFrom: 35990,
    searchQuery: 'Kia EV3',
  },
  {
    id: 'ev4',
    name: 'EV4',
    tagline: 'Die elektrische Limousine',
    modelKey: 'ev4',
    rateFrom: 269,
    priceFrom: 37590,
    searchQuery: 'Kia EV4',
  },
  {
    id: 'ev5',
    name: 'EV5',
    tagline: 'Das Familien-SUV',
    modelKey: 'ev5',
    rateFrom: 419,
    priceFrom: 45990,
    searchQuery: 'Kia EV5',
  },
  {
    id: 'ev6',
    name: 'EV6',
    tagline: 'Das Premium-Elektrofahrzeug',
    modelKey: 'ev6',
    rateFrom: 399,
    priceFrom: 44990,
    searchQuery: 'Kia EV6',
  },
  {
    id: 'sportage',
    name: 'Sportage',
    tagline: 'Das beliebte Familien-SUV',
    modelKey: 'sportage',
    rateFrom: 199,
    priceFrom: 33990,
    searchQuery: 'Kia Sportage',
  },
  {
    id: 'sorento',
    name: 'Sorento',
    tagline: 'Der geräumige 7-Sitzer',
    modelKey: 'sorento',
    rateFrom: 499,
    priceFrom: 56690,
    searchQuery: 'Kia Sorento',
  },
];

export const DEALER_WHY_BENEFITS = [
  { id: 'beratung', icon: '👤', title: 'Persönliche Beratung' },
  { id: 'werkstatt', icon: '🛠️', title: 'Eigene Werkstatt' },
  { id: 'elektro', icon: '⚡', title: 'Elektrofahrzeug-Kompetenz' },
  { id: 'probefahrt', icon: '🚗', title: 'Probefahrt vor Ort' },
];
