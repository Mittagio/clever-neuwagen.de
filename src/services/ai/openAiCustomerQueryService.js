/**
 * OpenAI-Hybrid-Fassade für Kundenseite – nur serverseitig.
 */
import { orchestrateCustomerQuery } from '../clever/cleverCustomerQueryOrchestrator.js';
import { classifyWithRules } from '../clever/customerQueryRuleFallback.js';
import { classifyWithOpenAi } from '../clever/openAiQueryClassifier.js';
import { resolveFactsForQuery } from '../clever/customerQueryFactResolver.js';
import {
  buildTemplateAnswer,
  hybridAnswerToSmartAnswerCard,
} from '../clever/customerQueryAnswerBuilder.js';
import { formulateWithOpenAi } from '../clever/openAiAnswerFormulator.js';
import { QUERY_TYPES } from '../clever/customerQueryTypes.js';
import {
  createLearningRequestTool,
  getRankingByMetric,
  getTechnicalData,
  resolveEquipmentAvailability,
  searchApprovedKnowledgeAnswer,
} from '../clever/customerQueryTools.js';

export const CUSTOMER_QUERY_TOOLS = {
  getTechnicalData,
  getRankingByMetric,
  resolveEquipmentAvailability,
  searchApprovedKnowledgeAnswer,
  createLearningRequest: createLearningRequestTool,
};

/**
 * @param {string} inputText
 * @param {object} [context]
 */
export async function classifyCustomerQuery(inputText = '', context = {}) {
  const ruleResult = classifyWithRules(inputText, context);
  try {
    const openAiResult = await classifyWithOpenAi(inputText, context);
    if (!openAiResult) return ruleResult;
    if (openAiResult.confidence >= ruleResult.confidence) return openAiResult;
    return ruleResult;
  } catch {
    return ruleResult;
  }
}

/**
 * @param {string} inputText
 * @param {object} facts
 * @param {object} [classification]
 */
export async function buildCustomerAnswer(inputText = '', facts = {}, classification = {}) {
  let answer = buildTemplateAnswer(classification, facts, inputText);

  const canFormulate = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    && facts.kind !== 'approved_knowledge'
    && facts.topic !== 'general_advice';

  if (canFormulate) {
    try {
      const formulated = await formulateWithOpenAi({
        query: inputText,
        classification,
        facts,
      });
      if (formulated?.body) {
        answer = {
          mode: 'advice',
          title: formulated.title,
          body: formulated.body,
          disclaimer: formulated.disclaimer,
          kicker: 'Clever Beratung',
          source: formulated.source,
        };
      }
    } catch {
      /* Template bleibt */
    }
  }

  return {
    answer,
    smartAnswer: hybridAnswerToSmartAnswerCard(answer, classification),
  };
}

/**
 * @param {string} inputText
 * @param {object} [context]
 */
export function fallbackToLocalParser(inputText = '', context = {}) {
  const classification = classifyWithRules(inputText, context);
  const facts = resolveFactsForQuery(classification, inputText);
  const answer = buildTemplateAnswer(classification, facts, inputText);
  return {
    classification,
    facts,
    answer,
    smartAnswer: hybridAnswerToSmartAnswerCard(answer, classification),
  };
}

/**
 * @param {object} input
 */
export async function runCustomerQuery(input = {}) {
  return orchestrateCustomerQuery(input);
}
