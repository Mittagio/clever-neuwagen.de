/**
 * Navigation aus Clever Eingang → Kundenfrage beantworten
 */
import { INBOX_EVENT_TYPES } from './cleverInboxService.js';
import { buildKundenaktePath } from '../leadAkteEntry.js';

const QUESTION_INBOX_TYPES = new Set([
  INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
  INBOX_EVENT_TYPES.OFFER_QUESTION,
]);

/**
 * @param {string} leadId
 * @param {object} item
 */
export function buildQuestionAnswerAkteUrl(leadId, item = {}) {
  if (!leadId) return buildKundenaktePath('');

  const questionId = item.metadata?.questionId ?? null;
  const offerId = item.offerId ?? item.metadata?.offerId ?? null;
  const isQuestionItem = QUESTION_INBOX_TYPES.has(item.type);

  if (!isQuestionItem || !questionId) {
    return `${buildKundenaktePath(leadId)}?sheet=antworten`;
  }

  const params = new URLSearchParams({
    sheet: 'question_answer',
    offerId: offerId ?? '',
    questionId,
    inboxItemId: item.id ?? '',
  });

  return `${buildKundenaktePath(leadId)}?${params.toString()}`;
}
