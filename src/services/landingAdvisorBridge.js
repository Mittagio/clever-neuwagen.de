/**
 * Landing → Kaufberater: Freitext/Chips in Berater-Profil übersetzen
 * Später: LLM / Speech-to-Text Anbindung
 */

import {
  parseLocationFromText,
  parseAdvisorLocationFromParams,
} from '../logic/advisorLocation.js';
import { buildFahrzeugeUrlFromAdvisorProfile } from './advisor/advisorRouteBridge.js';

export const LANDING_EXAMPLE_CHIPS = [
  {
    id: 'family',
    label: '👨‍👩‍👧‍👦 Familienauto bis 400 €',
    text: 'Ich suche ein Familienauto für maximal 400 € Leasingrate im Monat.',
    profile: { desiredRate: 400, household: 'family', bodyType: 'suv', wishes: ['viel-platz'] },
  },
  {
    id: 'electro',
    label: '⚡ Elektroauto für 20.000 km/Jahr',
    text: 'Welches Elektroauto passt zu mir? Ich fahre 20.000 km im Jahr.',
    profile: { mileage: '15k-20k', fuelPreference: 'elektro', bodyType: 'suv', wishes: ['reichweite'] },
  },
  {
    id: 'suv-tow',
    label: '🚙 SUV mit Anhängerkupplung',
    text: 'Ich suche einen SUV mit Anhängerkupplung.',
    profile: { bodyType: 'suv', fuelPreference: 'hybrid', wishes: ['anhaenger', 'allrad'] },
  },
  {
    id: 'company',
    label: '🏢 Firmenwagen unter 500 €',
    text: 'Ich brauche einen Firmenwagen unter 500 € monatlich.',
    profile: { desiredRate: 500, household: 'couple', wishes: ['gewerblich'], fuelPreference: 'hybrid' },
  },
  {
    id: 'tiguan',
    label: '🐕 Nachfolger für meinen Tiguan',
    text: 'Ich fahre aktuell einen Tiguan und möchte auf Elektro umsteigen.',
    profile: { bodyType: 'suv', fuelPreference: 'elektro', desiredRate: 450, wishes: ['reichweite', 'viel-platz'] },
  },
  {
    id: 'dog',
    label: '🐕 Auto für Familie mit Hund',
    text: 'Auto für Familie mit Hund, viel Platz und maximal 380 €.',
    profile: { desiredRate: 380, household: 'family-dog', bodyType: 'suv', wishes: ['viel-platz'] },
  },
];

export const LANDING_TRENDING = [
  {
    id: 'trend-niro',
    title: 'Kia Niro EV Air',
    brand: 'Kia',
    model: 'Niro',
    trim: 'Air',
    badge: 'Familie',
    badgeTone: 'violet',
    description: 'Der perfekte Einstieg in die Elektromobilität.',
    profile: { fuelPreference: 'elektro', bodyType: 'suv', desiredRate: 399 },
    mockRate: '399 €',
    saving: '5.890 €',
    delivery: '4–6 Wochen',
    mileage: '10.000 km/J',
    visual: 'niro',
  },
  {
    id: 'trend-ev3',
    title: 'Kia EV3 Long Range',
    brand: 'Kia',
    model: 'EV3',
    trim: 'Long Range',
    badge: 'Elektro',
    badgeTone: 'green',
    description: 'Kompakt, modern und voller Technik.',
    profile: { fuelPreference: 'elektro', bodyType: 'kompakt', desiredRate: 349, wishes: ['reichweite'] },
    mockRate: '349 €',
    saving: '4.200 €',
    delivery: '8–10 Wochen',
    mileage: '15.000 km/J',
    visual: 'ev3',
  },
  {
    id: 'trend-sportage',
    title: 'Kia Sportage Spirit',
    brand: 'Kia',
    model: 'Sportage',
    trim: 'Spirit',
    badge: 'SUV',
    badgeTone: 'violet',
    description: 'Stilvoll, geräumig und alltagstauglich.',
    profile: { bodyType: 'suv', fuelPreference: 'hybrid', desiredRate: 379 },
    mockRate: '379 €',
    saving: '6.100 €',
    delivery: '2–4 Wochen',
    mileage: '10.000 km/J',
    visual: 'sportage',
  },
  {
    id: 'trend-ceed',
    title: 'Kia Ceed SW Plug-in Hybrid',
    brand: 'Kia',
    model: 'Ceed',
    trim: 'Sportswagon',
    badge: 'Business',
    badgeTone: 'blue',
    description: 'Ideal für Vielfahrer und Pendler.',
    profile: { bodyType: 'kombi', fuelPreference: 'hybrid', desiredRate: 329, wishes: ['gewerblich'] },
    mockRate: '329 €',
    saving: '3.750 €',
    delivery: '6–8 Wochen',
    mileage: '20.000 km/J',
    visual: 'ceed',
  },
];

function parseRate(text) {
  const m = text.match(/(?:maximal|max\.?|unter|bis)\s*(\d{2,4})\s*€/i)
    ?? text.match(/(\d{2,4})\s*€?\s*(?:\/|pro\s*)?(?:monat|mt)/i);
  return m ? Number(m[1]) : null;
}

function parseMaxPrice(text) {
  const m = text.match(/(?:bis|unter)\s*(\d{1,3}(?:\.\d{3})+|\d{4,6})\s*€/i);
  if (!m) return null;
  return Number(m[1].replace(/\./g, ''));
}

function parseMileageId(text) {
  if (/20\.?000|20000/.test(text)) return '15k-20k';
  if (/15\.?000|15000/.test(text)) return '10k-15k';
  if (/10\.?000|10000/.test(text)) return 'under-10k';
  if (/über\s*20|over\s*20/i.test(text)) return 'over-20k';
  return '';
}

function parsePaymentType(text) {
  const lower = text.toLowerCase();
  if (/leasing/i.test(lower)) return 'leasing';
  if (/finanzier/i.test(lower)) return 'finance';
  if (/bar|kauf|sofort/i.test(lower)) return 'cash';
  return undefined;
}

export function parseLandingQuery(text) {
  const t = text.trim();
  const lower = t.toLowerCase();
  const profile = {
    desiredRate: parseRate(t) ?? undefined,
    maxPrice: parseMaxPrice(t) ?? undefined,
    mileage: parseMileageId(t) || undefined,
    household: undefined,
    fuelPreference: undefined,
    bodyType: undefined,
    paymentType: parsePaymentType(t),
    wishes: [],
  };

  if (/familie.*hund|hund.*familie/i.test(t)) profile.household = 'family-dog';
  else if (/familie|kinder|kind/i.test(t)) profile.household = 'family';
  else if (/paar|zu zweit/i.test(t)) profile.household = 'couple';

  if (/elektro|e-auto|ev\b|strom/i.test(lower)) profile.fuelPreference = 'elektro';
  else if (/hybrid|plug-in|phev/i.test(lower)) profile.fuelPreference = 'hybrid';
  else if (/diesel|benzin|verbrenner/i.test(lower)) profile.fuelPreference = 'verbrenner';

  if (/suv|familien/i.test(lower)) profile.bodyType = 'suv';
  else if (/kombi/i.test(lower)) profile.bodyType = 'kombi';
  else if (/limousine/i.test(lower)) profile.bodyType = 'limousine';
  else if (/kleinwagen|mini|city/i.test(lower)) profile.bodyType = 'kleinwagen';

  if (/anhänger|anhaenger|kupplung|anhängelast|anhaengelast/i.test(lower)) profile.wishes.push('anhaenger');
  if (/reichweite|weit fahren|\d+\s*km/i.test(lower)) profile.wishes.push('reichweite');
  if (/lieferung|schnell|sofort|lager/i.test(lower)) profile.wishes.push('schnelle-lieferung');
  if (/platz|groß|gross/i.test(lower)) profile.wishes.push('viel-platz');
  if (/firmen|gewerb|dienstwagen|company/i.test(lower)) profile.wishes.push('gewerblich');

  if (/tiguan|wechsel|umsteig/i.test(lower) && !profile.fuelPreference) {
    profile.fuelPreference = 'elektro';
    profile.bodyType = profile.bodyType ?? 'suv';
  }

  if (!profile.desiredRate && /350/.test(t)) profile.desiredRate = 350;
  if (!profile.desiredRate && /400/.test(t)) profile.desiredRate = 400;

  const location = parseLocationFromText(t);

  return { profile, query: t, location };
}

export function buildAdvisorUrl(profile = {}, query = '', options = {}) {
  return buildFahrzeugeUrlFromAdvisorProfile(profile, query, options);
}

export function profileFromChip(chip) {
  return {
    profile: chip.profile ?? parseLandingQuery(chip.text).profile,
    query: chip.text,
  };
}

/** URL-Parameter von Landing → Berater-Profil */
export { parseAdvisorUrlProfile } from './advisor/advisorRouteBridge.js';

export { parseAdvisorLocationFromParams, DEFAULT_LOCATION_RADIUS_KM } from '../logic/advisorLocation.js';
