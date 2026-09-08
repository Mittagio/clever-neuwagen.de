/**
 * Clever 2.0 Response Policy – seller-facing Assistant Responses.
 * Reviews schützen geschäftliche Aktionen; sie ersetzen nicht das Gespräch.
 *
 * @see docs/CLEVER_2_0_ASSISTANT_GAP_AUDIT.md
 */

import {
  presentCompactConfirmation,
  sanitizeIntakeDisplayChips,
} from '../cleverSeller/presentSellerIntakeFeedback.js';

export const CLEVER_RESPONSE_KIND = Object.freeze({
  DIRECT_ANSWER: 'direct_answer',
  COMPACT_CONFIRMATION: 'compact_confirmation',
  CLARIFICATION: 'clarification',
  PREPARED_ACTION_REVIEW: 'prepared_action_review',
});

/**
 * @param {object} turn – runCleverSellerTurn result
 * @returns {{
 *   kind: string,
 *   message: string,
 *   chips: string[],
 *   undoAvailable: boolean,
 *   showReview: boolean,
 *   clarificationOptions: object[],
 * }}
 */
export function resolveSellerResponsePolicy(turn = {}) {
  const rememberMode = turn.rememberDecision?.mode;
  const assistantReply = String(turn.assistantReply || '').trim();
  const facts = turn.extractedFacts || [];
  const prepared = turn.preparedActions || [];
  const missing = turn.missingInformation || [];

  // Prepared business actions → Review
  if (
    turn.inboundLead?.detected
    || turn.customerReply?.detected
    || turn.multiSourceIntake?.detected
    || turn.homepageInquiry?.hasDualScenarios
    || turn.contractDraft
    || turn.contractOfferCompareResult
    || prepared.some((a) => (
      a.type === 'prepare_offer'
      || a.type === 'propose_appointment'
      || a.type === 'import_customer_contract'
      || a.type === 'compare_contract_with_offer'
      || (a.type === 'request_documents' && a.status === 'prepared')
      || (a.type === 'draft_message' && a.status === 'prepared' && a.payload?.intendSend)
    ))
  ) {
    return {
      kind: CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW,
      message: assistantReply || turn.reviewModel?.summaryLine || 'Bitte prüfen und freigeben.',
      chips: [],
      undoAvailable: false,
      showReview: true,
      clarificationOptions: [],
    };
  }

  // Blockierende Klärung
  const clarify = missing.find((m) => (
    m.id === 'clarify_vehicle_for_knowledge'
    || m.id === 'clarify_vehicle_for_offer'
    || m.id === 'clarify_offer_or_message'
    || m.id === 'clarify_customer_for_appointment'
    || m.id === 'clarify_customer_for_contract'
    || m.id === 'exact_technology_package_contents'
  ));
  const ambiguityQuestion = turn.knowledgeResult?.vehicleAmbiguity?.question
    || clarify?.label
    || null;
  if (ambiguityQuestion) {
    return {
      kind: CLEVER_RESPONSE_KIND.CLARIFICATION,
      message: ambiguityQuestion,
      chips: [],
      undoAvailable: false,
      showReview: false,
      clarificationOptions: clarify?.choices
        || turn.knowledgeResult?.vehicleAmbiguity?.candidates
        || [],
    };
  }

  // Compact confirmation – Zero-Loss / Merken auto-save
  if (
    rememberMode === 'save_with_undo'
    || rememberMode === 'partial_save_with_undo'
  ) {
    const presented = presentCompactConfirmation(turn);
    const next = turn.captureNextStep || turn.uiEffects?.captureNextStep || null;
    return {
      kind: CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION,
      message: presented.message,
      chips: presented.chips,
      undoAvailable: true,
      showReview: rememberMode === 'partial_save_with_undo'
        && (turn.rememberDecision?.reviewFacts || []).length > 0,
      clarificationOptions: [],
      nextStep: next,
      showGlobalWarning: presented.showGlobalWarning,
    };
  }

  // Direct answers – knowledge / search / today / summarize
  if (
    turn.todayOverview
    || turn.knowledgeResult
    || turn.customerSummary
    || turn.historySearchResults?.length
    || turn.customerSearchResults?.length
    || turn.searchResults?.length
    || prepared.some((a) => (
      a.type === 'get_today_overview'
      || a.type === 'lookup_vehicle_fact'
      || a.type === 'search_customer_history'
      || a.type === 'search_customer_messages'
      || a.type === 'search_customer_offers'
      || a.type === 'search_customer_activities'
      || a.type === 'find_customer'
      || a.type === 'open_customer'
      || a.type === 'summarize_customer_context'
      || a.type === 'customer_lookup'
      || a.type === 'recommend_next_step'
    ))
  ) {
    const direct = buildDirectAnswerMessage(turn);
    return {
      kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      message: direct || assistantReply || 'Fertig.',
      chips: [],
      undoAvailable: false,
      showReview: false,
      clarificationOptions: [],
    };
  }

  // Prepared message draft (ohne Send) → compact, kein Full-Review
  const draft = String(
    turn.messageDraft
    || prepared.find((a) => a.type === 'draft_message')?.payload?.messageDraft
    || '',
  ).trim();
  if (draft && !turn.currentOfferContext?.offerId) {
    return {
      kind: CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION,
      message: assistantReply || 'Nachricht vorbereitet – im Composer prüfen.',
      chips: [],
      undoAvailable: false,
      showReview: false,
      clarificationOptions: [],
    };
  }

  // Offer + message / multi → review
  if (prepared.some((a) => a.type === 'prepare_offer') || draft) {
    return {
      kind: CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW,
      message: assistantReply || 'Bitte prüfen.',
      chips: [],
      undoAvailable: false,
      showReview: true,
      clarificationOptions: [],
    };
  }

  if (assistantReply || facts.length) {
    return {
      kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      message: assistantReply
        || (sanitizeIntakeDisplayChips(facts).slice(0, 6).join(' · ') || 'Verstanden.'),
      chips: sanitizeIntakeDisplayChips(facts).slice(0, 8),
      undoAvailable: false,
      showReview: false,
      clarificationOptions: [],
    };
  }

  return {
    kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
    message: 'Wie kann ich helfen?',
    chips: [],
    undoAvailable: false,
    showReview: false,
    clarificationOptions: [],
  };
}

const AGENT_REVIEW_TOOLS = new Set([
  'prepare_offer',
  'create_offer',
  'modify_offer',
  'import_offer_pdf',
  'propose_appointment',
  'modify_appointment',
  'create_follow_up',
  'import_contract',
  'prepare_trade_in',
  'intend_send',
  'create_customer_link',
]);

const AGENT_COMPACT_TOOLS = new Set([
  'remember_customer_information',
  'update_customer_facts',
  'create_message',
  'rewrite_message',
]);

/**
 * Agent-Ergebnis → Response Policy.
 * @param {object} agentResult
 */
export function resolveAgentResponsePolicy(agentResult = {}) {
  if (agentResult.confirmationRequired || agentResult.pendingAction?.status === 'needs_confirmation') {
    return {
      kind: CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW,
      message: String(agentResult.message || 'Bitte prüfen und freigeben.').trim(),
      chips: [],
      undoAvailable: false,
      showReview: true,
      clarificationOptions: [],
    };
  }

  const toolNames = (agentResult.toolCalls || []).map((t) => t.name).filter(Boolean);
  const usedReviewTool = toolNames.some((n) => AGENT_REVIEW_TOOLS.has(n));
  if (usedReviewTool && agentResult.pendingAction) {
    return {
      kind: CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW,
      message: String(agentResult.message || 'Bitte prüfen und freigeben.').trim(),
      chips: [],
      undoAvailable: false,
      showReview: true,
      clarificationOptions: [],
    };
  }

  const remember = toolNames.some((n) => (
    n === 'remember_customer_information' || n === 'update_customer_facts'
  ));
  const labels = agentResult.artifacts?.find((a) => a.type === 'remember')?.data?.labels
    || agentResult.artifacts?.find((a) => a.type === 'update_customer_facts')?.data?.labels
    || agentResult.labels
    || [];
  if (remember || toolNames.some((n) => AGENT_COMPACT_TOOLS.has(n))) {
    return {
      kind: CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION,
      message: String(agentResult.message || (labels.length
        ? `Gemerkt: ${labels.join(' · ')}`
        : 'Erledigt.')).trim(),
      chips: labels.slice(0, 10),
      undoAvailable: remember,
      showReview: false,
      clarificationOptions: [],
    };
  }

  return {
    kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
    message: String(agentResult.message || '').trim() || 'Erledigt.',
    chips: [],
    undoAvailable: false,
    showReview: false,
    clarificationOptions: [],
  };
}

function buildDirectAnswerMessage(turn = {}) {
  if (turn.knowledgeResult?.answerText || turn.knowledgeResult?.text) {
    return String(turn.knowledgeResult.answerText || turn.knowledgeResult.text).trim();
  }
  if (turn.knowledgeResult?.title || turn.knowledgeResult?.lead) {
    return [turn.knowledgeResult.title, turn.knowledgeResult.lead].filter(Boolean).join(' – ');
  }
  if (turn.customerSummary?.text) return String(turn.customerSummary.text).trim();
  if (turn.todayOverview?.summaryLine || turn.todayOverview?.headline) {
    return String(turn.todayOverview.summaryLine || turn.todayOverview.headline).trim();
  }
  const hits = turn.historySearchResults || turn.searchResults || [];
  if (hits.length) {
    const first = hits[0];
    const body = first.body || first.headline || first.summary || first.label;
    return body
      ? `Gefunden: ${String(body).slice(0, 280)}`
      : `${hits.length} Treffer im Verlauf.`;
  }
  if (turn.customerSearchResults?.length) {
    const names = turn.customerSearchResults
      .map((c) => c.name || c.displayName)
      .filter(Boolean)
      .slice(0, 3);
    return names.length
      ? `Kunden: ${names.join(' · ')}`
      : `${turn.customerSearchResults.length} Kunden gefunden.`;
  }
  return String(turn.assistantReply || '').trim();
}
