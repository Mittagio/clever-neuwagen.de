/**
 * Navigation aus Clever Eingang → Clever Nachrichten / Kundenakte
 */
import { INBOX_EVENT_TYPES, getInboxEventMeta } from './cleverInboxService.js';
import { buildKundenaktePath } from '../leadAkteEntry.js';

/**
 * @param {object} item
 */
export function resolveInboxReplyIntent(item = {}) {
  switch (item.type) {
    case INBOX_EVENT_TYPES.OFFER_QUESTION:
    case INBOX_EVENT_TYPES.CUSTOMER_QUESTION:
    case INBOX_EVENT_TYPES.SPECIAL_QUESTION:
    case INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST:
      return 'answer_customer_question';
    case INBOX_EVENT_TYPES.CUSTOMER_MESSAGE:
      if (item.metadata?.questionId) return 'answer_customer_question';
      return item.metadata?.suggestedIntent ?? 'free_reply';
    case INBOX_EVENT_TYPES.OFFER_OPENED:
      return 'offer_opened_followup';
    case INBOX_EVENT_TYPES.OFFER_INTERESTED:
      return 'offer_interested_followup';
    case INBOX_EVENT_TYPES.OFFER_DECLINED:
      return 'suggest_alternative';
    case INBOX_EVENT_TYPES.CONTACT_REQUESTED:
      return 'offer_callback';
    case INBOX_EVENT_TYPES.DOCUMENT_UPLOADED:
    case INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED:
      return 'documents_received_confirm';
    default:
      return null;
  }
}

function shouldOpenCleverAntworten(item = {}, { secondary = false } = {}) {
  const meta = getInboxEventMeta(item.type);
  if (secondary) {
    return meta.secondaryActionTarget === 'reply';
  }
  return item.actionTarget === 'reply'
    || item.actionTarget === 'followup'
    || meta.actionTarget === 'reply';
}

/**
 * Kundenakte-Link mit passendem Kontext (ohne Clever-Nachrichten-Sheet)
 * @param {string} leadId
 * @param {object} item
 */
export function buildInboxKundenakteUrl(leadId, item = {}) {
  if (!leadId) return buildKundenaktePath('');

  if (item.actionTarget === 'documents'
    || item.type === INBOX_EVENT_TYPES.DOCUMENT_UPLOADED
    || item.type === INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED) {
    const params = new URLSearchParams({ sheet: 'unterlagen' });
    if (item.id) params.set('inboxItemId', item.id);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  if (item.type === INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST) {
    const params = new URLSearchParams({ sheet: 'history' });
    if (item.id) params.set('inboxItemId', item.id);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  const questionId = item.metadata?.questionId ?? null;
  const offerId = item.offerId ?? item.metadata?.offerId ?? null;
  if (questionId && offerId && (
    item.type === INBOX_EVENT_TYPES.OFFER_QUESTION
    || item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
    || item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE
  )) {
    const params = new URLSearchParams({
      sheet: 'question_answer',
      offerId,
      questionId,
    });
    if (item.id) params.set('inboxItemId', item.id);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  if (offerId) {
    const params = new URLSearchParams({ offerId });
    if (item.id) params.set('inboxItemId', item.id);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  return buildKundenaktePath(leadId);
}

/**
 * @param {string} leadId
 * @param {object} item
 * @param {object} [options]
 */
export function buildInboxActionAkteUrl(leadId, item = {}, options = {}) {
  if (!leadId) return buildKundenaktePath('');

  const meta = getInboxEventMeta(item.type);
  const secondary = options.secondary === true;

  if (!secondary && item.actionTarget === 'documents') {
    const params = new URLSearchParams({ sheet: 'unterlagen' });
    if (item.id) params.set('inboxItemId', item.id);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  if (item.actionTarget === 'learning') {
    return buildKundenaktePath(leadId);
  }

  if (shouldOpenCleverAntworten(item, { secondary })) {
    const intentId = secondary
      ? (meta.secondaryIntentId ?? 'request_documents')
      : (resolveInboxReplyIntent(item) ?? 'answer_customer_question');
    const params = new URLSearchParams({
      sheet: 'antworten',
      intentId,
    });
    if (item.id) params.set('inboxItemId', item.id);
    const offerId = item.offerId ?? item.metadata?.offerId ?? null;
    if (offerId) params.set('offerId', offerId);
    const questionId = item.metadata?.questionId ?? null;
    if (questionId) params.set('questionId', questionId);
    const threadId = item.metadata?.threadId ?? null;
    if (threadId) params.set('threadId', threadId);
    const messageId = item.metadata?.messageId ?? null;
    if (messageId) params.set('messageId', messageId);
    return `${buildKundenaktePath(leadId)}?${params.toString()}`;
  }

  return buildKundenaktePath(leadId);
}

/**
 * @param {string} leadId
 * @param {object} item
 */
export function buildQuestionAnswerAkteUrl(leadId, item = {}) {
  return buildInboxActionAkteUrl(leadId, item);
}
