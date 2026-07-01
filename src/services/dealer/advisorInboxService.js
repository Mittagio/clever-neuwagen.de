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

const ADVISOR_INBOX_TITLE = 'Kunde möchte Beratung aus Frag Clever';
const ADVISOR_INBOX_FALLBACK = 'Kunde hat über Frag Clever Beratung angefragt.';

/**
 * @param {object} lead
 */
export function buildAdvisorInboxMessage(lead = {}) {
  const signalLabels = (lead.advisorConversation?.extractedSignals ?? [])
    .map((signal) => signal?.label ?? signal)
    .filter(Boolean);

  if (signalLabels.length) {
    const topics = [...new Set(signalLabels)].slice(0, 6);
    return `Themen: ${topics.join(', ')}.`;
  }

  const chips = lead.crm?.kundenhelfer?.chips
    ?? lead.customerWish?.priorities
    ?? [];
  if (chips.length) {
    const topics = [...new Set(chips)].slice(0, 6);
    return `Themen: ${topics.join(', ')}.`;
  }

  const summary = lead.advisorConversation?.summary
    ?? lead.advisorConversationSummary
    ?? '';
  if (summary.trim()) {
    const trimmed = summary.trim();
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
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

  return createInboxItem({
    type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
    title: ADVISOR_INBOX_TITLE,
    message: buildAdvisorInboxMessage(lead),
    customerId: lead.id,
    customerName: lead.contact?.name ?? '',
    leadId: lead.id,
    vehicleLabel: lead.vehicle?.label ?? null,
    sourceArea: INBOX_SOURCE_AREA.CUSTOMER_ADVISOR,
    priority: INBOX_PRIORITY.NORMAL,
    status: INBOX_STATUS.OPEN,
    actionLabel: 'Kundenakte öffnen',
    actionTarget: 'lead',
    metadata: {
      dedupeKey,
      advisorConversationId: lead.advisorConversation?.id ?? lead.advisorSessionId ?? null,
      sourceMode: lead.sourceMode ?? lead.crm?.sourceMode ?? 'advisor_conversation',
      extractedSignals: lead.advisorConversation?.extractedSignals ?? [],
      openQuestions: lead.advisorConversation?.openQuestions ?? [],
    },
  });
}
