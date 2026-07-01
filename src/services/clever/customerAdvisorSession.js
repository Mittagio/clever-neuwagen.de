/**
 * Geführter Beratungsflow – Session-State für Multi-Turn „Frag Clever“.
 */
import { QUERY_TYPES } from './customerQueryTypes.js';

function uid() {
  return `adv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const OPEN_QUESTION_QUERY_TYPES = new Set([
  QUERY_TYPES.ADVICE_QUESTION,
  QUERY_TYPES.COMPARISON_QUESTION,
  QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
  QUERY_TYPES.COMPETITOR_QUESTION,
  QUERY_TYPES.COMPETITOR_COMPARISON,
]);

export function createCustomerAdvisorSession(dealerId = null) {
  return {
    id: uid(),
    dealerId,
    messages: [],
    followUpsClicked: [],
    currentContext: {
      brand: 'Kia',
      modelsInFocus: [],
      comparedModels: [],
      topics: [],
      adviceTopicIds: [],
      usageProfile: [],
      customerPriorities: [],
      possiblePurchaseIntent: null,
      lastQueryType: null,
      lastAnswerType: null,
      lastRankingMetric: null,
    },
    extractedCustomerSignals: [],
    suggestedFollowUps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} session
 */
export function sessionToApiContext(session = null) {
  if (!session) return {};
  return {
    sessionId: session.id,
    modelsInFocus: session.currentContext?.modelsInFocus ?? [],
    comparedModels: session.currentContext?.comparedModels ?? [],
    topics: session.currentContext?.topics ?? [],
    adviceTopicIds: session.currentContext?.adviceTopicIds ?? [],
    usageProfile: session.currentContext?.usageProfile ?? [],
    customerPriorities: session.currentContext?.customerPriorities ?? [],
    lastQueryType: session.currentContext?.lastQueryType ?? null,
    lastAnswerType: session.currentContext?.lastAnswerType ?? null,
    lastRankingMetric: session.currentContext?.lastRankingMetric ?? null,
    modelKey: session.currentContext?.modelsInFocus?.[0] ?? null,
    previousQueries: (session.messages ?? [])
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.text),
  };
}

/**
 * @param {object} session
 * @param {string} userText
 * @param {object} result – Orchestrator-Response
 */
export function appendAdvisorExchange(session, userText, result = {}) {
  const classification = result.classification ?? {};
  const ui = result.ui ?? {};
  const modelKeys = ui.modelKeys?.length
    ? ui.modelKeys
    : classification.modelKey
      ? [classification.modelKey]
      : [];
  const queryType = classification.queryType ?? null;
  const topic = classification.adviceTopicId ?? null;
  const now = new Date().toISOString();

  const next = {
    ...session,
    messages: [
      ...(session.messages ?? []),
      {
        role: 'user',
        text: userText,
        queryType,
        topic,
        modelKeys,
        at: now,
      },
      {
        role: 'assistant',
        text: result.answer?.title ?? result.smartAnswer?.title ?? '',
        body: result.answer?.body ?? result.smartAnswer?.lead ?? '',
        queryType,
        topic,
        modelKeys,
        at: now,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  next.currentContext = mergeContextFromResult(next.currentContext ?? {}, result, userText);
  next.extractedCustomerSignals = [
    ...new Set([
      ...(next.extractedCustomerSignals ?? []),
      ...(result.extractedSignals ?? []),
      ...extractCustomerSignals(next),
    ]),
  ];
  next.suggestedFollowUps = result.followUpSuggestions ?? [];
  if (result.competitorInterest) {
    next.currentContext = {
      ...next.currentContext,
      competitorInterest: result.competitorInterest,
    };
  }
  return next;
}

function mergeContextFromResult(ctx, result, userText) {
  const classification = result.classification ?? {};
  const facts = result.facts ?? {};
  const ui = result.ui ?? {};
  const modelKeys = ui.modelKeys?.length
    ? ui.modelKeys
    : classification.modelKey
      ? [classification.modelKey]
      : [];

  const modelsInFocus = [...new Set([
    ...(ctx.modelsInFocus ?? []),
    ...modelKeys,
    facts.modelKey,
    result.smartAnswer?.primaryModelKey,
  ].filter(Boolean))].slice(-3);

  let comparedModels = [...(ctx.comparedModels ?? [])];
  if (classification.comparisonModels?.length >= 2) {
    comparedModels = classification.comparisonModels;
  }

  const topics = [...(ctx.topics ?? [])];
  if (classification.adviceTopicId) {
    topics.push(classification.adviceTopicId);
  }

  const priorities = [...(ctx.customerPriorities ?? [])];
  if (/familie|kinder|7.?sitzer|kofferraum|iso\s*fix|isofix/i.test(userText)) priorities.push('Familie');
  if (/anhänger|wohnwagen|ziehen/i.test(userText)) priorities.push('Anhängerbetrieb');
  if (/reichweite|winter|urlaub/i.test(userText)) priorities.push('Reichweite');
  if (/kosten|leasing|finanzierung/i.test(userText)) priorities.push('Betriebskosten');
  if (/groß|ev9|suv/i.test(userText)) priorities.push('großes Auto');

  const usageProfile = [...(ctx.usageProfile ?? [])];
  if (/familie/i.test(userText)) usageProfile.push('Familie');
  if (/urlaub|langstrecke/i.test(userText)) usageProfile.push('Urlaub');

  return {
    ...ctx,
    modelsInFocus,
    comparedModels,
    topics: [...new Set(topics)].slice(-8),
    adviceTopicIds: classification.adviceTopicId
      ? [...new Set([...(ctx.adviceTopicIds ?? []), classification.adviceTopicId])]
      : (ctx.adviceTopicIds ?? []),
    customerPriorities: [...new Set(priorities)],
    usageProfile: [...new Set(usageProfile)],
    lastQueryType: classification.queryType ?? ctx.lastQueryType,
    lastAnswerType: facts.kind ?? ctx.lastAnswerType,
    lastRankingMetric: classification.rankingMetric ?? ctx.lastRankingMetric,
    competitorMentions: facts.competitorMentions?.length
      ? [...new Set([...(ctx.competitorMentions ?? []), ...facts.competitorMentions])]
      : (ctx.competitorMentions ?? []),
    possiblePurchaseIntent: /angebot|probefahrt|beraten|verkäufer/i.test(userText)
      ? 'contact_requested'
      : ctx.possiblePurchaseIntent,
  };
}

/**
 * @param {object} session
 */
export function extractCustomerSignals(session) {
  const ctx = session.currentContext ?? {};
  const signals = new Set(session.extractedCustomerSignals ?? []);

  for (const p of ctx.customerPriorities ?? []) signals.add(p);
  for (const u of ctx.usageProfile ?? []) signals.add(u);

  if (ctx.modelsInFocus?.includes('ev9')) signals.add('EV9 interessiert');
  if (ctx.comparedModels?.some((k) => k.includes('sorento'))) {
    signals.add('Sorento Diesel Alternative');
  }
  if (ctx.adviceTopicIds?.includes('ev_towing_range')) signals.add('Anhängerbetrieb prüfen');
  if (ctx.adviceTopicIds?.includes('winter_range')) signals.add('Reichweite wichtig');
  if (ctx.topics?.includes('family') || ctx.usageProfile?.includes('Familie')) {
    signals.add('6/7 Sitze prüfen');
  }

  if (ctx.competitorMentions?.length) {
    for (const name of ctx.competitorMentions) {
      signals.add(`Fremdmarke: ${name}`);
    }
    signals.add('Fremdmarkenvergleich');
    signals.add('Kia Alternative anbieten');
  }

  const recentText = (session.messages ?? []).slice(-4).map((m) => m.text).join(' ');
  if (ctx.lastQueryType === 'competitor_comparison') {
    if (/zeekr|byd/i.test(recentText)) {
      signals.add('Reichweite wichtig');
      signals.add('Elektro vs Plug-in-Hybrid');
    }
    if (/gle|mercedes/i.test(recentText)) {
      signals.add('GLE Vergleich');
      signals.add('Langstrecke / Anhänger prüfen');
      signals.add('Diesel vs Elektro');
    }
  }

  return [...signals];
}

/**
 * @param {object} session
 */
export function buildAdvisorConversationSummary(session) {
  const lines = (session.messages ?? [])
    .filter((m) => m.role === 'user')
    .slice(-6)
    .map((m) => m.text);

  if (!lines.length) return 'Kunde hat Beratung über Frag Clever gestartet.';

  const ctx = session.currentContext ?? {};
  const focus = ctx.modelsInFocus?.map((k) => k.toUpperCase()).join(', ');
  const compared = ctx.comparedModels?.length >= 2
    ? ` Vergleich: ${ctx.comparedModels.join(' vs ')}.`
    : '';

  return [
    `Beratungsverlauf (${lines.length} Fragen):`,
    lines.join(' → '),
    focus ? `Fokus-Modelle: ${focus}.` : null,
    compared || null,
    ctx.customerPriorities?.length
      ? `Prioritäten: ${ctx.customerPriorities.join(', ')}.`
      : null,
  ].filter(Boolean).join(' ');
}

/**
 * @param {object} session
 */
export function buildAdvisorKundenhelferChips(session) {
  return extractCustomerSignals(session).slice(0, 8);
}

/**
 * @param {object} session
 */
export function suggestAdvisorNextStep(session) {
  const ctx = session.currentContext ?? {};
  const recentText = (session.messages ?? []).slice(-4).map((m) => m.text).join(' ');

  if (/zeekr|byd/i.test(recentText)) {
    return 'Kia Alternative zu Zeekr/BYD prüfen';
  }
  if (/gle|mercedes/i.test(recentText) && /ev9|kia/i.test(recentText)) {
    return 'EV9 gegen GLE-Bedarf beraten';
  }
  if (ctx.comparedModels?.length >= 2) {
    const models = ctx.comparedModels.map((k) => k.toUpperCase()).join('/');
    return `Fahrprofil klären und ${models}-Vergleich anbieten`;
  }
  if (ctx.modelsInFocus?.includes('ev3') && ctx.usageProfile?.includes('Familie')) {
    return 'EV3 als Familienauto mit Isofix, Reichweite und AHK prüfen';
  }
  if (ctx.modelsInFocus?.includes('ev9') && ctx.usageProfile?.includes('Familie')) {
    return 'EV9-Familienvariante und Sitze klären';
  }
  if (ctx.adviceTopicIds?.includes('ev_towing_range')) {
    return 'Anhängerdaten klären und passende Modelle anbieten';
  }
  if (ctx.modelsInFocus?.length) {
    return `Mehr zu ${ctx.modelsInFocus[ctx.modelsInFocus.length - 1].toUpperCase()} beraten`;
  }
  return 'Beratungsfrage beantworten und nächsten Schritt anbieten';
}

/**
 * @param {object} session
 * @param {object} suggestion
 */
export function appendFollowUpClick(session, suggestion = {}) {
  return {
    ...session,
    followUpsClicked: [
      ...(session.followUpsClicked ?? []),
      {
        label: suggestion.label ?? '',
        query: suggestion.query ?? '',
        type: suggestion.type ?? null,
        target: suggestion.target ?? null,
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} message
 */
function formatLeadMessageText(message = {}) {
  if (message.role === 'assistant') {
    return [message.text, message.body].filter(Boolean).join(' — ');
  }
  return message.text ?? '';
}

/**
 * @param {object} session
 */
export function mapSessionMessagesForLead(session) {
  return (session?.messages ?? []).map((message) => ({
    role: message.role,
    text: formatLeadMessageText(message),
    queryType: message.queryType ?? null,
    topic: message.topic ?? null,
    modelKeys: message.modelKeys ?? [],
    createdAt: message.at ?? message.createdAt ?? null,
  }));
}

/**
 * @param {object} session
 */
export function buildAdvisorOpenQuestions(session) {
  const messages = session?.messages ?? [];
  const questions = [];
  let index = 0;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;

    const assistant = messages[i + 1]?.role === 'assistant' ? messages[i + 1] : null;
    const queryType = message.queryType ?? assistant?.queryType ?? null;
    const hasQuestionMark = /\?/.test(message.text ?? '');

    if (!hasQuestionMark && !OPEN_QUESTION_QUERY_TYPES.has(queryType)) continue;

    questions.push({
      id: `oq-${index}`,
      question: message.text,
      topic: message.topic ?? assistant?.topic ?? null,
      modelKeys: message.modelKeys?.length ? message.modelKeys : (assistant?.modelKeys ?? []),
      status: 'open',
    });
    index += 1;
  }

  return questions;
}

/**
 * @param {string[]} chips
 */
export function buildStructuredAdvisorSignals(chips = []) {
  return chips.map((label, i) => ({
    id: `sig-${i}`,
    label,
    type: 'inferred',
    confidence: 0.8,
  }));
}

/**
 * @param {object} session
 */
export function buildAdvisorConversationPayload(session = {}) {
  const chips = buildAdvisorKundenhelferChips(session);
  return {
    id: session.id,
    sourceMode: 'advisor_conversation',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: mapSessionMessagesForLead(session),
    summary: buildAdvisorConversationSummary(session),
    extractedSignals: buildStructuredAdvisorSignals(chips),
    openQuestions: buildAdvisorOpenQuestions(session),
    followUpsClicked: session.followUpsClicked ?? [],
  };
}
