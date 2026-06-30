/**
 * Tool-Layer für Kundenquery – OpenAI darf nur mit diesen Fakten antworten.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { findApprovedKnowledgeAnswer } from '../admin/cleverKnowledgeAnswerService.js';
import { createLearningRequest } from '../admin/cleverLearningRequestService.js';
import {
  getModelEquipmentProfile,
  resolveModelFeatureAvailability,
} from '../configuration/modelEquipmentData.js';
import { buildVehicleLexicon, getRankingByMetric as lexiconRanking } from '../lexicon/vehicleLexiconService.js';
import { RANKING_METRICS } from './customerQueryTypes.js';

export { RANKING_METRICS };

/**
 * @param {string[]} modelKeys
 */
export function getTechnicalData(modelKeys = []) {
  const keys = [...new Set(modelKeys.filter(Boolean))];
  return keys.map((modelKey) => {
    const record = KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey && !r.trimId)
      ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey)
      ?? null;
    if (!record) return { modelKey, record: null };
    return {
      modelKey,
      record: {
        model: record.model,
        dimensions: record.dimensions ?? null,
        family: record.family ?? null,
        electric: record.electric ?? null,
        towing: record.towing ?? null,
      },
    };
  });
}

/**
 * @param {string} metric
 * @param {object} [options]
 */
export function getRankingByMetric(metric, options = {}) {
  const normalized = metric === 'range' ? RANKING_METRICS.WLTP_RANGE
    : metric === 'trunk' ? RANKING_METRICS.TRUNK_VOLUME
      : metric;
  return lexiconRanking(normalized, options.vehicles ?? [], {
    powertrainFilter: options.powertrainFilter ?? null,
  });
}

/**
 * @param {string} modelKey
 * @param {string} featureId
 */
export function resolveEquipmentAvailability(modelKey, featureId) {
  if (!modelKey || !featureId) return null;
  const profile = getModelEquipmentProfile('Kia', modelKey, modelKey);
  if (!profile) return null;
  return resolveModelFeatureAvailability('Kia', profile.model ?? modelKey, modelKey, featureId);
}

/**
 * @param {string} query
 * @param {string|null} modelKey
 */
export function searchApprovedKnowledgeAnswer(query, modelKey = null) {
  return findApprovedKnowledgeAnswer(query, modelKey);
}

/**
 * @param {object} input
 */
export function createLearningRequestTool(input = {}) {
  return createLearningRequest(input);
}

/**
 * @param {string} brand
 */
export function listLexiconModelKeys(brand = 'Kia') {
  return buildVehicleLexicon()
    .filter((entry) => entry.label.startsWith(brand))
    .map((entry) => entry.modelKey);
}
