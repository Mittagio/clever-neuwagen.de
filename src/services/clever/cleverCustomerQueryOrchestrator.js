/**
 * Hybrid-Orchestrierung: Klassifikation → Fakten → Antwort → UI-Routing.
 */
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { classifyWithOpenAi, isOpenAiConfigured } from './openAiQueryClassifier.js';
import { resolveFactsForQuery } from './customerQueryFactResolver.js';
import { formulateWithOpenAi } from './openAiAnswerFormulator.js';
import {
  buildSpecialQuestionPayload,
  buildTemplateAnswer,
  hybridAnswerToSmartAnswerCard,
  resolveUiComponent,
} from './customerQueryAnswerBuilder.js';
import { QUERY_TYPES } from './customerQueryTypes.js';

const LOW_CONFIDENCE = 0.55;

function shouldUseOpenAi(options = {}) {
  if (options.useOpenAi === false) return false;
  if (options.useOpenAi === true) return isOpenAiConfigured();
  return process.env.ADVISOR_USE_OPENAI === 'true' && isOpenAiConfigured();
}

function mergeClassification(openAiResult, ruleResult) {
  if (!openAiResult) return ruleResult;
  if (!ruleResult) return openAiResult;
  if (openAiResult.confidence >= LOW_CONFIDENCE) return openAiResult;
  if (ruleResult.confidence > openAiResult.confidence) {
    return { ...ruleResult, source: 'rules_override' };
  }
  return openAiResult;
}

/**
 * @param {object} input
 */
export async function orchestrateCustomerQuery(input = {}) {
  const query = String(input.query ?? '').trim();
  const context = input.context ?? {};

  if (!query) {
    return { ok: false, error: 'query_required' };
  }

  const ruleClassification = classifyWithRules(query, context);
  let classification = ruleClassification;
  let pipelineSource = 'rules';

  if (shouldUseOpenAi(input)) {
    try {
      const openAiClassification = await classifyWithOpenAi(query, context);
      classification = mergeClassification(openAiClassification, ruleClassification);
      pipelineSource = openAiClassification ? 'openai_hybrid' : 'rules';
    } catch {
      classification = ruleClassification;
      pipelineSource = 'rules_fallback';
    }
  }

  const facts = resolveFactsForQuery(classification, query);
  let answer = buildTemplateAnswer(classification, facts, query);

  const canFormulate = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    || (classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION
      && facts.kind !== 'approved_knowledge');

  if (canFormulate && shouldUseOpenAi(input) && facts.kind !== 'approved_knowledge') {
    try {
      const formulated = await formulateWithOpenAi({ query, classification, facts });
      if (formulated?.body) {
        answer = {
          mode: classification.queryType === QUERY_TYPES.ADVICE_QUESTION ? 'advice' : 'model',
          title: formulated.title,
          body: formulated.body,
          disclaimer: formulated.disclaimer,
          kicker: classification.queryType === QUERY_TYPES.ADVICE_QUESTION
            ? 'Clever Beratung'
            : 'Clever Antwort',
          primaryModelKey: classification.modelKey,
          source: formulated.source,
        };
      }
    } catch {
      /* Template-Antwort bleibt */
    }
  }

  const uiComponent = resolveUiComponent(classification, answer);
  const smartAnswer = hybridAnswerToSmartAnswerCard(answer, classification);

  return {
    ok: true,
    source: pipelineSource,
    classification,
    facts: {
      kind: facts.kind,
      bullets: facts.bullets ?? [],
      sources: facts.sources ?? [],
      modelKey: facts.modelKey ?? classification.modelKey,
    },
    answer: answer ? {
      mode: answer.mode,
      title: answer.title,
      body: answer.body,
      disclaimer: answer.disclaimer,
      kicker: answer.kicker,
      source: answer.source,
    } : null,
    smartAnswer,
    ui: {
      component: uiComponent,
      shouldShowModels: classification.shouldShowModels,
      shouldAskForContact: classification.shouldAskForContact,
      modelKeys: classification.modelKey ? [classification.modelKey] : [],
    },
    specialCustomerQuestion: uiComponent === 'special_contact'
      ? buildSpecialQuestionPayload(classification, query)
      : null,
    persistence: {
      suggestLearningRequest: classification.shouldAskForContact
        || classification.confidence < LOW_CONFIDENCE,
      queryType: classification.queryType,
      topic: classification.topic,
    },
  };
}
