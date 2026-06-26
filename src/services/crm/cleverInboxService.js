/**
 * Clever Eingang – zentraler Verkäufer-Eingang für Kundenreaktionen.
 */
import { INTEREST_STATUS } from '../customerOfferInteraction.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const STORAGE_KEY = 'clever-neuwagen-inbox';

export const INBOX_EVENT_TYPES = {
  CUSTOMER_QUESTION: 'customer_question',
  CONTACT_REQUESTED: 'contact_requested',
  OFFER_OPENED: 'offer_opened',
  OFFER_INTERESTED: 'offer_interested',
  OFFER_DECLINED: 'offer_declined',
  OFFER_QUESTION: 'offer_question',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_LINK_COMPLETED: 'document_link_completed',
  SPECIAL_QUESTION: 'special_question',
  LEARNING_REQUEST_CREATED: 'learning_request_created',
};

export const INBOX_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  IGNORED: 'ignored',
};

export const INBOX_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
};

export const INBOX_SOURCE_AREA = {
  CUSTOMER_LINK: 'customer_link',
  OFFER_LINK: 'offer_link',
  CUSTOMER_ADVISOR: 'customer_advisor',
  DOCUMENTS: 'documents',
  LEXICON: 'lexicon',
  SYSTEM: 'system',
};

/** Keine System-/Intern-Logs in den Clever Eingang */
export const INBOX_EXCLUDED_HISTORY_TYPES = new Set([
  'clever_action',
  'system',
  'note',
  'followup',
  'offer_pdf',
  'offer_link',
  'offer_sent',
  'offer_sent_email',
  'offer_sent_whatsapp',
]);

const EXCLUDED_HISTORY_PATTERNS = [
  /^Clever empf/i,
  /^Clever-Empfehlung/i,
  /^Clever Kundenhelfer/i,
  /^Status intern/i,
  /^Nachfassen geplant/i,
];

const EVENT_META = {
  [INBOX_EVENT_TYPES.CUSTOMER_QUESTION]: {
    badge: 'Frage',
    icon: '💬',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
  },
  [INBOX_EVENT_TYPES.OFFER_QUESTION]: {
    badge: 'Frage',
    icon: '💬',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
  },
  [INBOX_EVENT_TYPES.CONTACT_REQUESTED]: {
    badge: 'Kontakt',
    icon: '📞',
    actionLabel: 'Kunden kontaktieren',
    actionTarget: 'call',
    priority: INBOX_PRIORITY.HIGH,
  },
  [INBOX_EVENT_TYPES.OFFER_INTERESTED]: {
    badge: 'Interesse',
    icon: '★',
    actionLabel: 'Kundenakte öffnen',
    actionTarget: 'lead',
    priority: INBOX_PRIORITY.HIGH,
  },
  [INBOX_EVENT_TYPES.OFFER_OPENED]: {
    badge: 'Geöffnet',
    icon: '👁',
    actionLabel: 'Nachfassen',
    actionTarget: 'followup',
    priority: INBOX_PRIORITY.NORMAL,
  },
  [INBOX_EVENT_TYPES.OFFER_DECLINED]: {
    badge: 'Abgelehnt',
    icon: '✕',
    actionLabel: 'Kundenakte öffnen',
    actionTarget: 'lead',
    priority: INBOX_PRIORITY.NORMAL,
  },
  [INBOX_EVENT_TYPES.DOCUMENT_UPLOADED]: {
    badge: 'Unterlage',
    icon: '📎',
    actionLabel: 'Unterlagen öffnen',
    actionTarget: 'documents',
    priority: INBOX_PRIORITY.NORMAL,
  },
  [INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED]: {
    badge: 'Unterlagen',
    icon: '✓',
    actionLabel: 'Unterlagen öffnen',
    actionTarget: 'documents',
    priority: INBOX_PRIORITY.NORMAL,
  },
  [INBOX_EVENT_TYPES.SPECIAL_QUESTION]: {
    badge: 'Spezialfrage',
    icon: '?',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
  },
  [INBOX_EVENT_TYPES.LEARNING_REQUEST_CREATED]: {
    badge: 'Lernanfrage',
    icon: '📚',
    actionLabel: 'Prüfen',
    actionTarget: 'learning',
    priority: INBOX_PRIORITY.LOW,
  },
};

let memoryStore = null;

function uid(prefix = 'inbox') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadFromStorage() {
  if (memoryStore) return [...memoryStore];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  const next = [...items];
  if (memoryStore) {
    memoryStore = next;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function __resetInboxStoreForTests(items = []) {
  memoryStore = items.map((item) => ({ ...item }));
}

export function __clearInboxTestMode() {
  memoryStore = null;
}

function normalizeItem(input = {}) {
  const type = input.type ?? INBOX_EVENT_TYPES.CUSTOMER_QUESTION;
  const meta = EVENT_META[type] ?? {};
  const now = new Date().toISOString();
  return {
    id: input.id ?? uid(),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    type,
    title: input.title ?? 'Kundenmeldung',
    message: input.message ?? '',
    customerId: input.customerId ?? input.leadId ?? null,
    customerName: input.customerName ?? '',
    leadId: input.leadId ?? input.customerId ?? null,
    offerId: input.offerId ?? null,
    vehicleLabel: input.vehicleLabel ?? null,
    sourceArea: input.sourceArea ?? INBOX_SOURCE_AREA.CUSTOMER_LINK,
    priority: input.priority ?? meta.priority ?? INBOX_PRIORITY.NORMAL,
    status: input.status ?? INBOX_STATUS.OPEN,
    assignedToUserId: input.assignedToUserId ?? null,
    actionLabel: input.actionLabel ?? meta.actionLabel ?? 'Öffnen',
    actionTarget: input.actionTarget ?? meta.actionTarget ?? 'lead',
    metadata: input.metadata ?? {},
  };
}

function sortItems(items = []) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function shouldCreateInboxFromHistory(entry = {}) {
  const type = entry.type ?? 'note';
  if (INBOX_EXCLUDED_HISTORY_TYPES.has(type)) return false;
  const text = String(entry.text ?? '');
  return !EXCLUDED_HISTORY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * @param {object} input
 */
export function createInboxItem(input = {}) {
  const item = normalizeItem(input);
  const items = loadFromStorage();
  const dedupeKey = item.metadata?.dedupeKey;
  if (dedupeKey) {
    const existing = items.find(
      (entry) => entry.metadata?.dedupeKey === dedupeKey && entry.status === INBOX_STATUS.OPEN,
    );
    if (existing) {
      const updated = { ...existing, ...item, id: existing.id, updatedAt: new Date().toISOString() };
      const next = items.map((entry) => (entry.id === existing.id ? updated : entry));
      saveToStorage(next);
      return updated;
    }
  }
  const next = sortItems([item, ...items]);
  saveToStorage(next);
  return item;
}

/**
 * @param {object} [filter]
 */
export function listInboxItems(filter = {}) {
  let items = loadFromStorage();
  if (filter.leadId || filter.customerId) {
    const id = filter.leadId ?? filter.customerId;
    items = items.filter((item) => item.leadId === id || item.customerId === id);
  }
  if (filter.type) {
    items = items.filter((item) => item.type === filter.type);
  }
  if (filter.status === 'open') {
    items = items.filter((item) => item.status === INBOX_STATUS.OPEN || item.status === INBOX_STATUS.IN_PROGRESS);
  } else if (filter.status === 'done') {
    items = items.filter((item) => item.status === INBOX_STATUS.DONE || item.status === INBOX_STATUS.IGNORED);
  } else if (filter.status) {
    items = items.filter((item) => item.status === filter.status);
  }
  return sortItems(items);
}

/**
 * @param {string} customerId
 */
export function listInboxItemsForCustomer(customerId) {
  return listInboxItems({ customerId, status: 'open' });
}

export function countOpenInboxItems(filter = {}) {
  return listInboxItems({ ...filter, status: 'open' }).length;
}

export function countOpenQuestionInboxItems(filter = {}) {
  return listInboxItems({ ...filter, status: 'open' }).filter(
    (item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
      || item.type === INBOX_EVENT_TYPES.OFFER_QUESTION
      || item.type === INBOX_EVENT_TYPES.SPECIAL_QUESTION,
  ).length;
}

/**
 * @param {object} [filter]
 */
export function buildInboxDashboardSummary(filter = {}) {
  const openItems = listInboxItems({ ...filter, status: 'open' });
  const questionCount = openItems.filter(
    (item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
      || item.type === INBOX_EVENT_TYPES.OFFER_QUESTION,
  ).length;
  const openCount = openItems.length;

  let subtitle = `${openCount} neue Meldung${openCount === 1 ? '' : 'en'}`;
  if (questionCount > 0) {
    subtitle = `${questionCount} Frage${questionCount === 1 ? '' : 'n'} offen`;
  }

  return {
    openCount,
    questionCount,
    subtitle,
    hasOpen: openCount > 0,
  };
}

export function markInboxItemDone(id) {
  const items = loadFromStorage();
  const next = items.map((item) => (
    item.id === id
      ? { ...item, status: INBOX_STATUS.DONE, updatedAt: new Date().toISOString() }
      : item
  ));
  saveToStorage(next);
  return next.find((item) => item.id === id) ?? null;
}

export function ignoreInboxItem(id) {
  const items = loadFromStorage();
  const next = items.map((item) => (
    item.id === id
      ? { ...item, status: INBOX_STATUS.IGNORED, updatedAt: new Date().toISOString() }
      : item
  ));
  saveToStorage(next);
  return next.find((item) => item.id === id) ?? null;
}

export function getInboxEventMeta(type) {
  return EVENT_META[type] ?? { badge: 'Meldung', icon: '•', actionLabel: 'Öffnen', actionTarget: 'lead' };
}

/**
 * @param {object} params
 */
export function buildInboxItemFromCustomerInteraction({
  lead = null,
  interaction = null,
  vehicleLabel = null,
  question = null,
} = {}) {
  if (!lead?.id || !question?.text) return null;
  return createInboxItem({
    type: INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
    title: 'Kundenfrage offen',
    message: `„${question.text}“`,
    customerId: lead.id,
    customerName: lead.contact?.name ?? '',
    leadId: lead.id,
    offerId: interaction?.offerId ?? null,
    vehicleLabel,
    sourceArea: INBOX_SOURCE_AREA.CUSTOMER_LINK,
    metadata: {
      dedupeKey: `question:${lead.id}:${interaction?.offerId ?? 'general'}:${question.id}`,
      questionId: question.id,
    },
  });
}

/**
 * @param {object} params
 */
export function buildInboxItemFromOfferInteraction({
  lead = null,
  cardId = null,
  interaction = null,
  vehicleOffer = null,
  vehicleLabel = null,
  eventType = null,
} = {}) {
  if (!lead?.id) return null;

  const customerName = lead.contact?.name ?? '';
  const offerId = cardId ?? interaction?.offerId ?? null;
  const label = vehicleLabel ?? 'Fahrzeug';

  if (eventType === INBOX_EVENT_TYPES.OFFER_QUESTION) {
    const openQuestion = (interaction?.customerQuestions ?? []).find((q) => q.status === 'open');
    if (openQuestion) {
      return createInboxItem({
        type: INBOX_EVENT_TYPES.OFFER_QUESTION,
        title: 'Kundenfrage offen',
        message: `„${openQuestion.text}“`,
        customerId: lead.id,
        customerName,
        leadId: lead.id,
        offerId,
        vehicleLabel: label,
        sourceArea: INBOX_SOURCE_AREA.OFFER_LINK,
        metadata: {
          dedupeKey: `offer-question:${lead.id}:${offerId}:${openQuestion.id}`,
          questionId: openQuestion.id,
        },
      });
    }
    return null;
  }

  if (eventType === INBOX_EVENT_TYPES.OFFER_OPENED
    || interaction?.interestStatus === INTEREST_STATUS.OPENED
    || vehicleOffer?.status === VEHICLE_OFFER_STATUS.OPENED) {
    const openedAt = interaction?.openedAt
      ?? interaction?.lastViewedAt
      ?? vehicleOffer?.tracking?.lastOpenedAt
      ?? new Date().toISOString();
    return createInboxItem({
      type: INBOX_EVENT_TYPES.OFFER_OPENED,
      title: 'Angebot wurde geöffnet',
      message: `${label} wurde geöffnet.`,
      customerId: lead.id,
      customerName,
      leadId: lead.id,
      offerId,
      vehicleLabel: label,
      sourceArea: INBOX_SOURCE_AREA.OFFER_LINK,
      metadata: {
        dedupeKey: `opened:${lead.id}:${offerId}:${openedAt.slice(0, 10)}`,
        openedAt,
      },
    });
  }

  if (eventType === INBOX_EVENT_TYPES.OFFER_INTERESTED
    || (!eventType && interaction?.interestStatus === INTEREST_STATUS.INTERESTED)
    || (!eventType && vehicleOffer?.status === VEHICLE_OFFER_STATUS.ACCEPTED)) {
    return createInboxItem({
      type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
      title: `Kunde interessiert sich für ${label}`,
      message: 'Der Kunde hat den Vorschlag als interessant markiert.',
      customerId: lead.id,
      customerName,
      leadId: lead.id,
      offerId,
      vehicleLabel: label,
      sourceArea: INBOX_SOURCE_AREA.OFFER_LINK,
      metadata: { dedupeKey: `interested:${lead.id}:${offerId}` },
    });
  }

  if (eventType === INBOX_EVENT_TYPES.OFFER_DECLINED
    || (!eventType && interaction?.interestStatus === INTEREST_STATUS.NOT_INTERESTED)
    || (!eventType && vehicleOffer?.status === VEHICLE_OFFER_STATUS.REJECTED)) {
    return createInboxItem({
      type: INBOX_EVENT_TYPES.OFFER_DECLINED,
      title: 'Angebot abgelehnt',
      message: `Der Kunde hat ${label} abgelehnt.`,
      customerId: lead.id,
      customerName,
      leadId: lead.id,
      offerId,
      vehicleLabel: label,
      sourceArea: INBOX_SOURCE_AREA.OFFER_LINK,
      metadata: { dedupeKey: `declined:${lead.id}:${offerId}` },
    });
  }

  if (eventType === INBOX_EVENT_TYPES.CONTACT_REQUESTED
    || (!eventType && interaction?.interestStatus === INTEREST_STATUS.CONTACT_REQUESTED)) {
    return createInboxItem({
      type: INBOX_EVENT_TYPES.CONTACT_REQUESTED,
      title: 'Kontakt angefordert',
      message: `${customerName || 'Kunde'} möchte vom Verkäufer kontaktiert werden.`,
      customerId: lead.id,
      customerName,
      leadId: lead.id,
      offerId,
      vehicleLabel: label,
      sourceArea: INBOX_SOURCE_AREA.CUSTOMER_LINK,
      metadata: { dedupeKey: `contact:${lead.id}:${offerId}` },
    });
  }

  const openQuestion = (interaction?.customerQuestions ?? []).find((q) => q.status === 'open');
  if (openQuestion && !eventType) {
    return buildInboxItemFromCustomerInteraction({
      lead,
      interaction,
      vehicleLabel: label,
      question: openQuestion,
    });
  }

  return null;
}

/**
 * @param {object} params
 */
export function buildInboxItemFromDocumentEvent({
  lead = null,
  documentLabel = '',
  customerName = '',
  eventType = INBOX_EVENT_TYPES.DOCUMENT_UPLOADED,
} = {}) {
  if (!lead?.id) return null;
  const name = customerName || lead.contact?.name || 'Kunde';
  const isCompleted = eventType === INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED;
  return createInboxItem({
    type: eventType,
    title: isCompleted ? 'Unterlagen vollständig' : 'Unterlage hochgeladen',
    message: isCompleted
      ? `${name} hat alle Unterlagen über den Link ergänzt.`
      : `${name} hat ${documentLabel || 'eine Unterlage'} hochgeladen.`,
    customerId: lead.id,
    customerName: name,
    leadId: lead.id,
    sourceArea: INBOX_SOURCE_AREA.DOCUMENTS,
    actionLabel: 'Unterlagen öffnen',
    actionTarget: 'documents',
    metadata: {
      dedupeKey: `doc:${lead.id}:${documentLabel}:${eventType}`,
      documentLabel,
    },
  });
}

/**
 * @param {object} lead
 */
export function syncInboxItemsFromLead(lead = {}) {
  if (!lead?.id) return [];
  const created = [];
  const interactions = lead.crm?.customerOfferInteractions ?? {};
  const vehicleOffers = lead.crm?.vehicleOffers ?? {};

  Object.entries(interactions).forEach(([cardId, interaction]) => {
    const vehicleOffer = vehicleOffers[cardId] ?? null;
    const vehicleLabel = interaction?.vehicleLabel
      ?? lead.vehicle?.model
      ?? cardId;

    (interaction.customerQuestions ?? [])
      .filter((q) => q.status === 'open')
      .forEach(() => {
        const item = buildInboxItemFromOfferInteraction({
          lead,
          cardId,
          interaction: { ...interaction, offerId: cardId },
          vehicleOffer,
          vehicleLabel,
          eventType: INBOX_EVENT_TYPES.OFFER_QUESTION,
        });
        if (item) created.push(createInboxItem(item));
      });

    if (interaction.interestStatus === INTEREST_STATUS.INTERESTED) {
      const item = buildInboxItemFromOfferInteraction({
        lead, cardId, interaction, vehicleOffer, vehicleLabel,
        eventType: INBOX_EVENT_TYPES.OFFER_INTERESTED,
      });
      if (item) created.push(createInboxItem(item));
    }

    if (interaction.interestStatus === INTEREST_STATUS.OPENED) {
      const item = buildInboxItemFromOfferInteraction({
        lead, cardId, interaction, vehicleOffer, vehicleLabel,
        eventType: INBOX_EVENT_TYPES.OFFER_OPENED,
      });
      if (item) created.push(createInboxItem(item));
    }
  });

  Object.entries(vehicleOffers).forEach(([cardId, vehicleOffer]) => {
    if (vehicleOffer.status === VEHICLE_OFFER_STATUS.OPENED) {
      const item = buildInboxItemFromOfferInteraction({
        lead,
        cardId,
        vehicleOffer,
        vehicleLabel: lead.vehicle?.model ?? cardId,
        eventType: INBOX_EVENT_TYPES.OFFER_OPENED,
      });
      if (item) created.push(createInboxItem(item));
    }
    if (vehicleOffer.status === VEHICLE_OFFER_STATUS.ACCEPTED) {
      const item = buildInboxItemFromOfferInteraction({
        lead,
        cardId,
        vehicleOffer,
        vehicleLabel: lead.vehicle?.model ?? cardId,
        eventType: INBOX_EVENT_TYPES.OFFER_INTERESTED,
      });
      if (item) created.push(createInboxItem(item));
    }
  });

  return created;
}

export function findPrimaryOpenInboxItemForLead(leadId, preferredTypes = []) {
  const open = listInboxItemsForCustomer(leadId);
  if (!open.length) return null;
  if (preferredTypes.length) {
    const match = open.find((item) => preferredTypes.includes(item.type));
    if (match) return match;
  }
  return open[0];
}
