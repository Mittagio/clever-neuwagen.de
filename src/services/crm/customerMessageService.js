/**
 * Clever Nachrichten – gemeinsame Nachrichten-Schicht (Stufe 1).
 * Speicher: lead.crm.customerMessageThreads + lead.crm.customerMessages
 */
import { createInboxItem, INBOX_EVENT_TYPES } from './cleverInboxService.js';
import { isSelfDisclosureSensitiveText } from './customerPortalSelfDisclosureService.js';

export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
};

export const MESSAGE_CHANNEL = {
  CLEVER: 'clever',
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
};

export const MESSAGE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  RECEIVED: 'received',
  READ: 'read',
  OPENED_EXTERNAL: 'opened_external',
};

export const THREAD_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
};

const FORBIDDEN_CUSTOMER_TEXT_PATTERNS = [
  /\beinkommen\b/i,
  /\bbonit/i,
  /\barbeitgeber\b/i,
  /\bgehaltsnachweis\b/i,
  /\bgehalt\b/i,
  /\bverdienst\b/i,
  /\binterne?\s+notiz/i,
  /\bselbstauskunft\b/i,
  /\bschufa\b/i,
];

function uid(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {object} lead
 */
export function getCustomerMessageStore(lead = {}) {
  const crm = lead.crm ?? {};
  return {
    threads: Array.isArray(crm.customerMessageThreads) ? crm.customerMessageThreads : [],
    messages: Array.isArray(crm.customerMessages) ? crm.customerMessages : [],
  };
}

/**
 * @param {object} lead
 * @param {{ threads?: object[], messages?: object[] }} patch
 */
export function mergeCustomerMessageStore(lead = {}, patch = {}) {
  const prev = getCustomerMessageStore(lead);
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerMessageThreads: patch.threads ?? prev.threads,
      customerMessages: patch.messages ?? prev.messages,
    },
  };
}

/**
 * @param {string} text
 */
export function sanitizeCustomerVisibleText(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  if (isSelfDisclosureSensitiveText(raw)) return '';
  if (FORBIDDEN_CUSTOMER_TEXT_PATTERNS.some((pattern) => pattern.test(raw))) {
    return '';
  }
  return raw;
}

/**
 * @param {object} message
 */
export function buildMessagePreview(message = {}) {
  const text = String(message.text ?? '').trim();
  if (!text) return '';
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * @param {object} params
 */
export function createMessageThread({
  lead,
  title = 'Kundenkommunikation',
  participants = [],
  relatedOfferIds = [],
  relatedDocumentIds = [],
} = {}) {
  if (!lead?.id) return { lead, thread: null };

  const store = getCustomerMessageStore(lead);
  const now = nowIso();
  const thread = {
    id: uid('thread'),
    customerId: lead.id,
    leadId: lead.id,
    title: String(title).trim() || 'Kundenkommunikation',
    status: THREAD_STATUS.OPEN,
    participants: participants.length
      ? participants
      : [
        { type: 'customer', id: lead.id, name: lead.contact?.name ?? 'Kunde' },
      ],
    relatedOfferIds: [...new Set(relatedOfferIds.filter(Boolean))],
    relatedDocumentIds: [...new Set(relatedDocumentIds.filter(Boolean))],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
  };

  const nextLead = mergeCustomerMessageStore(lead, {
    threads: [...store.threads, thread],
    messages: store.messages,
  });

  return { lead: nextLead, thread };
}

/**
 * @param {object} params
 */
export function addCustomerMessage({
  lead,
  threadId = null,
  direction,
  channel,
  status,
  text = '',
  subject = null,
  attachments = [],
  relatedOfferId = null,
  relatedQuestionId = null,
  relatedDocumentIds = [],
  visibleToCustomer = false,
  createdByUserId = null,
  createdByName = null,
} = {}) {
  if (!lead?.id) return { lead, message: null, thread: null };

  let workingLead = lead;
  let thread = getCustomerMessageStore(lead).threads.find((entry) => entry.id === threadId) ?? null;

  if (!thread) {
    const created = createMessageThread({
      lead: workingLead,
      title: relatedOfferId ? 'Angebotsnachricht' : 'Kundenkommunikation',
      relatedOfferIds: relatedOfferId ? [relatedOfferId] : [],
    });
    workingLead = created.lead;
    thread = created.thread;
  }

  const safeText = visibleToCustomer
    ? sanitizeCustomerVisibleText(text)
    : String(text ?? '').trim();

  if (visibleToCustomer && !safeText) {
    return { lead: workingLead, message: null, thread, error: 'sensitive_or_empty' };
  }

  const store = getCustomerMessageStore(workingLead);
  const now = nowIso();
  const message = {
    id: uid('cmsg'),
    threadId: thread.id,
    customerId: lead.id,
    leadId: lead.id,
    direction,
    channel,
    status,
    text: safeText || String(text ?? '').trim(),
    subject: subject ?? null,
    attachments: Array.isArray(attachments) ? attachments : [],
    relatedOfferId: relatedOfferId ?? null,
    relatedQuestionId: relatedQuestionId ?? null,
    relatedDocumentIds: Array.isArray(relatedDocumentIds) ? relatedDocumentIds : [],
    visibleToCustomer: Boolean(visibleToCustomer),
    createdAt: now,
    createdByUserId: createdByUserId ?? null,
    createdByName: createdByName ?? null,
  };

  const threads = store.threads.map((entry) => (
    entry.id === thread.id
      ? {
        ...entry,
        updatedAt: now,
        lastMessageAt: now,
        status: entry.status === THREAD_STATUS.ARCHIVED ? THREAD_STATUS.OPEN : entry.status,
        relatedOfferIds: relatedOfferId
          ? [...new Set([...(entry.relatedOfferIds ?? []), relatedOfferId])]
          : entry.relatedOfferIds,
      }
      : entry
  ));

  const nextLead = mergeCustomerMessageStore(workingLead, {
    threads,
    messages: [...store.messages, message],
  });

  return {
    lead: nextLead,
    message,
    thread: threads.find((entry) => entry.id === thread.id) ?? thread,
  };
}

/**
 * @param {object} lead
 */
export function listMessagesForLead(lead = {}) {
  return [...getCustomerMessageStore(lead).messages].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

/**
 * @param {object} lead
 * @param {string} threadId
 */
export function listMessagesForThread(lead = {}, threadId = '') {
  return listMessagesForLead(lead)
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * @param {object} lead
 * @param {object} [context]
 */
export function findOrCreateThreadForLead(lead = {}, context = {}) {
  const store = getCustomerMessageStore(lead);
  const offerId = context.relatedOfferId ?? context.offerId ?? null;

  let thread = null;
  if (offerId) {
    thread = store.threads.find((entry) => {
      if (entry.status === THREAD_STATUS.ARCHIVED) return false;
      return (entry.relatedOfferIds ?? []).includes(offerId);
    }) ?? null;
  } else {
    thread = store.threads.find((entry) => {
      if (entry.status === THREAD_STATUS.ARCHIVED) return false;
      return !(entry.relatedOfferIds ?? []).length;
    }) ?? null;
  }

  if (thread) {
    return { lead, thread };
  }

  return createMessageThread({
    lead,
    title: context.title ?? (offerId ? 'Angebotsnachricht' : 'Allgemeine Fragen'),
    relatedOfferIds: offerId ? [offerId] : [],
  });
}

/**
 * @param {object} lead
 */
export function listVisibleCustomerMessages(lead = {}) {
  return listMessagesForLead(lead).filter((message) => message.visibleToCustomer);
}

/**
 * @param {object} params
 */
export function mirrorInboundCustomerQuestion({
  lead,
  text,
  relatedOfferId = null,
  relatedQuestionId = null,
  customerName = '',
  vehicleLabel = null,
  source = 'customer_portal',
} = {}) {
  const trimmed = String(text ?? '').trim();
  if (!lead?.id || !trimmed) {
    return { lead, message: null, thread: null, inboxItem: null };
  }

  const { lead: withThread, thread } = findOrCreateThreadForLead(lead, {
    relatedOfferId,
    title: relatedOfferId ? 'Kundenfrage' : 'Allgemeine Fragen',
  });

  const added = addCustomerMessage({
    lead: withThread,
    threadId: thread.id,
    direction: MESSAGE_DIRECTION.INBOUND,
    channel: MESSAGE_CHANNEL.CLEVER,
    status: MESSAGE_STATUS.RECEIVED,
    text: trimmed,
    relatedOfferId,
    relatedQuestionId,
    visibleToCustomer: true,
    createdByUserId: lead.id,
    createdByName: customerName || lead.contact?.name || 'Kunde',
  });

  const nextLead = added.lead;
  const inboxItem = buildInboxItemFromCustomerMessage({
    lead: nextLead,
    message: added.message,
    thread: added.thread,
    vehicleLabel,
    source,
  });

  return {
    lead: nextLead,
    message: added.message,
    thread: added.thread,
    inboxItem,
  };
}

/**
 * @param {object} params
 */
export function sendCleverChannelMessage({
  lead,
  text,
  threadId = null,
  relatedOfferId = null,
  relatedQuestionId = null,
  createdByUserId = null,
  createdByName = null,
} = {}) {
  const trimmed = String(text ?? '').trim();
  if (!lead?.id || !trimmed) {
    return { lead, message: null, historyEntry: null };
  }

  const { lead: withThread, thread: foundThread } = threadId
    ? {
      lead,
      thread: getCustomerMessageStore(lead).threads.find((entry) => entry.id === threadId) ?? null,
    }
    : { lead, thread: null };

  const { lead: threadLead, thread } = foundThread
    ? { lead: withThread, thread: foundThread }
    : findOrCreateThreadForLead(withThread, { relatedOfferId });

  const added = addCustomerMessage({
    lead: threadLead,
    threadId: thread?.id ?? threadId,
    direction: MESSAGE_DIRECTION.OUTBOUND,
    channel: MESSAGE_CHANNEL.CLEVER,
    status: MESSAGE_STATUS.SENT,
    text: trimmed,
    relatedOfferId,
    relatedQuestionId,
    visibleToCustomer: true,
    createdByUserId,
    createdByName,
  });

  if (!added.message) {
    return { lead: added.lead, message: null, historyEntry: null, error: added.error };
  }

  const preview = buildMessagePreview(added.message);
  const historyEntry = {
    id: `hist-${uid('cm')}`,
    at: added.message.createdAt,
    type: 'customer_message',
    text: `Clever Nachricht gesendet: „${preview}“`,
    channel: MESSAGE_CHANNEL.CLEVER,
    direction: MESSAGE_DIRECTION.OUTBOUND,
    customerFacing: true,
    meta: {
      customerMessageId: added.message.id,
      threadId: added.message.threadId,
      channel: MESSAGE_CHANNEL.CLEVER,
    },
  };

  const nextLead = {
    ...added.lead,
    history: [...(added.lead.history ?? []), historyEntry],
  };

  return {
    lead: nextLead,
    message: added.message,
    thread: added.thread,
    historyEntry,
  };
}

/**
 * @param {object} params
 */
export function buildInboxItemFromCustomerMessage({
  lead,
  message,
  thread,
  vehicleLabel = null,
  source = 'customer_portal',
}) {
  if (!lead?.id || !message?.id) return null;

  const offerId = message.relatedOfferId ?? null;
  const questionId = message.relatedQuestionId ?? null;
  const hasOfferContext = Boolean(offerId);

  return createInboxItem({
    type: INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
    title: hasOfferContext ? 'Neue Nachricht zum Angebot' : 'Neue Nachricht vom Kunden',
    message: buildMessagePreview(message),
    customerId: lead.id,
    customerName: lead.contact?.name ?? '',
    leadId: lead.id,
    offerId,
    vehicleLabel: vehicleLabel ?? null,
    sourceArea: 'customer_link',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    metadata: {
      dedupeKey: `customer-message:${message.id}`,
      threadId: thread?.id ?? message.threadId,
      messageId: message.id,
      offerId,
      questionId,
      relatedOfferTitle: vehicleLabel ?? null,
      source,
      suggestedIntent: questionId
        ? 'answer_customer_question'
        : 'free_reply',
    },
  });
}

/**
 * @param {object} lead
 */
export function buildCustomerMessageHistoryEntries(lead = {}) {
  return listMessagesForLead(lead).map((message) => {
    const preview = buildMessagePreview(message);
    const inbound = message.direction === MESSAGE_DIRECTION.INBOUND;
    return {
      id: `hist-msg-${message.id}`,
      at: message.createdAt,
      type: 'customer_message',
      channel: message.channel,
      direction: message.direction,
      customerFacing: message.visibleToCustomer,
      text: inbound
        ? `Nachricht vom Kunden: „${preview}“`
        : `Clever Nachricht gesendet: „${preview}“`,
      meta: {
        customerMessageId: message.id,
        threadId: message.threadId,
        channel: message.channel,
        status: message.status,
        isCustomerMessage: true,
      },
    };
  });
}

function formatPortalTime(iso = '') {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * @param {object} message
 */
export function formatPortalMessageText(message = {}) {
  if (!message.visibleToCustomer) return null;
  const text = String(message.text ?? '').trim();
  if (!text) return null;
  const safe = sanitizeCustomerVisibleText(text);
  return safe || null;
}

/**
 * @param {object} thread
 * @param {object[]} messages
 * @param {object[]} [portfolioItems]
 */
export function resolvePortalThreadTitle(thread = null, messages = [], portfolioItems = []) {
  const customTitle = thread?.title?.trim();
  if (customTitle && !['Kundenkommunikation', 'Kundenfrage', 'Angebotsnachricht'].includes(customTitle)) {
    return customTitle;
  }

  const offerId = messages.find((entry) => entry.relatedOfferId)?.relatedOfferId
    ?? thread?.relatedOfferIds?.[0]
    ?? null;

  if (offerId) {
    const item = portfolioItems.find(
      (entry) => entry.vehicleCardId === offerId
        || entry.id === offerId
        || entry.variantId === offerId,
    );
    if (item?.modelLabel) {
      return item.trimLabel
        ? `${item.modelLabel} · ${item.trimLabel}`
        : `${item.modelLabel} Auswahl`;
    }
    return 'Nachrichten zum Angebot';
  }

  return 'Allgemeine Fragen';
}

/**
 * Kundenportal – sichtbare Nachrichten nach Thread gruppiert.
 * @param {object} lead
 * @param {object} [options]
 */
export function buildCustomerPortalMessageThreads(lead = {}, options = {}) {
  const portfolioItems = options.portfolioItems
    ?? lead?.crm?.customerOfferPortfolio?.items
    ?? [];
  const store = getCustomerMessageStore(lead);
  const visibleByThread = new Map();

  for (const message of store.messages) {
    const text = formatPortalMessageText(message);
    if (!text) continue;
    const bucket = visibleByThread.get(message.threadId) ?? [];
    bucket.push({ message, text });
    visibleByThread.set(message.threadId, bucket);
  }

  const threads = [];
  for (const [threadId, entries] of visibleByThread) {
    const threadMeta = store.threads.find((entry) => entry.id === threadId) ?? null;
    const sorted = [...entries].sort(
      (a, b) => new Date(a.message.createdAt) - new Date(b.message.createdAt),
    );
    const rawMessages = sorted.map((entry) => entry.message);

    threads.push({
      id: threadId,
      title: resolvePortalThreadTitle(threadMeta, rawMessages, portfolioItems),
      messages: sorted.map(({ message, text }) => ({
        id: message.id,
        senderLabel: message.direction === MESSAGE_DIRECTION.INBOUND ? 'Sie' : 'Autohaus',
        isCustomer: message.direction === MESSAGE_DIRECTION.INBOUND,
        text,
        createdAt: message.createdAt,
        timeLabel: formatPortalTime(message.createdAt),
      })),
      lastMessageAt: sorted[sorted.length - 1]?.message.createdAt ?? null,
    });
  }

  return threads.sort(
    (a, b) => new Date(a.lastMessageAt ?? 0) - new Date(b.lastMessageAt ?? 0),
  );
}

/**
 * Kunde schreibt im Portal (allgemeine Nachricht, ohne Angebotsbezug).
 * @param {object} params
 */
export function sendCustomerPortalInboundMessage({
  lead,
  text,
  customerName = '',
} = {}) {
  return mirrorInboundCustomerQuestion({
    lead,
    text,
    relatedOfferId: null,
    relatedQuestionId: null,
    customerName,
  });
}
