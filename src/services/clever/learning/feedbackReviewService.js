/**
 * Feedback-Auswertung → Golden Conversation oder Datenfall.
 * Keine automatische Produktiv-Aktivierung.
 */
import { SELLER_FEEDBACK_CATEGORIES } from './sellerConversationFeedbackService.js';
import { buildKnowledgeGapRecord, KNOWLEDGE_GAP_STATUSES } from '../knowledge/knowledgeGapService.js';

export const GOLDEN_CANDIDATE_STATUSES = {
  NEW: 'new',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

const CONVERSATION_CATEGORIES = new Set([
  SELLER_FEEDBACK_CATEGORIES.UNNECESSARY_QUESTION,
  SELLER_FEEDBACK_CATEGORIES.MISSED_CUSTOMER_NEED,
  SELLER_FEEDBACK_CATEGORIES.UNNATURAL_SELLER_LANGUAGE,
  SELLER_FEEDBACK_CATEGORIES.OTHER,
]);

const DATA_CATEGORIES = new Set([
  SELLER_FEEDBACK_CATEGORIES.WRONG_VEHICLE_FACT,
]);

function goldenCandidateId() {
  return `gcand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} feedback
 */
export function classifySellerFeedback(feedback = {}) {
  if (DATA_CATEGORIES.has(feedback.category)) {
    return 'data_case';
  }
  if (CONVERSATION_CATEGORIES.has(feedback.category)) {
    return 'conversation_case';
  }
  if (feedback.category === SELLER_FEEDBACK_CATEGORIES.GOOD) {
    return 'positive';
  }
  return 'other';
}

/**
 * @param {object} feedback
 */
export function buildGoldenConversationCandidate(feedback = {}) {
  return {
    id: goldenCandidateId(),
    status: GOLDEN_CANDIDATE_STATUSES.NEW,
    createdAt: new Date().toISOString(),
    sourceFeedbackId: feedback.id,
    customerMessage: feedback.originalCustomerMessage,
    customerUnderstandingSnapshot: feedback.customerUnderstandingSnapshot,
    actualReply: feedback.originalCleverReply,
    actualNextAction: feedback.originalNextAction,
    desiredBehavior: feedback.sellerCorrection,
    category: feedback.category,
    forbiddenQuestion: feedback.category === SELLER_FEEDBACK_CATEGORIES.UNNECESSARY_QUESTION
      ? feedback.originalNextAction?.question ?? null
      : null,
    expectedNeedProfileFields: feedback.category === SELLER_FEEDBACK_CATEGORIES.MISSED_CUSTOMER_NEED
      ? extractNeedHints(feedback.sellerCorrection)
      : [],
  };
}

function extractNeedHints(text = '') {
  const hints = [];
  if (/elektro/i.test(text)) hints.push('fuel');
  if (/leasing/i.test(text)) hints.push('budget.paymentType');
  if (/7\s*sitz/i.test(text)) hints.push('persons');
  return hints;
}

/**
 * @param {object} feedback
 */
export function buildDataCaseFromFeedback(feedback = {}) {
  return buildKnowledgeGapRecord({
    status: KNOWLEDGE_GAP_STATUSES.NEW,
    requestedFact: 'seller_reported_inaccuracy',
    customerQuestionRedacted: feedback.originalCustomerMessage,
    internalDataStatus: 'seller_disputed',
    proposedEvidence: (feedback.evidenceIds ?? []).map((id) => ({ evidenceId: id })),
    resolution: feedback.sellerCorrection,
  });
}

/**
 * Verarbeitet angenommenes Feedback – erzeugt Review-Artefakte, ändert keinen Prompt.
 * @param {object} feedback
 */
export function processAcceptedSellerFeedback(feedback = {}) {
  const kind = classifySellerFeedback(feedback);
  if (kind === 'conversation_case') {
    return {
      kind,
      goldenCandidate: buildGoldenConversationCandidate(feedback),
      knowledgeGap: null,
      promptChanged: false,
    };
  }
  if (kind === 'data_case') {
    return {
      kind,
      goldenCandidate: null,
      knowledgeGap: buildDataCaseFromFeedback(feedback),
      promptChanged: false,
    };
  }
  return { kind, goldenCandidate: null, knowledgeGap: null, promptChanged: false };
}
