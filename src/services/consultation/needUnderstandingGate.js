/**
 * Sprint 2 – Verständnis nicht kaputtfragen.
 * Nach starkem Erstkontakt keine Katalogfragen, die bereits erkannte Wünsche wiederholen.
 */
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  getFuelCategory,
  hasSellerEngagement,
  isCombustionProfile,
  isElectricOrPhevProfile,
  planNextQuestion,
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
export const SELLER_READINESS_QUESTION_ID = 'sellerReadiness';

/** Nur Einordnung – nicht wesentlich für den Verkäufer-Einstieg. */
const SELLER_OPTIMIZATION_QUESTION_IDS = new Set([
  'longDistance',
  'chargingAtHome',
  'rangeImportance',
  'trunkImportance',
  'evModelPriority',
  'comfortVsSpace',
  'heatPump',
  'v2l',
  'hud',
]);

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

    case 'hybridPowertrain':
      if (answers.hybridPowertrain != null) return false;
      if (getFuelCategory(needProfile) === 'phev') return false;
      if (getFuelCategory(needProfile) === 'hybrid') return true;
      return (needProfile.understoodLabels ?? []).some((l) => /\bhybrid\b/i.test(l))
        && !getFuelCategory(needProfile);

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
      return answers.longDistance == null;

    case 'chargingAtHome':
      return isElectricOrPhevProfile(needProfile)
        && needProfile.chargingAtHome == null
        && answers.chargingAtHome == null
        && hasSellerEngagement({ answers });

    case 'evModelPriority':
      if (answers.evModelPriority != null || answers.ev3Priority != null) return false;
      if (EV_MODEL_KEYS.has(needProfile.selectedModelKey ?? '')) return true;
      return getFuelCategory(needProfile) === 'electric'
        && (needProfile.children || needProfile.priorities?.includes('family'));

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
 * Fehlt dem Verkäufer noch eine wirklich wesentliche Lücke?
 * @param {object} needProfile
 * @param {object} [answers]
 */
export function hasEssentialSellerGaps(needProfile = {}, answers = {}) {
  const pending = planNextQuestion({ needProfile, answers });
  const questionId = pending.question?.id;
  if (!questionId) return false;
  if (!questionImprovesUnderstanding(questionId, needProfile, answers)) return false;
  if (hasRichNeedPicture(needProfile) && SELLER_OPTIMIZATION_QUESTION_IDS.has(questionId)) {
    return false;
  }
  return true;
}

/**
 * Nach ausreichend Verständnis: nicht optimieren, sondern Verkäufer-Bereitschaft klären.
 * @param {object} needProfile
 * @param {object} [consultationProfile]
 */
export function shouldOfferSellerReadinessGate(
  needProfile = {},
  consultationProfile = {},
) {
  const answers = consultationProfile?.answers ?? {};
  if (consultationProfile?.sellerReady) return false;
  if (answers[SELLER_READINESS_QUESTION_ID]) return false;
  if (!hasRichNeedPicture(needProfile)) return false;
  if (hasEssentialSellerGaps(needProfile, answers)) return false;
  return true;
}

/**
 * @param {object} [needProfile]
 */
export function buildSellerReadinessQuestion(needProfile = {}) {
  const modelLabel = modelDisplayLabel(needProfile);
  const intro = modelLabel
    ? `Für Ihren Berater zum ${modelLabel}:`
    : 'Für Ihren Berater:';

  return {
    id: SELLER_READINESS_QUESTION_ID,
    world: CLEVER_WORLD.NEED_CONSULTATION,
    prompt:
      `${intro} Fehlt Ihrem Berater noch etwas Wesentliches – oder können wir so weitergeben?`,
    optionsHint: 'Falls hilfreich — ganz ohne Pflicht:',
    options: [
      { id: 'seller_ready', label: 'Das reicht – Berater kann einsteigen' },
      { id: 'still_missing', label: 'Ja, noch etwas Wichtiges' },
    ],
  };
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
