/**
 * Hybrid-Orchestrierung: Klassifikation → Fakten → Antwort → Follow-ups → UI-Routing.
 */
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { classifyWithOpenAi, isOpenAiConfigured } from './openAiQueryClassifier.js';
import { resolveFactsForQuery } from './customerQueryFactResolver.js';
import { formulateWithOpenAi } from './openAiAnswerFormulator.js';
import {
  buildAdviceQuestionPayload,
  buildSpecialQuestionPayload,
  buildTemplateAnswer,
  hybridAnswerToSmartAnswerCard,
  resolveUiComponent,
} from './customerQueryAnswerBuilder.js';
import { QUERY_TYPES, UI_COMPONENTS, KNOWLEDGE_ROUTES, normalizeClassification } from './customerQueryTypes.js';
import {
  detectAmbiguousLargestEvQuery,
  detectModelDetailQuery,
  resolveContextualQuery,
} from './contextualQueryResolver.js';
import {
  buildAmbiguousLargestEvFacts,
  buildFamilyVariantFacts,
  buildModelDetailFacts,
  buildContextualComparisonTitle,
} from './advisoryFlowFacts.js';
import { buildFollowUpSuggestions } from './followUpSuggestionBuilder.js';
import { routeQueryKnowledge, shouldUseOpenAiGeneralKnowledge } from './queryKnowledgeRouting.js';
import { buildGeneralKnowledgeFacts } from './generalKnowledgeTemplates.js';
import { answerWithOpenAiGeneralKnowledge } from './openAiGeneralKnowledgeService.js';

const LOW_CONFIDENCE = 0.55;

const RULE_PRIORITY_TYPES = new Set([
  QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
  QUERY_TYPES.RANKING_QUESTION,
  QUERY_TYPES.COMPARISON_QUESTION,
  QUERY_TYPES.VEHICLE_WISH,
  QUERY_TYPES.SPECIAL_CHECK_QUESTION,
]);

function shouldUseOpenAi(options = {}) {
  if (options.useOpenAi === false) return false;
  if (options.useOpenAi === true) return isOpenAiConfigured();
  return process.env.ADVISOR_USE_OPENAI === 'true' && isOpenAiConfigured();
}

function mergeClassification(openAiResult, ruleResult) {
  if (!openAiResult) return ruleResult;
  if (!ruleResult) return openAiResult;
  if (RULE_PRIORITY_TYPES.has(ruleResult.queryType) && ruleResult.confidence >= 0.72) {
    return ruleResult;
  }
  if (openAiResult.confidence >= LOW_CONFIDENCE) return openAiResult;
  if (ruleResult.confidence > openAiResult.confidence) {
    return { ...ruleResult, source: 'rules_override' };
  }
  return openAiResult;
}

function resolveAdvisoryFlowFacts(resolvedQuery, contextual, classification) {
  if (detectAmbiguousLargestEvQuery(resolvedQuery)) {
    return buildAmbiguousLargestEvFacts();
  }

  const modelFlow = detectModelDetailQuery(resolvedQuery);
  if (modelFlow?.kind === 'model_detail') {
    return buildModelDetailFacts(modelFlow.modelKey);
  }
  if (modelFlow?.kind === 'family_variant') {
    return buildFamilyVariantFacts(modelFlow.modelKey);
  }

  if (contextual.comparisonModels?.length >= 2) {
    return null;
  }

  return null;
}

/**
 * @param {object} input
 */
export async function orchestrateCustomerQuery(input = {}) {
  const rawQuery = String(input.query ?? '').trim();
  const sessionContext = input.context ?? {};

  if (!rawQuery) {
    return { ok: false, error: 'query_required' };
  }

  const contextual = resolveContextualQuery(rawQuery, sessionContext);
  const query = contextual.query;
  const enrichedContext = {
    ...sessionContext,
    modelKey: contextual.modelKey ?? sessionContext.modelKey ?? null,
    modelLabel: sessionContext.modelLabel ?? null,
    resolvedFrom: contextual.resolvedFrom ?? null,
  };

  let classification;
  let pipelineSource = 'rules';

  if (contextual.comparisonModels?.length >= 2) {
    classification = normalizeClassification({
      queryType: QUERY_TYPES.COMPARISON_QUESTION,
      topic: 'comparison',
      modelKey: contextual.comparisonModels[0],
      modelKeys: contextual.comparisonModels,
      comparisonModels: contextual.comparisonModels,
      customerIntent: `Vergleich ${contextual.comparisonModels.join(' vs ')}`,
      shouldShowModels: true,
      shouldAskForContact: false,
      confidence: contextual.enriched ? 0.9 : 0.85,
      source: contextual.enriched ? 'contextual_comparison' : 'rules',
    });
  } else {
    const ruleClassification = classifyWithRules(query, enrichedContext);
    classification = ruleClassification;

    if (shouldUseOpenAi(input)) {
      try {
        const openAiClassification = await classifyWithOpenAi(query, enrichedContext);
        classification = mergeClassification(openAiClassification, ruleClassification);
        pipelineSource = openAiClassification ? 'openai_hybrid' : 'rules';
      } catch {
        classification = ruleClassification;
        pipelineSource = 'rules_fallback';
      }
    }
  }

  let facts = resolveAdvisoryFlowFacts(query, contextual, classification)
    ?? resolveFactsForQuery(classification, query);

  const knowledgeRoute = routeQueryKnowledge(query, classification);

  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.GENERAL
    && shouldUseOpenAiGeneralKnowledge(knowledgeRoute)
    && facts.kind !== 'ranking'
    && facts.kind !== 'comparison'
    && facts.kind !== 'model_equipment'
    && facts.kind !== 'approved_knowledge'
    && facts.kind !== 'clarification_largest_ev'
    && facts.kind !== 'model_detail'
    && facts.kind !== 'family_variant_advice') {
    let generalFacts = null;
    if (shouldUseOpenAi(input)) {
      try {
        generalFacts = await answerWithOpenAiGeneralKnowledge({
          query,
          classification,
          sessionContext,
          routing: knowledgeRoute,
        });
        if (generalFacts) pipelineSource = `${pipelineSource}+openai_knowledge`;
      } catch {
        /* Template-Fallback */
      }
    }
    facts = generalFacts ?? buildGeneralKnowledgeFacts({
      query,
      classification,
      routing: knowledgeRoute,
    });

    if (knowledgeRoute.competitor) {
      classification = normalizeClassification({
        ...classification,
        queryType: QUERY_TYPES.COMPETITOR_COMPARISON,
        topic: knowledgeRoute.competitor.topic,
      });
    } else if (knowledgeRoute.generalCompare) {
      classification = normalizeClassification({
        ...classification,
        queryType: QUERY_TYPES.GENERAL_CAR_COMPARISON,
        topic: knowledgeRoute.generalCompare.topic,
      });
    } else if (knowledgeRoute.generalQ) {
      classification = normalizeClassification({
        ...classification,
        queryType: knowledgeRoute.generalQ.queryType,
        topic: knowledgeRoute.generalQ.topic,
      });
    } else if (facts.kind === 'general_knowledge' && classification.queryType === QUERY_TYPES.ADVICE_QUESTION) {
      classification = normalizeClassification({
        ...classification,
        shouldShowModels: false,
      });
    }
  } else if (knowledgeRoute.route === KNOWLEDGE_ROUTES.DEALER_CHECK
    && knowledgeRoute.reason === 'leasing_rate') {
    facts = buildGeneralKnowledgeFacts({ query, classification, routing: knowledgeRoute });
    classification = normalizeClassification({
      ...classification,
      needsDealerCheck: true,
      shouldAskForContact: true,
      shouldShowModels: false,
    });
  } else if (facts.kind === 'advice_unmatched' && shouldUseOpenAiGeneralKnowledge(knowledgeRoute)) {
    facts = buildGeneralKnowledgeFacts({ query, classification, routing: knowledgeRoute });
  }

  if (facts?.kind === 'comparison' && contextual.enriched && contextual.comparisonModels?.length >= 2) {
    facts = {
      ...facts,
      contextualTitle: buildContextualComparisonTitle(contextual.comparisonModels),
    };
  }

  if (facts?.kind === 'family_variant_advice') {
    classification = normalizeClassification({
      ...classification,
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      modelKey: facts.modelKey,
      adviceTopicId: 'family_luggage',
      topic: 'family_luggage',
      shouldShowModels: false,
    });
  }

  if (facts?.kind === 'model_detail') {
    classification = normalizeClassification({
      ...classification,
      modelKey: facts.modelKey,
      shouldShowModels: false,
    });
  }

  if (facts?.kind === 'clarification_largest_ev') {
    classification = normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: 'clarification_largest_ev',
      shouldShowModels: false,
      confidence: 0.88,
      source: 'clarification',
    });
  }

  let answer = buildTemplateAnswer(classification, facts, query);

  const canFormulate = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    && facts.kind !== 'approved_knowledge'
    && facts.kind !== 'advice_topic'
    && facts.kind !== 'advice_unmatched'
    && facts.kind !== 'family_variant_advice'
    && facts.kind !== 'clarification_largest_ev'
    && classification.topic !== 'general_advice';

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
            ? 'Clever Einschätzung'
            : 'Clever Antwort',
          primaryModelKey: classification.modelKey,
          source: formulated.source,
        };
      }
    } catch {
      /* Template-Antwort bleibt */
    }
  }

  const followUpSuggestions = buildFollowUpSuggestions({
    classification,
    facts,
    smartAnswer: answer?.smartAnswer,
    sessionContext,
  });

  const uiComponent = resolveUiComponent(classification, answer);
  const smartAnswer = hybridAnswerToSmartAnswerCard(answer, classification, followUpSuggestions);

  const isAdvice = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    || facts.kind === 'family_variant_advice';
  const advicePayload = isAdvice ? buildAdviceQuestionPayload(classification, rawQuery) : null;
  const suggestLearning = classification.topic === 'unmatched_advice'
    || (isAdvice && !classification.adviceTopicId && facts.kind === 'advice_unmatched');

  return {
    ok: true,
    source: pipelineSource,
    resolvedQuery: contextual.enriched ? query : null,
    classification,
    facts: {
      kind: facts.kind,
      bullets: facts.bullets ?? [],
      sources: facts.sources ?? [],
      modelKey: facts.modelKey ?? classification.modelKey,
      adviceTopicId: facts.adviceTopicId ?? classification.adviceTopicId ?? null,
      competitorMentions: facts.competitorMentions ?? [],
    },
    answer: answer ? {
      mode: answer.mode,
      title: answer.title,
      body: answer.body,
      disclaimer: answer.disclaimer,
      kicker: answer.kicker,
      source: answer.source,
      adviceTopicId: answer.adviceTopicId ?? classification.adviceTopicId ?? null,
    } : null,
    smartAnswer,
    followUpSuggestions,
    ui: {
      component: uiComponent,
      shouldShowModels: classification.shouldShowModels,
      shouldAskForContact: classification.shouldAskForContact,
      modelKeys: classification.comparisonModels?.length
        ? classification.comparisonModels
        : classification.modelKeys?.length
          ? classification.modelKeys
          : classification.modelKey
            ? [classification.modelKey]
            : facts.modelKey
              ? [facts.modelKey]
              : [],
    },
    specialCustomerQuestion: uiComponent === UI_COMPONENTS.SPECIAL_CONTACT
      ? buildSpecialQuestionPayload(classification, rawQuery)
      : advicePayload,
    adviceContact: isAdvice ? advicePayload : null,
    knowledgeRoute: knowledgeRoute.route,
    knowledgeReason: knowledgeRoute.reason,
    persistence: {
      suggestLearningRequest: suggestLearning
        || (classification.shouldAskForContact && uiComponent === UI_COMPONENTS.SPECIAL_CONTACT)
        || classification.confidence < LOW_CONFIDENCE,
      queryType: classification.queryType,
      topic: classification.topic,
      adviceTopicId: classification.adviceTopicId ?? null,
    },
  };
}
