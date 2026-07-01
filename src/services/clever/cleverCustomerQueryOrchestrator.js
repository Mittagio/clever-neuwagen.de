/**
 * Hybrid-Orchestrierung: OpenAI-first Verstehen → Clever-Daten → Antwort → Follow-ups.
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
import {
  DATA_CONFIDENCE,
  DATA_CONFIDENCE_LABELS,
  QUERY_TYPES,
  UI_COMPONENTS,
  KNOWLEDGE_ROUTES,
  normalizeClassification,
} from './customerQueryTypes.js';
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
import { answerWithOpenAiAdvisor } from './openAiAdvisorAnswerService.js';
import { hasVerifiedCleverFacts, resolveDataConfidence } from './dataConfidenceResolver.js';
import { detectDealerDataQuery } from './generalCarQueryDetector.js';
import {
  analyzeQueryBrands,
  buildBrandScopeCrmSignals,
  buildCompetitorInterest,
  enrichClassificationWithBrandScope,
  filterFollowUpsForBrandScope,
  getDealerBrandScope,
} from './dealerBrandScope.js';
import { buildBrandScopedKnowledgeFacts } from './brandScopeKnowledgeTemplates.js';
import { buildBrandScopedFollowUps } from './brandScopeFollowUps.js';

const LOW_CONFIDENCE = 0.55;

const RULE_GUARD_TYPES = new Set([
  QUERY_TYPES.SPECIAL_CHECK_QUESTION,
  QUERY_TYPES.MIXED_INTENT,
  QUERY_TYPES.RANKING_QUESTION,
  QUERY_TYPES.VEHICLE_WISH,
  QUERY_TYPES.PURCHASE_INTENT,
]);

function shouldUseOpenAi(options = {}) {
  if (options.useOpenAi === false) return false;
  if (options.useOpenAi === true) return isOpenAiConfigured();
  return process.env.ADVISOR_USE_OPENAI === 'true' && isOpenAiConfigured();
}

/** OpenAI-first: OpenAI gewinnt, Rules nur als Guard für harte Datenpfade */
function mergeClassificationOpenAiFirst(openAiResult, ruleResult) {
  if (!openAiResult) return ruleResult;
  if (!ruleResult) return { ...openAiResult, source: 'openai_first' };

  if (RULE_GUARD_TYPES.has(ruleResult.queryType) && ruleResult.confidence >= 0.7) {
    return ruleResult;
  }

  if (ruleResult.queryType === QUERY_TYPES.COMPARISON_QUESTION
    && ruleResult.comparisonModels?.length >= 2
    && ruleResult.confidence >= 0.8) {
    return ruleResult;
  }

  if (ruleResult.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION
    && ruleResult.modelKey
    && ruleResult.confidence >= 0.85) {
    return ruleResult;
  }

  if (ruleResult.needsDealerCheck && ruleResult.confidence >= 0.8) {
    return ruleResult;
  }

  if (openAiResult.confidence >= 0.45) {
    return { ...openAiResult, source: 'openai_first' };
  }

  if (ruleResult.confidence > openAiResult.confidence) {
    return { ...ruleResult, source: 'rules_override' };
  }

  return { ...openAiResult, source: 'openai_first' };
}

function resolveAdvisoryFlowFacts(resolvedQuery, contextual) {
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

function shouldSeekOpenAiAnswer({
  knowledgeRoute,
  facts,
  classification,
  useOpenAi,
}) {
  if (!useOpenAi) return false;

  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.DEALER_CHECK) {
    return knowledgeRoute.reason !== 'leasing_rate'
      && classification.queryType !== QUERY_TYPES.SPECIAL_CHECK_QUESTION;
  }

  if (facts.kind === 'advice_unmatched' || facts.kind === 'advice_snippets') {
    return true;
  }

  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.GENERAL
    && shouldUseOpenAiGeneralKnowledge(knowledgeRoute)) {
    return facts.kind !== 'ranking'
      && facts.kind !== 'comparison'
      && facts.kind !== 'approved_knowledge'
      && facts.kind !== 'clarification_largest_ev'
      && facts.kind !== 'model_detail'
      && facts.kind !== 'family_variant_advice';
  }

  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.CLEVER_DATA
    && facts.kind === 'model_equipment'
    && !hasVerifiedCleverFacts(facts)) {
    return true;
  }

  if (classification.queryType === QUERY_TYPES.UNKNOWN) {
    return true;
  }

  return false;
}

function isOpenEquipmentQuestion(query, classification) {
  return classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION
    && /steckdose|usb|v2l|12v|anschluss|steckdosen/i.test(query)
    && !classification.featureId;
}

async function resolveOpenAiAdvisorFacts({
  query,
  classification,
  sessionContext,
  knowledgeRoute,
  localFacts,
  useOpenAi,
}) {
  if (!shouldSeekOpenAiAnswer({ knowledgeRoute, facts: localFacts, classification, useOpenAi })) {
    return null;
  }

  const cleverFacts = hasVerifiedCleverFacts(localFacts)
    ? {
        kind: localFacts.kind,
        bullets: localFacts.bullets ?? [],
        modelKey: localFacts.modelKey,
        availability: localFacts.availability ?? null,
      }
    : null;

  const dataGap = localFacts.kind === 'model_equipment' && !cleverFacts
    ? `Keine geprüften Clever-Daten zu ${classification.topic ?? 'Ausstattung'} für ${classification.modelKey}`
    : null;

  try {
    return await answerWithOpenAiAdvisor({
      query,
      classification,
      sessionContext,
      routing: knowledgeRoute,
      cleverFacts,
      dataGap,
    });
  } catch {
    return null;
  }
}

function buildDealerDataFacts(query, classification, knowledgeRoute) {
  const modelKey = classification.modelKey ?? knowledgeRoute.modelKey;
  const dealerData = detectDealerDataQuery(query);
  const isLeasing = knowledgeRoute.reason === 'leasing_rate' || dealerData?.kind === 'leasing_rate';

  return {
    kind: 'dealer_data_required',
    modelKey,
    headline: isLeasing ? 'Leasing & Konditionen' : 'Angebot vom Autohaus',
    shortAnswer: isLeasing
      ? 'Konkrete Leasingraten hängen von Laufzeit, Kilometerleistung, Anzahlung und aktuellen Händleraktionen ab. Ihr Autohaus rechnet das verbindlich für Sie – ohne Schätzwerte aus dem Internet.'
      : 'Für verbindliche Preise, Ausstattung und Verfügbarkeit ist Ihr Autohaus der richtige Ansprechpartner. Clever leitet Ihre Anfrage direkt weiter.',
    dealerHint: 'Senden Sie eine Anfrage – ein Verkäufer meldet sich mit passenden Optionen.',
    dataConfidence: DATA_CONFIDENCE.NEEDS_DEALER_CHECK,
    sources: ['dealer_data_policy'],
  };
}

/**
 * @param {object} input
 */
export async function orchestrateCustomerQuery(input = {}) {
  const rawQuery = String(input.query ?? '').trim();
  const sessionContext = input.context ?? {};
  const useOpenAi = shouldUseOpenAi(input);
  const brandScope = getDealerBrandScope(input.dealerId ?? sessionContext.dealerId);
  const brandAnalysis = analyzeQueryBrands(rawQuery, brandScope);

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

    if (useOpenAi) {
      try {
        const openAiClassification = await classifyWithOpenAi(query, enrichedContext);
        classification = mergeClassificationOpenAiFirst(openAiClassification, ruleClassification);
        pipelineSource = openAiClassification ? 'openai_first' : 'rules';
      } catch {
        classification = ruleClassification;
        pipelineSource = 'rules_fallback';
      }
    }
  }

  const brandEnriched = enrichClassificationWithBrandScope(query, brandScope, classification);
  classification = normalizeClassification(brandEnriched.classification);
  const activeBrandAnalysis = brandEnriched.analysis ?? brandAnalysis;

  let facts = resolveAdvisoryFlowFacts(query, contextual, classification)
    ?? resolveFactsForQuery(classification, query);

  if (isOpenEquipmentQuestion(query, classification)) {
    facts = buildGeneralKnowledgeFacts({
      query,
      classification: { ...classification, topic: 'power_outlets' },
      routing: { reason: 'model_equipment_gap' },
    });
    facts.modelKey = classification.modelKey;
    facts.primaryModelKey = classification.modelKey;
  }

  const brandScopedFacts = buildBrandScopedKnowledgeFacts({
    query,
    classification,
    brandScope,
    analysis: activeBrandAnalysis,
  });
  if (brandScopedFacts) {
    facts = brandScopedFacts;
    classification = normalizeClassification({
      ...classification,
      shouldShowModels: Boolean(brandScopedFacts.primaryModelKey && !brandScopedFacts.disallowForeignDetail),
    });
  }

  const knowledgeRoute = routeQueryKnowledge(query, classification);

  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.DEALER_CHECK
    && classification.queryType !== QUERY_TYPES.MIXED_INTENT
    && (knowledgeRoute.reason === 'leasing_rate'
      || classification.queryType === QUERY_TYPES.PURCHASE_INTENT
      || (classification.needsDealerCheck && knowledgeRoute.reason !== 'special_check'))) {
    facts = buildDealerDataFacts(query, classification, knowledgeRoute);
    classification = normalizeClassification({
      ...classification,
      needsDealerCheck: true,
      shouldAskForContact: true,
      shouldShowModels: false,
    });
  } else {
    const openAiFacts = await resolveOpenAiAdvisorFacts({
      query,
      classification,
      sessionContext: { ...sessionContext, brandScope, brandAnalysis: activeBrandAnalysis },
      knowledgeRoute,
      localFacts: facts,
      useOpenAi: useOpenAi && !brandScopedFacts?.disallowForeignDetail,
    });

    if (openAiFacts) {
      facts = openAiFacts;
      pipelineSource = `${pipelineSource}+openai_advisor`;

      if (knowledgeRoute.competitor || openAiFacts.competitorMentions?.length) {
        classification = normalizeClassification({
          ...classification,
          queryType: QUERY_TYPES.COMPETITOR_COMPARISON,
          topic: classification.topic ?? 'competitor_comparison',
        });
      } else if (openAiFacts.structured?.answerType === 'general_comparison') {
        classification = normalizeClassification({
          ...classification,
          queryType: QUERY_TYPES.GENERAL_CAR_COMPARISON,
        });
      }

      if (openAiFacts.needsDealerCheck && classification.queryType !== QUERY_TYPES.MIXED_INTENT) {
        classification = normalizeClassification({
          ...classification,
          needsDealerCheck: true,
          shouldAskForContact: true,
        });
      }
    } else if (!brandScopedFacts && knowledgeRoute.route === KNOWLEDGE_ROUTES.GENERAL
      && shouldUseOpenAiGeneralKnowledge(knowledgeRoute)
      && facts.kind !== 'ranking'
      && facts.kind !== 'comparison'
      && facts.kind !== 'model_equipment'
      && facts.kind !== 'approved_knowledge'
      && facts.kind !== 'clarification_largest_ev'
      && facts.kind !== 'model_detail'
      && facts.kind !== 'family_variant_advice'
      && facts.kind !== 'model_technical'
      && facts.kind !== 'advisor_profile') {
      facts = buildGeneralKnowledgeFacts({ query, classification, routing: knowledgeRoute });

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
      }
    } else if (!brandScopedFacts && (facts.kind === 'advice_unmatched' || facts.kind === 'advice_snippets')) {
      facts = buildGeneralKnowledgeFacts({ query, classification, routing: knowledgeRoute });
    } else if (!brandScopedFacts && knowledgeRoute.route === KNOWLEDGE_ROUTES.CLEVER_DATA
      && facts.kind === 'model_equipment'
      && !hasVerifiedCleverFacts(facts)
      && facts.kind !== 'model_technical') {
      facts = buildGeneralKnowledgeFacts({
        query,
        classification: { ...classification, topic: classification.topic ?? 'equipment_gap' },
        routing: { ...knowledgeRoute, reason: 'model_equipment_gap' },
      });
      facts.modelKey = classification.modelKey;
      facts.primaryModelKey = classification.modelKey;
      facts.subkind = 'model_equipment_gap';
    }
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

  if (facts?.kind === 'mixed_intent') {
    classification = normalizeClassification({
      ...classification,
      queryType: QUERY_TYPES.MIXED_INTENT,
      shouldAskForContact: false,
      needsDealerCheck: false,
      shouldShowModels: true,
    });
  }

  let answer = buildTemplateAnswer(classification, facts, query);

  const canFormulate = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    && facts.kind === 'advice_topic'
    && classification.topic !== 'general_advice';

  if (canFormulate && useOpenAi) {
    try {
      const formulated = await formulateWithOpenAi({ query, classification, facts });
      if (formulated?.body) {
        answer = {
          mode: 'advice',
          title: formulated.title,
          body: formulated.body,
          disclaimer: formulated.disclaimer,
          kicker: 'Clever Einschätzung',
          primaryModelKey: classification.modelKey,
          source: formulated.source,
          dataConfidence: DATA_CONFIDENCE.CLEVER_VERIFIED,
        };
      }
    } catch {
      /* Template bleibt */
    }
  }

  const dataConfidence = facts.dataConfidence
    ?? resolveDataConfidence({
      classification,
      facts,
      knowledgeRoute,
      answerSource: answer?.source,
    });

  const dataConfidenceLabel = DATA_CONFIDENCE_LABELS[dataConfidence]
    ?? DATA_CONFIDENCE_LABELS[DATA_CONFIDENCE.GENERAL];

  let followUpSuggestions = facts.followUpSuggestions?.length
    ? facts.followUpSuggestions
    : buildBrandScopedFollowUps({
      facts,
      classification,
      brandScope,
      analysis: activeBrandAnalysis,
    })
    ?? buildFollowUpSuggestions({
      classification,
      facts,
      smartAnswer: answer?.smartAnswer,
      sessionContext,
      brandScope,
      brandAnalysis: activeBrandAnalysis,
    });

  followUpSuggestions = filterFollowUpsForBrandScope(followUpSuggestions, brandScope);

  const competitorInterest = buildCompetitorInterest(rawQuery, activeBrandAnalysis, brandScope);
  const brandScopeSignals = buildBrandScopeCrmSignals(activeBrandAnalysis, rawQuery);

  const uiComponent = resolveUiComponent(classification, answer);
  const smartAnswer = hybridAnswerToSmartAnswerCard(answer, classification, followUpSuggestions);

  if (smartAnswer) {
    smartAnswer.dataConfidence = dataConfidence;
    smartAnswer.dataConfidenceLabel = dataConfidenceLabel;
    if (facts.ctaPrimary) smartAnswer.dealerCtaLabel = facts.ctaPrimary;
    if (facts.ctaSecondary) smartAnswer.secondaryCtaLabel = facts.ctaSecondary;
  }

  const extractedSignals = [
    ...brandScopeSignals,
    ...(facts.extractedSignals ?? []),
    ...(sessionContext.extractedSignals ?? []),
  ].filter(Boolean);

  const isAdvice = classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    || facts.kind === 'family_variant_advice'
    || facts.kind === 'general_knowledge';
  const advicePayload = (isAdvice || classification.needsDealerCheck)
    && classification.queryType !== QUERY_TYPES.MIXED_INTENT
    ? buildAdviceQuestionPayload(classification, rawQuery)
    : null;

  const structured = facts.structured ?? null;

  return {
    ok: true,
    source: pipelineSource,
    resolvedQuery: contextual.enriched ? query : null,
    classification,
    dealerBrandScope: {
      dealerId: brandScope.dealerId,
      allowedBrands: brandScope.allowedBrands,
      primaryBrand: brandScope.primaryBrand,
    },
    competitorInterest,
    dataConfidence,
    dataConfidenceLabel,
    extractedSignals: [...new Set(extractedSignals)],
    structured: structured ? {
      queryType: structured.queryType,
      answerType: structured.answerType,
      headline: structured.headline,
      shortAnswer: structured.shortAnswer,
      sections: structured.sections,
      modelKeys: structured.modelKeys,
      competitorModels: structured.competitorModels,
      topics: structured.topics,
      ctaPrimary: structured.ctaPrimary,
      ctaSecondary: structured.ctaSecondary,
    } : null,
    facts: {
      kind: facts.kind,
      bullets: facts.bullets ?? [],
      sources: facts.sources ?? [],
      modelKey: facts.modelKey ?? classification.modelKey,
      adviceTopicId: facts.adviceTopicId ?? classification.adviceTopicId ?? null,
      competitorMentions: facts.competitorMentions ?? [],
      dataConfidence,
    },
    answer: answer ? {
      mode: answer.mode,
      title: answer.title,
      body: answer.body,
      disclaimer: answer.disclaimer,
      kicker: answer.kicker,
      source: answer.source,
      dataConfidence,
      dataConfidenceLabel,
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
      : (classification.queryType === QUERY_TYPES.PURCHASE_INTENT ? advicePayload : null),
    adviceContact: advicePayload,
    knowledgeRoute: knowledgeRoute.route,
    knowledgeReason: knowledgeRoute.reason,
    persistence: {
      suggestLearningRequest: false,
      queryType: classification.queryType,
      topic: classification.topic,
      adviceTopicId: classification.adviceTopicId ?? null,
      customerQuestion: rawQuery,
      advisorConversationSummary: sessionContext.advisorConversationSummary ?? null,
      extractedSignals,
      competitorInterest,
      nextStepHint: competitorInterest
        ? 'Alternative aus eigener Markenwelt anbieten'
        : null,
    },
  };
}
