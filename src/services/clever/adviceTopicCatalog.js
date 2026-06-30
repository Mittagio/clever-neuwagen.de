/**
 * @deprecated Nutze adviceTopicsRegistry + adviceTopicMatcher.
 * Dünner Re-Export für Abwärtskompatibilität.
 */
export {
  ADVICE_TOPICS,
  ADVICE_TOPIC_IDS,
  getAdviceTopicById,
  listAdviceTopicIds,
  listAdviceTopicsForOpenAi,
} from './adviceTopicsRegistry.js';

export {
  matchAdviceTopic,
  matchAdviceTopicByQuery,
  classifyAdviceFromTopics,
  isLikelyAdviceQuestion,
} from './adviceTopicMatcher.js';
