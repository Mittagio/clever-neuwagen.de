/**
 * Clever Eingang – Frag-Clever-Kontaktanfragen
 */
import {
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_PRIORITY,
  INBOX_SOURCE_AREA,
  INBOX_STATUS,
  listInboxItems,
} from '../crm/cleverInboxService.js';

const ADVISOR_INBOX_TITLE = 'Neue Frage aus Frag Clever';
const ADVISOR_INBOX_FALLBACK = 'Kunde hat über Frag Clever eine Frage gestellt.';

function normalizeTopicLabel(label = '') {
  return String(label)
    .replace(/^Kia\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {object} lead
 */
export function buildAdvisorInboxTopics(lead = {}) {
  const signalLabels = (lead.advisorConversation?.extractedSignals ?? [])
    .map((signal) => normalizeTopicLabel(signal?.label ?? signal))
    .filter(Boolean);

  if (signalLabels.length) {
    return [...new Set(signalLabels)].slice(0, 6);
  }

  const chips = lead.crm?.kundenhelfer?.chips
    ?? lead.customerWish?.priorities
    ?? [];
  if (chips.length) {
    return [...new Set(chips.map(normalizeTopicLabel))].slice(0, 6);
  }

  return [];
}

/**
 * @param {object} lead
 */
export function buildAdvisorQuestionText(lead = {}) {
  const openQuestions = lead.advisorConversation?.openQuestions ?? [];
  const questionTexts = openQuestions
    .map((entry) => entry?.question?.trim())
    .filter(Boolean);

  if (questionTexts.length) {
    return questionTexts.join(' und ');
  }

  const userMessages = (lead.advisorConversation?.messages ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => message.text?.trim())
    .filter(Boolean);

  if (userMessages.length) {
    const withQuestionMark = userMessages.filter((text) => /\?/.test(text));
    const selected = withQuestionMark.length ? withQuestionMark : userMessages.slice(-2);
    return selected.join(' ');
  }

  const fallback = lead.customerQuestion
    ?? lead.specialCustomerQuestion?.rawText
    ?? lead.advisorConversation?.summary
    ?? lead.advisorConversationSummary
    ?? '';
  return String(fallback).trim();
}

/**
 * @param {object} lead
 */
export function buildAdvisorInboxMessage(lead = {}) {
  const questionText = buildAdvisorQuestionText(lead);
  if (questionText) {
    const trimmed = questionText.length > 220 ? `${questionText.slice(0, 217)}…` : questionText;
    return `„${trimmed}"`;
  }
  return ADVISOR_INBOX_FALLBACK;
}

/**
 * @param {string} leadId
 */
export function hasAdvisorContactInboxItem(leadId) {
  if (!leadId) return false;
  return listInboxItems({
    leadId,
    type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
    status: 'open',
  }).length > 0;
}

/**
 * @param {object} lead
 */
export function createAdvisorContactInboxItem(lead = {}) {
  if (!lead?.id) return null;
  if (!lead.advisorConversation && lead.source !== 'advisorConversation') {
    return null;
  }

  const dedupeKey = `advisor_contact:${lead.id}`;
  const existing = listInboxItems({
    leadId: lead.id,
    type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
    status: 'open',
  }).find((item) => item.metadata?.dedupeKey === dedupeKey);
  if (existing) return existing;

  const topics = buildAdvisorInboxTopics(lead);
  const questionText = buildAdvisorQuestionText(lead);

  return createInboxItem({
    type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
    title: ADVISOR_INBOX_TITLE,
    message: buildAdvisorInboxMessage(lead),
    customerId: lead.id,
    customerName: lead.contact?.name ?? '',
    leadId: lead.id,
    vehicleLabel: lead.vehicle?.label ?? null,
    sourceArea: INBOX_SOURCE_AREA.CUSTOMER_ADVISOR,
    priority: INBOX_PRIORITY.HIGH,
    status: INBOX_STATUS.OPEN,
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    metadata: {
      dedupeKey,
      topics,
      questionText,
      advisorConversationId: lead.advisorConversation?.id ?? lead.advisorSessionId ?? null,
      sourceMode: lead.sourceMode ?? lead.crm?.sourceMode ?? 'advisor_conversation',
      extractedSignals: lead.advisorConversation?.extractedSignals ?? [],
      openQuestions: lead.advisorConversation?.openQuestions ?? [],
    },
  });
}
