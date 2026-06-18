/**
 * Modellbezogener Suchindex – normalisiert Begriffe; Suche über Layer 1 + Layer 2.
 */
export {
  stripQuestionPhrases,
  normalizeEquipmentQuery,
  scoreSearchPattern,
} from './equipmentQueryUtils.js';

export { searchModelEquipmentIndex } from './equipmentModelSearch.js';
