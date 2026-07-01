/**
 * Gemischte Eingaben: Fahrzeugwunsch + konkrete Modell-/Ausstattungsfrage.
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { QUERY_TYPES } from './customerQueryTypes.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

const VEHICLE_WISH_MARKERS = /\b(suche|suchen|möchte|moechte|brauche|benötige|benoetige|interessier|finde|zeig(?:e|en)?\s+mir)\b/i;

const QUESTION_STARTERS = /(?:^|\s)(hat|haben|gibt|ist|sind|kann|können|wie\s+viele|welche|was)\s+/i;

const ISOFIX_PATTERN = /\b(isofix|iso\s*fix|kindersitz|kindersitze|babyschale|rücksitz|zweite\s+reihe)\b/i;
const CHILDREN_PATTERN = /\b(\d+|zwei|drei|vier|ein|eine)\s*(kinder|kindern|kind)\b|\bfamilie\b|\bfamilienauto\b/i;
const TOWING_PATTERN = /\b(ahk|anhängerkupplung|anhaengerkupplung|anhängelast|anhaengelast|fahrradträger|wohnwagen|anhänger|anhaenger)\b/i;
const RANGE_PATTERN = /\b(\d{3,})\s*km\b|\breichweite\b/i;
const ELECTRIC_PATTERN = /\b(e-?auto|elektro|elektroauto|vollelektr)\b/i;

const PURE_SPECIAL_PATTERN = /montier|nachrüst|nachträglich|windabweiser|dachbox|zubehör|einbau/i;

/**
 * @param {string} text
 */
export function splitWishAndQuestion(text = '') {
  const raw = String(text).trim();
  if (!raw) return null;

  const sentences = raw.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 2) {
    const questionPart = sentences[sentences.length - 1];
    const wishPart = sentences.slice(0, -1).join(' ');
    if (QUESTION_STARTERS.test(questionPart) || /\?$/.test(questionPart)) {
      return { wishPart, questionPart, fullText: raw };
    }
  }

  const inline = raw.match(
    /^(.*?)(?:\.\s+|\s+)((?:hat|haben|gibt|ist|sind|kann|können|wie|welche|was)\s+.+)$/i,
  );
  if (inline) {
    return {
      wishPart: inline[1].trim(),
      questionPart: inline[2].trim(),
      fullText: raw,
    };
  }

  if (VEHICLE_WISH_MARKERS.test(raw) && (/\?$/.test(raw) || QUESTION_STARTERS.test(raw))) {
    const qIndex = raw.search(/\b(hat|haben|gibt|ist|sind|kann|können|wie\s+viele|welche|was)\b/i);
    if (qIndex > 20) {
      return {
        wishPart: raw.slice(0, qIndex).trim().replace(/[.,;]\s*$/, ''),
        questionPart: raw.slice(qIndex).trim(),
        fullText: raw,
      };
    }
  }

  return null;
}

/**
 * @param {string} text
 */
export function detectFamilySeatingTopic(text = '') {
  const q = String(text);
  if (ISOFIX_PATTERN.test(q)) return 'isofix';
  if (CHILDREN_PATTERN.test(q)) return 'family_seating';
  return null;
}

/**
 * @param {string} text
 */
export function detectTowingTopic(text = '') {
  return TOWING_PATTERN.test(text) ? 'towing' : null;
}

/**
 * @param {string} questionPart
 */
export function detectSecondaryIntent(questionPart = '') {
  const q = String(questionPart).trim();
  if (detectFamilySeatingTopic(q)) return QUERY_TYPES.MODEL_EQUIPMENT_QUESTION;
  if (detectTowingTopic(q)) return QUERY_TYPES.MODEL_EQUIPMENT_QUESTION;
  if (/\b(serie|ausstattung|wärmepumpe|waermepumpe|batterie)\b/i.test(q)) {
    return QUERY_TYPES.MODEL_EQUIPMENT_QUESTION;
  }
  if (/\b(6|7|sech|sieben)\s*(-|\s)?sitzer|besser für\b/i.test(q)) {
    return QUERY_TYPES.ADVICE_QUESTION;
  }
  if (/\?/.test(q) || QUESTION_STARTERS.test(q)) {
    return QUERY_TYPES.MODEL_EQUIPMENT_QUESTION;
  }
  return QUERY_TYPES.MODEL_EQUIPMENT_QUESTION;
}

/**
 * @param {string} text
 * @param {string} questionPart
 */
export function resolveMixedTopic(text, questionPart) {
  const combined = `${text} ${questionPart}`;
  if (detectFamilySeatingTopic(combined)) return 'family_seating';
  if (detectTowingTopic(combined)) return 'towing';
  if (RANGE_PATTERN.test(combined)) return 'range';
  if (ELECTRIC_PATTERN.test(combined)) return 'electric';
  return 'mixed_vehicle_question';
}

function modelLabel(modelKey) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label;
  return label ? `Kia ${label}` : modelKey?.toUpperCase();
}

/**
 * @param {string} query
 * @param {object} [ctx]
 */
export function detectMixedIntent(query = '', ctx = {}) {
  const text = String(query).trim();
  if (text.length < 12) return null;
  if (PURE_SPECIAL_PATTERN.test(text) && !VEHICLE_WISH_MARKERS.test(text)) return null;
  if (!VEHICLE_WISH_MARKERS.test(text)) return null;
  if (!/\?/.test(text) && !QUESTION_STARTERS.test(text)) return null;

  const parts = splitWishAndQuestion(text);
  if (!parts?.wishPart || !parts?.questionPart) return null;
  if (parts.wishPart.length < 8 || parts.questionPart.length < 8) return null;

  const modelKey = ctx.modelKey
    ?? detectModelKeyInQuery(parts.questionPart)
    ?? detectModelKeyInQuery(text)
    ?? null;

  const secondaryIntent = detectSecondaryIntent(parts.questionPart);
  const topic = resolveMixedTopic(text, parts.questionPart);
  const familyTopic = detectFamilySeatingTopic(`${text} ${parts.questionPart}`);
  const towingTopic = detectTowingTopic(`${text} ${parts.questionPart}`);

  let featureId = null;
  if (familyTopic === 'isofix' || familyTopic === 'family_seating') featureId = 'isofix';
  if (towingTopic) featureId = 'towbar';

  const intent = parseSearchIntent(text);
  const profile = buildSearchProfile({ query: text, intent });

  return {
    queryType: QUERY_TYPES.MIXED_INTENT,
    primaryIntent: QUERY_TYPES.VEHICLE_WISH,
    secondaryIntent,
    topic,
    adviceTopicId: familyTopic === 'isofix' ? 'family_seating' : (towingTopic ? 'ev_towing_range' : null),
    modelKey,
    modelLabel: modelKey ? modelLabel(modelKey) : null,
    featureId,
    vehicleWishPart: parts.wishPart,
    questionPart: parts.questionPart,
    customerIntent: 'Gemischter Fahrzeugwunsch mit konkreter Modellfrage',
    shouldShowModels: true,
    shouldAskForContact: false,
    needsDealerCheck: false,
    confidence: 0.9,
    source: 'mixed_intent',
    searchIntent: intent,
    searchProfile: profile,
  };
}

/**
 * @param {string} query
 */
export function isLikelyMixedIntentQuery(query = '') {
  return Boolean(detectMixedIntent(query));
}
