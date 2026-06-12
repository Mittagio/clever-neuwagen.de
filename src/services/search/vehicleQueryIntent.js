/**
 * Smart-Answer-Intent vor der Fahrzeugsuche.
 *
 * vehicle_fact_question   – ein Modell, ein Datenfeld (z. B. „EV2 Batterie“)
 * vehicle_compare_question – zwei Modelle vergleichen (z. B. „EV3 oder EV4“)
 * vehicle_search          – normale CleverQuote-Suche
 */
import { matchEstimateQuestion } from '../dealer/vehicleEstimateMatcher.js';
import { matchVehicleQuestion } from '../dealer/vehicleQuestionMatcher.js';
import { parseAdvisoryQuestion } from './advisoryQuestionParser.js';
import { parseModelAttributeQuestion } from './modelAttributeQuestion.js';
import {
  hasFactualProfileCriteria,
  isShoppingCriteriaQuery,
  QUESTION_FORM,
} from './customerQueryHelpers.js';

/** @typedef {'vehicle_fact_question'|'vehicle_compare_question'|'vehicle_search'} VehicleQueryIntent */

/** @typedef {'batteryKwh'|'length'|'height'|'width'|'towingCapacity'|'wltpRange'|'trunkVolume'|'seats'|'price'|'dimensionsOverview'|'charging'|'roofLoad'|'isofix'|'heatPump'|'v2l'|'voltage800v'|'camera360'|'hud'|'matrixLed'|'panoramaRoof'|'leather'|'warranty'|'deliveryTime'|'consumption'|'powerHp'|'acceleration'|'driveType'|'leasingRate'|'finance'} VehicleFactField */

const ATTRIBUTE_TO_FIELD = /** @type {Record<string, VehicleFactField>} */ ({
  battery: 'batteryKwh',
  range: 'wltpRange',
  tow: 'towingCapacity',
  length: 'length',
  height: 'height',
  trunk: 'trunkVolume',
  seats: 'seats',
  price: 'price',
});

/**
 * @param {object} advisory
 * @returns {VehicleFactField|null}
 */
export function mapAdvisoryToFactField(advisory) {
  const { topic, attribute, query = '' } = advisory;

  if (topic === 'attribute' && attribute) {
    return ATTRIBUTE_TO_FIELD[attribute] ?? null;
  }
  if (topic === 'battery') return 'batteryKwh';
  if (topic === 'tow' || topic === 'towbar') return 'towingCapacity';
  if (topic === 'trunk') return 'trunkVolume';
  if (topic === 'range_real' || topic === 'range_winter' || topic === 'range_enough') return 'wltpRange';
  if (topic === 'dimensions' || topic === 'overview') {
    if (/\bwie\s+lang\b/i.test(query) || /\blänge\b/i.test(query)) return 'length';
    if (/\bwie\s+hoch\b/i.test(query) || /\bhöhe\b/i.test(query)) return 'height';
    if (/\bwie\s+breit\b/i.test(query)) return 'width';
    if (topic === 'dimensions') return 'dimensionsOverview';
    return null;
  }
  if (topic === 'price_leasing') return 'price';
  return null;
}

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 * @returns {{
 *   intent: VehicleQueryIntent,
 *   query: string,
 *   fact?: { modelKey: string, field: VehicleFactField },
 *   compare?: { modelKeyA: string, modelKeyB: string },
 *   advisory?: object,
 *   lexiconRanking?: boolean,
 * }}
 */
export function analyzeVehicleQuery(query, intent = {}, profile = {}) {
  const text = String(query ?? '').trim();
  if (!text) {
    return { intent: 'vehicle_search', query: text };
  }

  const estimateMatch = matchEstimateQuestion(text);
  if (estimateMatch) {
    return {
      intent: 'vehicle_fact_question',
      query: text,
      estimate: estimateMatch,
    };
  }

  const catalogMatch = matchVehicleQuestion(text);
  if (catalogMatch?.factField && catalogMatch.intentId !== 'unspecified') {
    return {
      intent: 'vehicle_fact_question',
      query: text,
      fact: { modelKey: catalogMatch.modelKey, field: catalogMatch.factField },
      catalog: catalogMatch,
    };
  }

  const advisory = parseAdvisoryQuestion(text);

  if (advisory?.topic === 'comparison') {
    return {
      intent: 'vehicle_compare_question',
      query: text,
      compare: {
        modelKeyA: advisory.modelKeyA,
        modelKeyB: advisory.modelKeyB,
      },
      advisory,
    };
  }

  if (advisory?.modelKey) {
    const field = mapAdvisoryToFactField(advisory);
    if (field) {
      return {
        intent: 'vehicle_fact_question',
        query: text,
        fact: { modelKey: advisory.modelKey, field },
        advisory,
      };
    }
    if (advisory.topic !== 'comparison') {
      return {
        intent: 'vehicle_fact_question',
        query: text,
        advisory,
      };
    }
  }

  const modelAttr = parseModelAttributeQuestion(text);
  if (modelAttr) {
    const field = ATTRIBUTE_TO_FIELD[modelAttr.attribute];
    if (field) {
      return {
        intent: 'vehicle_fact_question',
        query: text,
        fact: { modelKey: modelAttr.modelKey, field },
        advisory: { kind: 'advisory', topic: 'attribute', ...modelAttr },
      };
    }
  }

  if (intent.rangeRanking === 'max') {
    return { intent: 'vehicle_fact_question', query: text, lexiconRanking: true };
  }

  if (isShoppingCriteriaQuery(text, intent, profile)) {
    return { intent: 'vehicle_search', query: text };
  }

  const hasQuestion = QUESTION_FORM.test(text) || text.includes('?');
  const factual = hasFactualProfileCriteria(profile);

  if (hasQuestion && factual) {
    return { intent: 'vehicle_fact_question', query: text, lexiconRanking: true };
  }
  if (hasQuestion && intent.model) {
    return { intent: 'vehicle_fact_question', query: text, lexiconRanking: true };
  }

  return { intent: 'vehicle_search', query: text };
}

/**
 * @param {VehicleQueryIntent} vehicleIntent
 * @returns {'info'|'search'}
 */
export function vehicleIntentToCustomerMode(vehicleIntent) {
  return vehicleIntent === 'vehicle_search' ? 'search' : 'info';
}
