/**
 * Template-Antworten ohne LLM + Mapping für UI.
 */
import { DEALER_DISCLAIMER, QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';
import { SPECIAL_QUESTION_COPY } from '../dealer/specialCustomerQuestionService.js';
import { getAdviceTopicById } from './adviceTopicsRegistry.js';

function rankingToSmartAnswer(ranking, query) {
  const matches = ranking?.matches ?? [];
  const highlights = matches.slice(0, 5).map((match) => ({
    modelKey: match.modelKey,
    label: match.label,
    detail: match.factLine?.split(' · ')[0] ?? null,
  }));

  let lead = null;
  if (matches.length > 1) {
    const second = matches[1];
    const detail = second.factLine?.split(' · ')[0];
    lead = detail
      ? `Danach folgen ${second.label} (${detail}) und weitere Modelle.`
      : `Danach folgt ${second.label} und weitere Modelle.`;
  }

  return {
    mode: 'info',
    intent: 'vehicle_fact_question',
    query,
    kicker: 'Clever Antwort',
    title: ranking?.headline ?? 'Kia-Modelle im Vergleich',
    lead,
    summary: DEALER_DISCLAIMER,
    facts: [],
    highlights,
    matchCount: matches.length,
    canShowOffers: true,
    routingLayer: 'advisory',
  };
}

/**
 * @param {object} facts
 */
export function buildClarificationSmartAnswer(facts = {}) {
  return {
    mode: 'info',
    intent: 'clarification_question',
    kicker: 'Clever Antwort',
    title: facts.headline,
    lead: facts.shortAnswer,
    facts: (facts.orientation ?? []).map((item) => ({
      label: item.label,
      value: item.hint,
    })),
    summary: DEALER_DISCLAIMER,
    canShowOffers: false,
    routingLayer: 'advisory',
  };
}

/**
 * @param {object} facts
 */
export function buildModelDetailSmartAnswer(facts = {}) {
  const narrative = [
    facts.shortAnswer,
    facts.strengths?.length ? `Stärken: ${facts.strengths.join(' · ')}` : null,
    facts.watchOut?.length ? `Worauf achten: ${facts.watchOut.join(' · ')}` : null,
    facts.fits?.length ? `Passt besonders für: ${facts.fits.join(' · ')}` : null,
  ].filter(Boolean);

  return {
    mode: 'info',
    intent: 'model_detail_question',
    kicker: 'Clever Antwort',
    title: facts.headline,
    lead: facts.shortAnswer,
    primaryModelKey: facts.modelKey,
    facts: (facts.bullets ?? []).map((b) => ({ label: 'Daten', value: b })),
    narrative,
    summary: DEALER_DISCLAIMER,
    canShowOffers: false,
    routingLayer: 'advisory',
  };
}

export function buildAdvisorProfileSmartAnswer(facts = {}) {
  return {
    mode: 'clever_assessment',
    intent: 'advisor_profile_assessment',
    kicker: 'Clever Einschätzung',
    title: facts.headline,
    lead: facts.shortAnswer,
    understoodWishes: facts.understoodWishes ?? [],
    understoodLabel: 'Das haben wir verstanden:',
    modelDirections: facts.modelDirections ?? [],
    modelDirectionsLabel: 'Erste passende Richtung:',
    dealerChecks: facts.dealerChecks ?? [],
    dealerChecksLabel: 'Das sollte Ihr Autohaus klären:',
    primaryModelKey: facts.primaryModelKey ?? facts.modelKey ?? null,
    dealerCtaLabel: 'Verkäufer dazu fragen',
    summary: DEALER_DISCLAIMER,
    canShowOffers: false,
    routingLayer: 'advisory',
    showDealerCta: false,
  };
}

/**
 * @param {object} facts
 */
export function buildModelTechnicalSmartAnswer(facts = {}) {
  const confidenceLabel = facts.hasVerifiedData
    ? 'Nach hinterlegten Fahrzeugdaten'
    : 'Allgemeine Einschätzung';

  return {
    mode: 'info',
    intent: 'model_equipment_question',
    kicker: confidenceLabel,
    title: facts.headline,
    lead: facts.shortAnswer,
    primaryModelKey: facts.modelKey ?? null,
    facts: facts.facts ?? (facts.bullets ?? []).map((b) => ({ label: 'Daten', value: b })),
    narrative: [facts.shortAnswer].filter(Boolean),
    summary: DEALER_DISCLAIMER,
    canShowOffers: false,
    routingLayer: 'clever_data',
    showDealerCta: true,
    dealerCtaLabel: 'Verkäufer dazu fragen',
  };
}

/**
 * @param {object} facts
 */
export function buildMixedIntentSmartAnswer(facts = {}) {
  return {
    mode: 'mixed',
    intent: 'mixed_intent',
    kicker: 'Clever Antwort',
    title: facts.headline,
    lead: facts.shortAnswer,
    primaryModelKey: facts.primaryModelKey ?? facts.modelKey ?? null,
    understoodWishes: facts.understoodWishes ?? [],
    understoodLabel: 'Das haben wir verstanden:',
    dealerFinalChecks: facts.dealerFinalChecks ?? [],
    dealerChecksLabel: 'Das prüft Ihr Autohaus final:',
    openQuestions: facts.openQuestions ?? [],
    summary: DEALER_DISCLAIMER,
    canShowOffers: true,
    routingLayer: 'advisory',
    showDealerCta: false,
  };
}

/**
 * @param {object} facts
 */
export function buildFamilyVariantSmartAnswer(facts = {}, classification = {}) {
  return {
    mode: 'advice',
    intent: 'advice_question',
    kicker: 'Clever Einschätzung',
    title: facts.headline,
    lead: facts.shortAnswer,
    usefulWhen: facts.usefulWhen ?? [],
    dealerChecks: facts.dealerChecks ?? [],
    dealerHint: facts.dealerCheckHint,
    primaryModelKey: facts.modelKey,
    showDealerCta: true,
    dealerCtaLabel: 'Verkäufer dazu fragen',
    adviceTopicId: 'family_luggage',
    summary: DEALER_DISCLAIMER,
    canShowOffers: false,
    routingLayer: 'advice',
  };
}

/**
 * @param {object} facts
 */
export function buildGeneralKnowledgeSmartAnswer(facts = {}) {
  const narrative = [
    facts.shortAnswer,
    ...(facts.narrative ?? []),
    facts.kiaBridge,
    facts.dealerHint,
  ].filter(Boolean);

  const isAdvice = facts.subkind === 'towing_range' || facts.subkind === 'heat_pump'
    || facts.usefulWhen?.length;
  const confidenceLabel = facts.dataConfidence === 'clever_verified'
    ? 'Nach hinterlegten Fahrzeugdaten'
    : facts.dataConfidence === 'needs_dealer_check'
      ? 'Autohaus prüft final'
      : 'Allgemeine Einschätzung';

  return {
    mode: isAdvice ? 'advice' : 'info',
    intent: facts.kind === 'general_knowledge' ? 'general_car_question' : 'hybrid_query',
    kicker: confidenceLabel,
    title: facts.headline,
    lead: facts.shortAnswer,
    usefulWhen: facts.usefulWhen ?? [],
    narrative: facts.narrative?.length ? facts.narrative : undefined,
    kiaBridge: facts.kiaBridge,
    dealerHint: facts.dealerHint,
    showDealerCta: true,
    dealerCtaLabel: 'Verkäufer dazu fragen',
    primaryModelKey: facts.primaryModelKey ?? facts.kiaAlternatives?.[0] ?? null,
    competitorMentions: facts.competitorMentions ?? [],
    canShowOffers: false,
    routingLayer: 'general_knowledge',
    summary: DEALER_DISCLAIMER,
  };
}

/**
 * @param {object} facts
 */
export function buildDealerDataRequiredSmartAnswer(facts = {}) {
  return {
    mode: 'info',
    intent: 'dealer_data_required',
    kicker: 'Clever Antwort',
    title: facts.headline,
    lead: facts.shortAnswer,
    dealerHint: facts.dealerHint,
    showDealerCta: true,
    dealerCtaLabel: 'Angebot vom Autohaus anfragen',
    primaryModelKey: facts.modelKey ?? null,
    canShowOffers: false,
    routingLayer: 'dealer_check',
    summary: DEALER_DISCLAIMER,
  };
}

/**
 * @param {object} facts
 * @param {object} classification
 */
export function buildAdviceSmartAnswer(facts = {}, classification = {}) {
  if (facts.kind === 'advice_unmatched') {
    return null;
  }

  if (facts.kind !== 'advice_topic') return null;

  return {
    mode: 'advice',
    intent: 'advice_question',
    kicker: 'Clever Einschätzung',
    title: facts.label ?? facts.headline,
    lead: facts.shortAnswer,
    usefulWhen: facts.usefulWhen ?? [],
    lessImportantWhen: facts.lessImportantWhen ?? [],
    dealerChecks: facts.dealerChecks ?? [],
    dealerHint: facts.dealerCheckHint,
    relatedTopics: facts.relatedQuestions ?? [],
    showDealerCta: true,
    dealerCtaLabel: facts.ctaLabel ?? 'Verkäufer dazu fragen',
    showSecondaryCta: Boolean(facts.secondaryCtaLabel),
    secondaryCtaLabel: facts.secondaryCtaLabel,
    showOptionalModelsCta: Boolean(facts.featureId),
    optionalModelsCtaLabel: facts.featureId === 'towbar'
      ? 'Passende Modelle mit Anhängelast ansehen'
      : 'Passende Modelle ansehen',
    optionalModelsFeatureId: facts.featureId ?? null,
    canShowOffers: false,
    routingLayer: 'advice',
    adviceTopicId: facts.adviceTopicId ?? classification.adviceTopicId,
    needsDealerCheck: facts.needsDealerCheck ?? classification.needsDealerCheck,
    summary: DEALER_DISCLAIMER,
  };
}

/**
 * @param {object} classification
 * @param {string} query
 */
export function buildAdviceQuestionPayload(classification = {}, query = '') {
  const adviceTopicId = classification.adviceTopicId ?? (
    classification.topic && classification.topic !== 'unmatched_advice'
      && classification.topic !== 'general_advice'
      ? classification.topic
      : null
  );
  const topic = adviceTopicId ? getAdviceTopicById(adviceTopicId) : null;

  return {
    rawText: query,
    queryType: QUERY_TYPES.ADVICE_QUESTION,
    adviceTopicId,
    category: topic?.label ? `Beratung / ${topic.label}` : 'Beratung',
    modelKey: classification.modelKey ?? null,
    modelLabel: null,
    status: 'needs_dealer_check',
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {object} classification
 * @param {object} facts
 * @param {string} query
 */
export function buildTemplateAnswer(classification = {}, facts = {}, query = '') {
  if (facts.kind === 'approved_knowledge') {
    return {
      mode: 'knowledge',
      title: 'Clever Wissen',
      body: facts.approvedAnswer.answerText,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Nach hinterlegten Fahrzeugdaten',
      source: 'approved_knowledge',
      dataConfidence: 'clever_verified',
    };
  }

  if (facts.kind === 'general_knowledge') {
    const smartAnswer = buildGeneralKnowledgeSmartAnswer(facts);
    return {
      mode: smartAnswer.mode,
      title: facts.headline,
      body: [facts.shortAnswer, facts.kiaBridge, facts.dealerHint].filter(Boolean).join(' '),
      disclaimer: DEALER_DISCLAIMER,
      kicker: smartAnswer.kicker,
      primaryModelKey: facts.primaryModelKey ?? facts.kiaAlternatives?.[0] ?? null,
      source: facts.subkind === 'openai' ? 'openai_general_knowledge' : 'general_knowledge_templates',
      smartAnswer,
    };
  }

  if (facts.kind === 'dealer_data_required') {
    const smartAnswer = buildDealerDataRequiredSmartAnswer(facts);
    return {
      mode: 'dealer_data',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.modelKey,
      source: 'dealer_data_required',
      smartAnswer,
    };
  }

  if (facts.kind === 'clarification_largest_ev') {
    const smartAnswer = buildClarificationSmartAnswer(facts);
    return {
      mode: 'clarification',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      source: 'clarification_largest_ev',
      smartAnswer,
    };
  }

  if (facts.kind === 'model_detail') {
    const smartAnswer = buildModelDetailSmartAnswer(facts);
    return {
      mode: 'model_detail',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.modelKey,
      source: 'model_detail',
      smartAnswer,
    };
  }

  if (facts.kind === 'mixed_intent') {
    const smartAnswer = buildMixedIntentSmartAnswer(facts);
    return {
      mode: 'mixed',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.primaryModelKey ?? facts.modelKey ?? null,
      source: 'mixed_intent',
      smartAnswer,
    };
  }

  if (facts.kind === 'advisor_profile') {
    const smartAnswer = buildAdvisorProfileSmartAnswer(facts);
    return {
      mode: 'clever_assessment',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Einschätzung',
      primaryModelKey: facts.primaryModelKey ?? facts.modelKey ?? null,
      source: 'advisor_profile_assessment',
      smartAnswer,
    };
  }

  if (facts.kind === 'model_technical') {
    const smartAnswer = buildModelTechnicalSmartAnswer(facts);
    return {
      mode: 'info',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: smartAnswer.kicker,
      primaryModelKey: facts.modelKey,
      facts: facts.facts ?? [],
      source: facts.hasVerifiedData ? 'kia_clever_technical' : 'model_technical_templates',
      smartAnswer,
      dataConfidence: facts.hasVerifiedData ? 'clever_verified' : 'general',
    };
  }

  if (facts.kind === 'family_variant_advice') {
    const smartAnswer = buildFamilyVariantSmartAnswer(facts, classification);
    return {
      mode: 'advice',
      title: facts.headline,
      body: facts.shortAnswer,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Einschätzung',
      primaryModelKey: facts.modelKey,
      source: 'family_variant_advice',
      smartAnswer,
    };
  }

  if (facts.kind === 'ranking' && facts.ranking) {
    const smartAnswer = rankingToSmartAnswer(facts.ranking, query);
    const topLines = (facts.bullets ?? []).slice(0, 3).join(' ');
    return {
      mode: 'ranking',
      title: facts.ranking.headline ?? 'Ranking',
      body: topLines,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.ranking.matches?.[0]?.modelKey ?? null,
      source: 'vehicle_lexicon_ranking',
      smartAnswer,
    };
  }

  if (facts.kind === 'comparison' && facts.smartAnswer) {
    const sa = facts.smartAnswer;
    const contextualTitle = facts.contextualTitle;
    const title = contextualTitle ?? sa.title;
    const narrative = [...(sa.narrative ?? []), sa.lead, sa.summary].filter(Boolean);
    return {
      mode: 'comparison',
      title,
      body: narrative.join(' ') || (facts.bullets ?? []).join(' '),
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.comparisonModels?.[0] ?? sa.primaryModelKey ?? null,
      facts: sa.facts ?? facts.bullets?.map((b) => ({ label: 'Vergleich', value: b })),
      source: 'dealer_advisory_compare',
      smartAnswer: sa,
    };
  }

  if (facts.kind === 'advice_topic' || facts.kind === 'advice_unmatched') {
    const smartAnswer = buildAdviceSmartAnswer(facts, classification);
    return {
      mode: 'advice',
      title: smartAnswer?.title ?? facts.headline ?? 'Clever Beratung',
      body: facts.shortAnswer ?? (facts.snippets ?? []).join(' '),
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Einschätzung',
      source: facts.kind === 'advice_unmatched' ? 'advice_unmatched' : 'adviceTopicsRegistry',
      smartAnswer,
      adviceTopicId: facts.adviceTopicId ?? classification.adviceTopicId,
    };
  }

  if (facts.kind === 'advice_snippets') {
    const body = (facts.snippets ?? []).join(' ');
    return {
      mode: 'advice',
      title: facts.headline ?? 'Clever Beratung',
      body,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Beratung',
      source: 'advice_snippets',
    };
  }

  if (facts.kind === 'model_equipment') {
    if (facts.smartAnswer?.title) {
      const sa = facts.smartAnswer;
      const narrative = [...(sa.narrative ?? []), sa.lead, sa.summary].filter(Boolean);
      return {
        mode: 'model',
        title: sa.title,
        body: narrative.join(' ') || (facts.bullets ?? []).join(' '),
        disclaimer: DEALER_DISCLAIMER,
        kicker: 'Clever Antwort',
        primaryModelKey: facts.modelKey ?? sa.primaryModelKey,
        facts: sa.facts ?? facts.bullets?.map((b) => ({ label: 'Hinweis', value: b })),
        source: 'dealer_smart_answer',
        smartAnswer: sa,
      };
    }

    const title = facts.modelLabel
      ? `${facts.modelLabel}: Ausstattung`
      : 'Ausstattungsfrage';
    const body = (facts.bullets ?? []).join(' ') || 'Dazu haben wir passende Informationen im Bestand.';
    return {
      mode: 'model',
      title,
      body,
      disclaimer: DEALER_DISCLAIMER,
      kicker: 'Clever Antwort',
      primaryModelKey: facts.modelKey,
      source: 'trim_facts',
    };
  }

  if (facts.kind === 'dealer_check') {
    return {
      mode: 'special',
      title: SPECIAL_QUESTION_COPY.headline,
      body: SPECIAL_QUESTION_COPY.text,
      disclaimer: null,
      kicker: 'Clever Einschätzung',
      source: 'special_check',
    };
  }

  return null;
}

/**
 * @param {object} answer
 * @param {object} classification
 * @param {object[]} [followUpSuggestions]
 */
export function hybridAnswerToSmartAnswerCard(answer = {}, classification = {}, followUpSuggestions = []) {
  if (!answer) return null;
  const base = answer.smartAnswer ?? {
    mode: 'info',
    intent: 'hybrid_query',
    kicker: answer.kicker ?? 'Clever Antwort',
    title: answer.title ?? 'Clever Antwort',
    lead: answer.body ?? '',
    summary: answer.disclaimer ?? DEALER_DISCLAIMER,
    primaryModelKey: answer.primaryModelKey ?? classification.modelKey ?? null,
    facts: (answer.facts ?? []).length ? answer.facts : [],
    narrative: answer.body ? [answer.body] : [],
    canShowOffers: classification.shouldShowModels,
    routingLayer: 'advisory',
  };

  return {
    ...base,
    followUpSuggestions: followUpSuggestions.length ? followUpSuggestions : (base.followUpSuggestions ?? []),
    followUpLabel: base.mode === 'advice' ? 'Nächster Schritt' : 'Das könnten Sie auch fragen:',
  };
}

/**
 * @param {object} classification
 * @param {object} answer
 */
export function resolveUiComponent(classification = {}, answer = null) {
  if (classification.queryType === QUERY_TYPES.MIXED_INTENT) {
    return UI_COMPONENTS.SMART_ANSWER;
  }
  if (classification.queryType === QUERY_TYPES.SPECIAL_CHECK_QUESTION) {
    return UI_COMPONENTS.SPECIAL_CONTACT;
  }
  if (classification.queryType === QUERY_TYPES.VEHICLE_WISH) {
    if (classification.topic === 'advisor_profile_assessment' || answer?.mode === 'clever_assessment') {
      return UI_COMPONENTS.SMART_ANSWER;
    }
    return UI_COMPONENTS.NEED_SEARCH;
  }
  if (answer && classification.queryType === QUERY_TYPES.RANKING_QUESTION) {
    return UI_COMPONENTS.RANKING_ANSWER;
  }
  if (answer && classification.queryType === QUERY_TYPES.COMPARISON_QUESTION) {
    return UI_COMPONENTS.COMPARISON_ANSWER;
  }
  if (answer && (classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    || answer.mode === 'model_detail'
    || answer.mode === 'clarification'
    || answer.mode === 'advice'
    || classification.queryType === QUERY_TYPES.GENERAL_CAR_QUESTION
    || classification.queryType === QUERY_TYPES.GENERAL_CAR_COMPARISON
    || classification.queryType === QUERY_TYPES.COMPETITOR_COMPARISON
    || classification.queryType === QUERY_TYPES.COMPETITOR_QUESTION)) {
    if (answer.mode === 'model_detail' || answer.mode === 'clarification' || answer.mode === 'info') {
      return UI_COMPONENTS.SMART_ANSWER;
    }
    return UI_COMPONENTS.ADVICE_ANSWER;
  }

  if (answer?.mode === 'dealer_data' || classification.needsDealerCheck) {
    return UI_COMPONENTS.SMART_ANSWER;
  }
  if (answer && classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION) {
    return UI_COMPONENTS.SMART_ANSWER;
  }
  return UI_COMPONENTS.NEED_SEARCH;
}

/**
 * @param {object} classification
 * @param {string} query
 */
export function buildSpecialQuestionPayload(classification = {}, query = '') {
  if (classification.queryType === QUERY_TYPES.ADVICE_QUESTION) {
    return buildAdviceQuestionPayload(classification, query);
  }
  return {
    rawText: query,
    category: classification.topic ?? 'Sonstiges',
    modelKey: classification.modelKey,
    modelLabel: null,
    status: 'needs_dealer_check',
    createdAt: new Date().toISOString(),
  };
}
