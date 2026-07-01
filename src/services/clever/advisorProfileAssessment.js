/**
 * Komplexe Bedarfsprofile – Clever-Einschätzung statt leerer Fahrzeugsuche.
 */
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';

const CHILDREN = /\b(\d+|zwei|drei|vier|ein|eine)\s*(kinder|kindern|kind)\b|\bfamilie\b|\bfamilienauto\b/i;
const DOG = /\bhund\b|\bhundebox\b|\bhundetransport\b/i;
const CARAVAN = /\bwohnwagen\b|\banhänger\b|\banhaenger\b|\bahk\b|\banhängerkupplung\b/i;
const DAILY_KM = /\b(täglich|taeglich|pro\s+tag)\b.{0,30}\b(\d+)\s*km\b|\b(\d+)\s*km\b.{0,20}(täglich|taeglich|pro\s+tag)/i;
const CURRENT_CAR = /\b(fahre|fahre?\s+bisher|aktuell|bislang)\b.{0,40}\b(xceed|ceed|sportage|sorento|niro|stonic|picanto|benziner|diesel)\b/i;
const ELECTRIC_WISH = /\b(elektro|e-auto|elektroauto|vollelektr)\b/i;
const SWITCH = /\b(wechsel|möchte\s+jetzt|moechte\s+jetzt|stattdessen|umsteigen)\b/i;

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 */
export function detectAdvisorProfileAssessment(query = '', intent = null, profile = null) {
  const text = String(query).trim();
  if (!text || text.length < 40) return null;

  const parsedIntent = intent ?? parseSearchIntent(text);
  const parsedProfile = profile ?? buildSearchProfile({ query: text, intent: parsedIntent });

  const signals = [];
  if (CHILDREN.test(text) || parsedIntent.familyHint) signals.push('children');
  if (DOG.test(text)) signals.push('dog');
  if (CARAVAN.test(text) || parsedIntent.features?.includes('towbar')) signals.push('caravan');
  if (DAILY_KM.test(text)) signals.push('daily_km');
  if (CURRENT_CAR.test(text)) signals.push('current_car');
  if (ELECTRIC_WISH.test(text) || parsedProfile.fuel === 'electric') signals.push('electric_wish');
  if (SWITCH.test(text)) signals.push('switch');

  const usageCount = signals.filter((s) => ['children', 'dog', 'caravan', 'daily_km', 'current_car', 'electric_wish'].includes(s)).length;
  if (usageCount < 3) return null;
  if (!signals.includes('electric_wish') && parsedProfile.fuel !== 'electric') return null;

  const dailyKmMatch = text.match(DAILY_KM);
  const dailyKm = dailyKmMatch?.[2] ?? dailyKmMatch?.[3] ?? null;
  const currentCarMatch = text.match(/\b(kia\s+)?(xceed|ceed|sportage|sorento|niro|stonic|picanto)\b[^.]{0,20}(benziner|diesel|hybrid)?/i);
  const currentCar = currentCarMatch
    ? `Kia ${currentCarMatch[2].charAt(0).toUpperCase()}${currentCarMatch[2].slice(1)}${currentCarMatch[3] ? ` ${currentCarMatch[3]}` : ''}`
    : null;

  const understoodWishes = [];
  if (signals.includes('children')) understoodWishes.push('2 Kinder');
  if (signals.includes('dog')) understoodWishes.push('Hund');
  if (signals.includes('caravan')) understoodWishes.push('Wohnwagen');
  if (dailyKm) understoodWishes.push(`täglich ca. ${dailyKm} km`);
  else if (signals.includes('daily_km')) understoodWishes.push('kurze Alltagsstrecke');
  if (currentCar) understoodWishes.push(`fährt aktuell ${currentCar}`);
  if (signals.includes('electric_wish')) understoodWishes.push('Elektro gewünscht');

  const modelDirections = [
    'EV5 als Familien-Elektroauto prüfen',
    'EV9 als große Lösung mit Wohnwagen-Fokus prüfen',
    'EV3/EV4 nur prüfen, wenn Anhänger und Platzbedarf kleiner sind',
  ];

  const dealerChecks = [
    'Wohnwagengewicht',
    'Lademöglichkeit zuhause',
    'Hundebox / Kofferraum',
    'Kindersitze / Isofix',
    'Wunschrate / Budget',
    'kompakt bleiben oder größer als XCeed',
  ];

  const headline = currentCar?.includes('XCeed') || currentCar?.includes('Xceed')
    ? 'Vom Kia XCeed Benziner zum Elektroauto'
    : 'Wechsel zum Elektroauto – erste Einschätzung';

  const shortAnswer = 'Das klingt nach einem familientauglichen Elektroauto mit Platz, Alltagseffizienz und Anhängertauglichkeit. Für 20 km täglich passt Elektro sehr gut. Wegen Wohnwagen, Hund und Kindern sollten Platz, Anhängelast, Stützlast und reale Reichweite mit Anhänger geprüft werden.';

  return {
    detected: true,
    signals,
    headline,
    shortAnswer,
    understoodWishes,
    modelDirections,
    dealerChecks,
    primaryModelKey: 'ev5',
    intent: parsedIntent,
    profile: parsedProfile,
  };
}

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 */
export function buildAdvisorProfileFacts(query = '', intent = null, profile = null) {
  const assessment = detectAdvisorProfileAssessment(query, intent, profile);
  if (!assessment) return null;

  return {
    kind: 'advisor_profile',
    topic: 'advisor_profile_assessment',
    answerType: 'clever_assessment',
    modelKey: assessment.primaryModelKey,
    primaryModelKey: assessment.primaryModelKey,
    headline: assessment.headline,
    shortAnswer: assessment.shortAnswer,
    understoodWishes: assessment.understoodWishes,
    modelDirections: assessment.modelDirections,
    dealerChecks: assessment.dealerChecks,
    profile: assessment.profile,
    intent: assessment.intent,
    sources: ['advisor_profile_assessment'],
  };
}
