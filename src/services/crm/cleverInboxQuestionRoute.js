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
