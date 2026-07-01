/**
 * Technische Modellfragen erkennen – Stützlast, Sitze, Isofix, Laden.
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

const TOWING_TOPIC = /\b(stützlast|stuetzlast|vertikale\s+last|anhängelast|anhaengelast|zuglast|ahk|anhängerkupplung|anhaengerkupplung|fahrradträger|fahrradtraeger|wohnwagen|anhänger|anhaenger)\b/i;

const SEATING_TOPIC = /\b(sitzplatz|sitzplätze|sitzplaetze|sitzplätzen|sitze|sitzer|6[\s-]?sitzer|7[\s-]?sitzer|dritte\s+reihe|personen|innenraum)\b/i;

const ISOFIX_TOPIC = /\b(isofix|iso\s*fix|kindersitz|kindersitze|babyschale|rücksitz|ruecksitz|zweite\s+reihe)\b/i;

const CHARGING_TOPIC = /\b(ladegeschwindigkeit|ladeleistung|schnelllad|dc[\s-]?lad|10[\s–-]+80|wie\s+schnell\s+l[aä]dt|lädt\s+der|laedt\s+der|ladezeit)\b/i;

const CHILDREN_TOPIC = /\b(kinder|kindern|kind)\b/i;

/**
 * @param {string} query
 * @param {object} [ctx]
 * @returns {{ modelKey: string, topic: string, featureId?: string, adviceTopicId?: string }|null}
 */
export function detectModelTechnicalQuestion(query = '', ctx = {}) {
  const text = String(query).trim();
  if (!text) return null;

  if (/\b(suche|suchen|möchte|moechte|brauche|benötige|benoetige|finde|interessier|zeig(?:e|en)?\s+mir)\b/i.test(text)
    && !/\?/.test(text)) {
    return null;
  }

  const modelKey = ctx.modelKey ?? detectModelKeyInQuery(text);
  if (!modelKey) return null;

  if (TOWING_TOPIC.test(text)) {
    const topic = /\b(stützlast|stuetzlast|vertikale\s+last)\b/i.test(text)
      ? 'vertical_load'
      : 'towing';
    return {
      modelKey,
      topic,
      featureId: 'towbar',
      adviceTopicId: 'trailer_load',
    };
  }

  if (ISOFIX_TOPIC.test(text) || (CHILDREN_TOPIC.test(text) && /^hat\s+/i.test(text))) {
    return {
      modelKey,
      topic: 'isofix',
      featureId: 'isofix',
      adviceTopicId: 'family_seating',
    };
  }

  if (SEATING_TOPIC.test(text)) {
    return {
      modelKey,
      topic: 'seating',
      adviceTopicId: 'family_luggage',
    };
  }

  if (CHARGING_TOPIC.test(text)) {
    return {
      modelKey,
      topic: 'charging_speed',
      adviceTopicId: 'charging_speed',
    };
  }

  return null;
}
