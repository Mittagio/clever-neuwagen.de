/**
 * Antworten für gemischte Fahrzeugwunsch + Modellfrage Eingaben.
 */
import { resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { detectFamilySeatingTopic, detectTowingTopic } from './mixedIntentDetector.js';

function modelLabel(modelKey) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey?.toUpperCase();
  return label ? `Kia ${label}` : 'Kia Modell';
}

/**
 * @param {object} classification
 * @param {object} [intent]
 * @param {object} [profile]
 */
export function buildUnderstoodWishes(classification = {}, intent = {}, profile = {}) {
  const text = `${classification.vehicleWishPart ?? ''} ${classification.questionPart ?? ''}`;
  const wishes = [];

  if (/\b(e-?auto|elektro|elektroauto)\b/i.test(text)) wishes.push('Elektroauto');
  if (profile.rangeMinKm >= 350 || /\b400\s*km\b/i.test(text)) {
    wishes.push(`ca. ${profile.rangeMinKm ?? 400} km Reichweite`);
  } else if (profile.rangeMinKm) {
    wishes.push(`ca. ${profile.rangeMinKm} km Reichweite`);
  }
  if (intent.isofixRearMin >= 2 || /\b2\s*(kinder|kindern|iso\s*fix|isofix)\b/i.test(text)) {
    wishes.push('2 Kinder / Isofix wichtig');
  } else if (intent.isofixRearMin || detectFamilySeatingTopic(text)) {
    wishes.push('Isofix wichtig');
  } else if (/\bfamilie|familienauto\b/i.test(text)) {
    wishes.push('Familie');
  }
  if (detectTowingTopic(text)) wishes.push('Anhängerkupplung prüfen');
  if (classification.modelKey) {
    wishes.push(`${KIA_MODEL_ATTRIBUTES[classification.modelKey]?.label ?? classification.modelKey.toUpperCase()} interessiert`);
  }
  if (/\bsuv\b/i.test(text)) wishes.push('SUV');
  if (/\bfamilienauto\b/i.test(text)) wishes.push('Familienauto gesucht');

  return [...new Set(wishes)].slice(0, 8);
}

/**
 * @param {object} classification
 */
export function buildDealerFinalChecks(classification = {}) {
  const text = `${classification.vehicleWishPart ?? ''} ${classification.questionPart ?? ''}`;
  const checks = [];

  if (detectFamilySeatingTopic(text)) checks.push('genaue Isofix-Anzahl');
  if (detectTowingTopic(text)) checks.push('Anhängerkupplung / Anhängelast');
  if (/\breichweite|\d{3}\s*km\b/i.test(text)) checks.push('passende Batterie/Reichweite');
  if (classification.modelKey) checks.push('verfügbare Ausstattungslinie');

  if (!checks.length) checks.push('passende Ausstattung und Verfügbarkeit');
  return checks;
}

/**
 * @param {object} classification
 */
export function buildMixedOpenQuestions(classification = {}) {
  const text = `${classification.vehicleWishPart ?? ''} ${classification.questionPart ?? ''}`;
  const model = classification.modelKey
    ? (KIA_MODEL_ATTRIBUTES[classification.modelKey]?.label ?? classification.modelKey.toUpperCase())
    : 'das Modell';
  const questions = [];

  if (classification.questionPart) {
    questions.push(classification.questionPart.replace(/\?$/, '').trim() + '?');
  }
  if (detectFamilySeatingTopic(text) && classification.modelKey) {
    questions.push(`Hat der ${model} ausreichend Isofix für zwei Kindersitze?`);
  }
  if (detectTowingTopic(text) && classification.modelKey) {
    questions.push(`Ist eine Anhängerkupplung beim ${model} möglich?`);
  }
  if (/\breichweite|\d{3}\s*km\b/i.test(text) && classification.modelKey) {
    questions.push(`Reicht die ${model}-Reichweite für den Alltag?`);
  }

  return [...new Set(questions)].slice(0, 4);
}

/**
 * @param {object} classification
 */
export function buildMixedIntentAnswerText(classification = {}) {
  const modelKey = classification.modelKey;
  const label = modelKey ? modelLabel(modelKey) : 'Ihr Wunschmodell';
  const shortLabel = modelKey
    ? (KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey.toUpperCase())
    : 'Modell';

  const record = modelKey
    ? resolveCleverRecord({ brand: 'Kia', modelKey, powertrain: 'elektro' })
    : null;
  const isofixCount = record?.family?.isofixRearCount;
  const topic = classification.topic;
  const question = classification.questionPart ?? '';

  let title = `${shortLabel} – Ihre Frage`;
  let body = '';

  if (topic === 'family_seating' || detectFamilySeatingTopic(question)) {
    title = `${shortLabel} mit Kindern und Isofix`;
    if (isofixCount != null) {
      body = `${label} bietet laut hinterlegten Daten ${isofixCount}× Isofix hinten – für zwei Kindersitze auf den äußeren Plätzen oft ein guter Ansatz. Die genaue Ausstattung der gewünschten ${shortLabel}-Version prüft Ihr Autohaus final.`;
    } else {
      body = `${label} ist grundsätzlich ein interessantes Elektroauto für Familien mit zwei Kindern. Beim Thema Isofix ist wichtig: In der Regel befinden sich Isofix-Befestigungen auf den äußeren Rücksitzen. Die genaue Ausstattung der gewünschten ${shortLabel}-Version prüft Ihr Autohaus final.`;
    }
  } else if (topic === 'towing' || detectTowingTopic(question)) {
    title = `${shortLabel} und Anhängerbetrieb`;
    body = `Anhängerkupplung und Anhängelast hängen bei ${label} von Motorisierung und Ausstattungslinie ab. AHK / Anhängelast bitte für die konkrete ${shortLabel}-Version prüfen – Clever fasst Ihren Wunsch zusammen, Ihr Autohaus klärt die Details.`;
  } else {
    title = `${shortLabel} – Wunsch und Frage`;
    body = `Clever hat Ihren Fahrzeugwunsch und Ihre konkrete Frage erkannt. ${label} kann passen – finale Ausstattung, Verfügbarkeit und Details prüft Ihr Autohaus für Sie.`;
  }

  return { title, body, primaryModelKey: modelKey };
}

/**
 * @param {object} classification
 */
export function suggestMixedIntentNextStep(classification = {}) {
  const model = classification.modelKey
    ? (KIA_MODEL_ATTRIBUTES[classification.modelKey]?.label ?? classification.modelKey.toUpperCase())
    : 'Fahrzeug';
  const text = `${classification.vehicleWishPart ?? ''} ${classification.questionPart ?? ''}`;

  if (detectFamilySeatingTopic(text) && detectTowingTopic(text)) {
    return `${model} als Familienauto mit Isofix, Reichweite und AHK prüfen`;
  }
  if (detectFamilySeatingTopic(text)) {
    return `${model} als Familienauto mit Isofix prüfen`;
  }
  if (detectTowingTopic(text)) {
    return `Anhängerbedarf prüfen und ${model} passend beraten`;
  }
  return `${model}-Wunsch und offene Fragen klären`;
}

/**
 * @param {object} classification
 */
export function buildMixedIntentFollowUps(classification = {}) {
  const model = classification.modelKey ?? 'ev3';
  const label = KIA_MODEL_ATTRIBUTES[model]?.label ?? model.toUpperCase();
  const suggestions = [];

  if (detectFamilySeatingTopic(`${classification.vehicleWishPart} ${classification.questionPart}`)) {
    suggestions.push({
      label: `${label} als Familienauto prüfen`,
      query: `Ist der ${label} gut für Familien mit Kindern?`,
      type: 'advice_question',
    });
  }
  if (detectTowingTopic(`${classification.vehicleWishPart} ${classification.questionPart}`)) {
    suggestions.push({
      label: `AHK beim ${label} prüfen`,
      query: `Hat der ${label} eine Anhängerkupplung?`,
      type: 'model_equipment_question',
    });
  }
  if (/\breichweite|\d{3}\s*km\b/i.test(`${classification.vehicleWishPart} ${classification.questionPart}`)) {
    suggestions.push({
      label: `${label} mit großer Batterie ansehen`,
      query: `Welche ${label} Variante hat die meiste Reichweite?`,
      type: 'model_equipment_question',
    });
  }
  suggestions.push({
    label: 'Verkäufer dazu fragen',
    query: 'Ich möchte dazu vom Autohaus beraten werden',
    type: 'purchase_intent',
    target: 'contact',
  });

  return suggestions.slice(0, 4);
}
