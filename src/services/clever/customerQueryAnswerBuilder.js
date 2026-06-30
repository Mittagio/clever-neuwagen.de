/**
 * Template-Antworten ohne LLM + Mapping für UI.
 */
import { DEALER_DISCLAIMER, QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';
import { SPECIAL_QUESTION_COPY } from '../dealer/specialCustomerQuestionService.js';

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
      kicker: 'Clever Wissen · geprüft',
      source: 'approved_knowledge',
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
 */
export function hybridAnswerToSmartAnswerCard(answer = {}, classification = {}) {
  if (!answer) return null;
  if (answer.smartAnswer) return answer.smartAnswer;

  const facts = (answer.facts ?? []).length
    ? answer.facts
    : undefined;

  return {
    mode: 'info',
    intent: 'hybrid_query',
    kicker: answer.kicker ?? 'Clever Antwort',
    title: answer.title ?? 'Clever Antwort',
    lead: answer.body ?? '',
    summary: answer.disclaimer ?? DEALER_DISCLAIMER,
    primaryModelKey: answer.primaryModelKey ?? classification.modelKey ?? null,
    facts: facts ?? [],
    narrative: answer.body ? [answer.body] : [],
    canShowOffers: classification.shouldShowModels,
    routingLayer: 'advisory',
  };
}

/**
 * @param {object} classification
 * @param {object} answer
 */
export function resolveUiComponent(classification = {}, answer = null) {
  if (classification.queryType === QUERY_TYPES.SPECIAL_CHECK_QUESTION
    || classification.shouldAskForContact) {
    return UI_COMPONENTS.SPECIAL_CONTACT;
  }
  if (classification.queryType === QUERY_TYPES.VEHICLE_WISH) {
    return UI_COMPONENTS.NEED_SEARCH;
  }
  if (answer && (classification.queryType === QUERY_TYPES.ADVICE_QUESTION
    || classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION)) {
    return classification.queryType === QUERY_TYPES.ADVICE_QUESTION
      ? UI_COMPONENTS.ADVICE_ANSWER
      : UI_COMPONENTS.SMART_ANSWER;
  }
  return UI_COMPONENTS.NEED_SEARCH;
}

/**
 * @param {object} classification
 * @param {string} query
 */
export function buildSpecialQuestionPayload(classification = {}, query = '') {
  return {
    rawText: query,
    category: classification.topic ?? 'Sonstiges',
    modelKey: classification.modelKey,
    modelLabel: null,
    status: 'needs_dealer_check',
    createdAt: new Date().toISOString(),
  };
}
