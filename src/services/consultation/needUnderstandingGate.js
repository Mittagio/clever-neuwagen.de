/**
 * Sprint 2 – Verständnis nicht kaputtfragen.
 * Nach starkem Erstkontakt keine Katalogfragen, die bereits erkannte Wünsche wiederholen.
 */
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  getFuelCategory,
  isCombustionProfile,
  isElectricOrPhevProfile,
} from './conversationPlanner.js';
import { isMinimalVehicleWish } from './needProfileService.js';
import {
  isAwdRecognized,
  isTowbarRecognized,
} from './needRecognitionService.js';

const EV_MODEL_KEYS = new Set([
  'ev3', 'ev4', 'ev4-fastback', 'ev5', 'ev6', 'ev9',
]);

const MODEL_LABELS = {
  sportage: 'Sportage',
  sorento: 'Sorento',
  ev3: 'EV3',
  ev4: 'EV4',
  ev5: 'EV5',
  ev6: 'EV6',
  ev9: 'EV9',
};

const BODY_LABELS = {
  suv: 'SUV',
  kleinwagen: 'Kleinwagen',
  kombi: 'Kombi',
  limousine: 'Limousine',
  van: 'Van',
  pickup: 'Pickup',
};

export const NEED_DIRECTION_QUESTION_ID = 'needDirection';

function modelDisplayLabel(needProfile = {}) {
  const key = needProfile.selectedModelKey ?? needProfile.modelHint;
  if (key && MODEL_LABELS[key]) return MODEL_LABELS[key];
  if (key) return String(key).toUpperCase();
  if (needProfile.bodyType && BODY_LABELS[needProfile.bodyType]) {
    return BODY_LABELS[needProfile.bodyType];
  }
  return null;
}

/**
 * @param {object} needProfile
 */
export function hasRichNeedPicture(needProfile = {}) {
  const labelCount = needProfile.understoodLabels?.length ?? 0;
  const fuelKnown = getFuelCategory(needProfile) != null;
  const anchor = Boolean(needProfile.modelHint || needProfile.bodyType);
  const hasBudget = Boolean(needProfile.budget?.maxPrice || needProfile.budget?.maxMonthlyRate);
  const hasConfig = Boolean(needProfile.drive || needProfile.transmission);

  return labelCount >= 4 && fuelKnown && anchor && (hasBudget || hasConfig);
}

/**
 * Würde diese Planner-Frage das Verständnis noch verbessern?
 * @param {string} questionId
 * @param {object} needProfile
 * @param {object} [answers]
 */
export function questionImprovesUnderstanding(questionId, needProfile = {}, answers = {}) {
  switch (questionId) {
    case 'fuel_type':
    case 'sportagePowertrain':
      return getFuelCategory(needProfile) == null && answers[questionId] == null;

    case 'allradNeed':
      return !isAwdRecognized(needProfile) && answers.allradNeed == null;

    case 'comfortVsSpace':
      if (answers.comfortVsSpace != null) return false;
      if (needProfile.modelHint && getFuelCategory(needProfile) && needProfile.transmission) {
        return false;
      }
      if (needProfile.towCapacityKg && needProfile.towing) return false;
      return isCombustionProfile(needProfile)
        && (needProfile.children || needProfile.modelHint === 'sportage' || needProfile.towing);

    case 'primaryUsage':
      return isMinimalVehicleWish(needProfile, needProfile.initialWish)
        && (needProfile.usage?.length ?? 0) === 0
        && answers.primaryUsage == null;

    case 'longDistance':
      return needProfile.longDistance == null && answers.longDistance == null;

    case 'chargingAtHome':
      return isElectricOrPhevProfile(needProfile)
        && needProfile.chargingAtHome == null
        && answers.chargingAtHome == null;

    case 'evModelPriority':
      return EV_MODEL_KEYS.has(needProfile.selectedModelKey ?? '')
        && answers.evModelPriority == null
        && answers.ev3Priority == null;

    case 'towingUsage':
      return Boolean(needProfile.towing && needProfile.towing !== 'no')
        && needProfile.towingUsage == null
        && answers.towingUsage == null
        && !isTowbarRecognized(needProfile);

    default:
      return true;
  }
}

/**
 * @param {object} needProfile
 */
export function hasCompleteVehicleBrief(needProfile = {}) {
  const anchor = needProfile.modelHint
    || needProfile.selectedModelKey
    || needProfile.bodyType;
  const fuelKnown = getFuelCategory(needProfile) != null;
  const hasBudget = Boolean(needProfile.budget?.maxPrice || needProfile.budget?.maxMonthlyRate);
  const hasConfig = Boolean(needProfile.drive && needProfile.transmission);

  return Boolean(anchor && fuelKnown && hasBudget && hasConfig);
}

/**
 * @param {object} needProfile
 * @param {{ id?: string }|null} [nextQuestion]
 * @param {object} [answers]
 */
export function shouldOfferDirectionChoice(needProfile = {}, nextQuestion = null, answers = {}) {
  if (answers[NEED_DIRECTION_QUESTION_ID]) return false;
  if (!hasRichNeedPicture(needProfile)) return false;
  if (hasCompleteVehicleBrief(needProfile)) return true;
  if (!nextQuestion?.id) return true;
  return !questionImprovesUnderstanding(nextQuestion.id, needProfile, answers);
}

/**
 * @param {object} needProfile
 */
export function buildNeedDirectionQuestion(needProfile = {}) {
  const modelLabel = modelDisplayLabel(needProfile);
  const prompt = modelLabel
    ? `Ich glaube, ich habe schon ein gutes Bild.\n\nMöchten Sie den ${modelLabel} genauer ansehen oder soll ich noch ähnliche Fahrzeuge einordnen?`
    : 'Ich glaube, ich habe schon ein gutes Bild.\n\nMöchten Sie diese Richtung genauer ansehen oder soll ich noch ähnliche Fahrzeuge einordnen?';

  return {
    id: NEED_DIRECTION_QUESTION_ID,
    world: CLEVER_WORLD.NEED_CONSULTATION,
    prompt,
    options: [
      {
        id: 'explore_model',
        label: modelLabel ? `${modelLabel} genauer ansehen` : 'Diese Richtung genauer ansehen',
      },
      {
        id: 'compare_similar',
        label: 'Ähnliche Fahrzeuge einordnen',
      },
    ],
  };
}
