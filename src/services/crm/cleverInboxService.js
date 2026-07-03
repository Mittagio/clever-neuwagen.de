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
  ADVISOR_CONTACT_REQUEST: 'advisor_contact_request',
  CUSTOMER_MESSAGE: 'customer_message',
  SELF_DISCLOSURE_SUBMITTED: 'self_disclosure_submitted',
  STOCK_VEHICLE_REQUEST: 'stock_vehicle_request',
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

/** Kategorie-Filter für Clever Eingang (Erweiterbar) */
export const INBOX_CATEGORY_FILTERS = [
  { id: 'all', label: 'Alle' },
  {
    id: 'questions',
    label: 'Fragen',
    types: [
      INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
      INBOX_EVENT_TYPES.OFFER_QUESTION,
      INBOX_EVENT_TYPES.SPECIAL_QUESTION,
      INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
    ],
  },
  {
    id: 'offers',
    label: 'Angebote',
    types: [
      INBOX_EVENT_TYPES.OFFER_OPENED,
      INBOX_EVENT_TYPES.OFFER_INTERESTED,
      INBOX_EVENT_TYPES.OFFER_DECLINED,
      INBOX_EVENT_TYPES.CONTACT_REQUESTED,
      INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST,
    ],
  },
  {
    id: 'advisor',
    label: 'Frag Clever',
    types: [INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST],
  },
  {
    id: 'documents',
    label: 'Unterlagen',
    types: [
      INBOX_EVENT_TYPES.DOCUMENT_UPLOADED,
      INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED,
      INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
    ],
  },
];

const EVENT_META = {
  [INBOX_EVENT_TYPES.CUSTOMER_QUESTION]: {
    badge: 'Frage',
    icon: '💬',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 10,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.OFFER_QUESTION]: {
    badge: 'Frage',
    icon: '💬',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 10,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.CONTACT_REQUESTED]: {
    badge: 'Kontakt',
    icon: '📞',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 10,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.OFFER_INTERESTED]: {
    badge: 'Interesse',
    icon: '★',
    actionLabel: 'Nachfassen',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 30,
  },
  [INBOX_EVENT_TYPES.OFFER_OPENED]: {
    badge: 'Geöffnet',
    icon: '👁',
    actionLabel: 'Nachfassen',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.NORMAL,
    sortOrder: 40,
  },
  [INBOX_EVENT_TYPES.OFFER_DECLINED]: {
    badge: 'Abgelehnt',
    icon: '✕',
    actionLabel: 'Nachfassen',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.NORMAL,
    sortOrder: 50,
  },
  [INBOX_EVENT_TYPES.DOCUMENT_UPLOADED]: {
    badge: 'Unterlagen',
    icon: '📎',
    actionLabel: 'Prüfen',
    actionTarget: 'documents',
    priority: INBOX_PRIORITY.NORMAL,
    sortOrder: 20,
  },
  [INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED]: {
    badge: 'Unterlagen',
    icon: '✓',
    actionLabel: 'Prüfen',
    actionTarget: 'documents',
    priority: INBOX_PRIORITY.NORMAL,
    sortOrder: 20,
  },
  [INBOX_EVENT_TYPES.SPECIAL_QUESTION]: {
    badge: 'Frage',
    icon: '?',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 10,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.LEARNING_REQUEST_CREATED]: {
    badge: 'Lernanfrage',
    icon: '📚',
    actionLabel: 'Prüfen',
    actionTarget: 'learning',
    priority: INBOX_PRIORITY.LOW,
    sortOrder: 50,
  },
  [INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST]: {
    badge: 'Frag Clever',
    icon: '✨',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 12,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.CUSTOMER_MESSAGE]: {
    badge: 'Nachricht',
    icon: '💬',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 10,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED]: {
    badge: 'Unterlagen',
    icon: '📋',
    actionLabel: 'Prüfen',
    actionTarget: 'self_disclosure_review',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 20,
    urgent: true,
  },
  [INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST]: {
    badge: 'Bestand',
    icon: '🚗',
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    secondaryActionLabel: 'Inserat öffnen',
    secondaryActionTarget: 'listing',
    priority: INBOX_PRIORITY.HIGH,
    sortOrder: 8,
    urgent: true,
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
  return [...items].sort((a, b) => {
    const metaA = EVENT_META[a.type] ?? {};
    const metaB = EVENT_META[b.type] ?? {};
    const orderA = metaA.sortOrder ?? 99;
    const orderB = metaB.sortOrder ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function countLabel(count, singular, plural = `${singular}n`) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export function getCategoryOpenCount(categoryId, filter = {}) {
  if (categoryId === 'all') {
    return listInboxItems({ ...filter, status: 'open' }).length;
  }
  return listInboxItems({ ...filter, status: 'open', category: categoryId }).length;
}

export function isInboxItemUrgent(item = {}) {
  if (item.metadata?.urgent === true) return true;
  const meta = EVENT_META[item.type] ?? {};
  if (meta.urgent && item.priority === INBOX_PRIORITY.HIGH) return true;
  if (item.type === INBOX_EVENT_TYPES.CONTACT_REQUESTED) return true;
  return false;
}

/**
 * Zusammenfassung für Clever-Eingang-Seitenkopf
 * @param {object} [filter]
 */
export function buildInboxPageSummary(filter = {}) {
  const openItems = listInboxItems({ ...filter, status: 'open' });
  const openCount = openItems.length;
  const questionCount = getCategoryOpenCount('questions', filter);
  const offerCount = getCategoryOpenCount('offers', filter);
  const documentCount = getCategoryOpenCount('documents', filter);

  const parts = [
    `${openCount} offen`,
    countLabel(questionCount, 'Frage', 'Fragen'),
    countLabel(offerCount, 'Angebot', 'Angebote'),
    countLabel(documentCount, 'Unterlage', 'Unterlagen'),
  ];

  return {
    openCount,
    questionCount,
    offerCount,
    documentCount,
    summaryLine: parts.join(' · '),
    openItems,
  };
}

/**
 * Demo-Karten für Vorschau / Abnahme (?demo=1)
 */
export function buildInboxDemoItems() {
  const now = new Date().toISOString();
  const ev6OfferMeta = {
    paymentTypeLabel: 'Leasing',
    offerConditionsLine: '48 Monate · 15.000 km/Jahr',
    monthlyRate: 386,
    demo: true,
  };
  return [
    {
      id: 'demo-inbox-advisor',
      createdAt: now,
      updatedAt: now,
      type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
      title: 'Neue Frage aus Frag Clever',
      message: '„Was wäre die Lieferzeit für den EV9?“',
      customerName: 'EV9 Kunde',
      leadId: 'demo-lead-ev9',
      vehicleLabel: 'Kia EV9',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.HIGH,
      actionLabel: 'Antworten',
      actionTarget: 'reply',
      metadata: { topics: ['EV9', 'Lieferzeit'], demo: true },
    },
    {
      id: 'demo-inbox-stock',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
      type: INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST,
      title: 'Neue Bestandsfahrzeug-Anfrage',
      message: 'Wir benötigen zeitnah ein zusätzliches Fahrzeug …',
      customerName: 'Alexander Wagner',
      leadId: 'demo-lead-stock',
      vehicleLabel: 'Kia Picanto 1.0 VISION AMT',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.HIGH,
      actionLabel: 'Antworten',
      actionTarget: 'reply',
      metadata: {
        contentLine: '17.990 € · Fahrzeuglink gefunden',
        vehicleUrl: 'https://example.de/fahrzeug/picanto',
        suggestedIntent: 'answer_stock_vehicle_request',
        demo: true,
      },
    },
    {
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      type: INBOX_EVENT_TYPES.OFFER_QUESTION,
      title: 'Kundenfrage offen',
      message: '„Winterreifen dabei?“',
      customerName: 'E2E Kunde',
      leadId: 'demo-lead-ev6',
      offerId: 'vc-ev6',
      vehicleLabel: 'EV6',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.HIGH,
      actionLabel: 'Antworten',
      actionTarget: 'reply',
      metadata: {
        topics: ['EV6', 'Winterreifen', 'Angebot'],
        questionId: 'demo-q-1',
        ...ev6OfferMeta,
      },
    },
    {
      id: 'demo-inbox-interested',
      createdAt: new Date(Date.now() - 3500000).toISOString(),
      updatedAt: new Date(Date.now() - 3500000).toISOString(),
      type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
      title: 'Kunde interessiert sich',
      message: 'Kunde hat diese Variante als interessant markiert.',
      customerName: 'E2E Kunde',
      leadId: 'demo-lead-ev6',
      offerId: 'vc-ev6',
      vehicleLabel: 'EV6',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.HIGH,
      actionLabel: 'Nachfassen',
      actionTarget: 'reply',
      metadata: { ...ev6OfferMeta },
    },
    {
      id: 'demo-inbox-opened',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      type: INBOX_EVENT_TYPES.OFFER_OPENED,
      title: 'Angebot wurde geöffnet',
      message: 'Kunde hat die EV9-Auswahl geöffnet.',
      customerName: 'EV9 Interessent',
      leadId: 'demo-lead-opened',
      offerId: 'vc-ev9',
      vehicleLabel: 'EV9 Auswahl',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.NORMAL,
      actionLabel: 'Nachfassen',
      actionTarget: 'reply',
      metadata: {
        demo: true,
        paymentTypeLabel: 'Leasing',
        offerConditionsLine: '48 Monate · 10.000 km/Jahr',
        monthlyRate: 512,
      },
    },
    {
      id: 'demo-inbox-self-disclosure',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      updatedAt: new Date(Date.now() - 5400000).toISOString(),
      type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
      title: 'Selbstauskunft eingereicht',
      message: 'Selbstauskunft eingereicht',
      customerName: 'Faas Stefanie',
      leadId: 'demo-lead-sd',
      vehicleLabel: 'XCeed',
      status: INBOX_STATUS.OPEN,
      priority: INBOX_PRIORITY.HIGH,
      actionLabel: 'Prüfen',
      actionTarget: 'self_disclosure_review',
      metadata: { demo: true, selfDisclosureType: 'private' },
    },
  ];
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
  if (filter.category && filter.category !== 'all') {
    const category = INBOX_CATEGORY_FILTERS.find((entry) => entry.id === filter.category);
    if (category?.types?.length) {
      items = items.filter((item) => category.types.includes(item.type));
    }
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
      || item.type === INBOX_EVENT_TYPES.SPECIAL_QUESTION
      || item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  ).length;
}

/**
 * @param {object} [filter]
 */
export function buildInboxDashboardSummary(filter = {}) {
  const openItems = listInboxItems({ ...filter, status: 'open' });
  const questionCount = openItems.filter(
    (item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
      || item.type === INBOX_EVENT_TYPES.OFFER_QUESTION
      || item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  ).length;
  const openCount = openItems.length;

  let subtitle = `${openCount} Nachricht${openCount === 1 ? '' : 'en'} offen`;
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

/**
 * @param {object} params
 */
export function markInboxDoneForQuestion({
  inboxItemId = null,
  leadId = null,
  questionId = null,
} = {}) {
  if (inboxItemId) {
    return markInboxItemDone(inboxItemId);
  }
  if (!leadId || !questionId) return null;

  const match = listInboxItems({ leadId, status: 'open' }).find(
    (item) => (
      item.type === INBOX_EVENT_TYPES.OFFER_QUESTION
      || item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
      || (item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE && item.metadata?.questionId)
    )
      && item.metadata?.questionId === questionId,
  );
  if (!match) return null;
  return markInboxItemDone(match.id);
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
  return EVENT_META[type] ?? { badge: 'Nachricht', icon: '•', actionLabel: 'Öffnen', actionTarget: 'lead' };
}

/**
 * @param {object} item
 */
export function getInboxItemTopics(item = {}) {
  if (Array.isArray(item.metadata?.topics) && item.metadata.topics.length) {
    return item.metadata.topics.filter(Boolean).slice(0, 6);
  }
  const signals = item.metadata?.extractedSignals ?? [];
  if (signals.length) {
    return signals.map((signal) => signal?.label ?? signal).filter(Boolean).slice(0, 6);
  }
  const match = String(item.message ?? '').match(/^Themen:\s*(.+?)\.?$/);
  if (match) {
    return match[1].split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 6);
  }
  return [];
}

/**
 * @param {object} item
 */
export function getInboxDisplayMessage(item = {}) {
  if (item.type === INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST && item.metadata?.contentLine) {
    return item.metadata.contentLine;
  }
  if (item.type === INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED) {
    const type = item.metadata?.selfDisclosureType;
    const typeLabels = {
      private: 'Privatperson',
      freelancer: 'Selbstständig',
      corporation: 'Firma',
    };
    if (type) return `Typ: ${typeLabels[type] ?? type}`;
    return 'Selbstauskunft eingereicht';
  }
  const topics = getInboxItemTopics(item);
  const message = String(item.message ?? '').trim();
  if (!message) return '';
  if (topics.length && /^Themen:/i.test(message)) return '';
  if (/\bnettoeinkommen\b/i.test(message) || /\beinkommen\b/i.test(message)) {
    return 'Selbstauskunft eingereicht';
  }
  return message;
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
    const openedMessage = /Auswahl/i.test(label)
      ? `Kunde hat die ${label} geöffnet.`
      : `Kunde hat ${label} geöffnet.`;
    return createInboxItem({
      type: INBOX_EVENT_TYPES.OFFER_OPENED,
      title: 'Angebot wurde geöffnet',
      message: openedMessage,      customerId: lead.id,
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
      title: 'Kunde interessiert sich',
      message: 'Kunde hat diese Variante als interessant markiert.',
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
    actionLabel: 'Prüfen',
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
      .forEach((openQuestion) => {
        const hasMirroredMessage = listInboxItems({ leadId: lead.id, status: 'open' }).some(
          (item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE
            && item.metadata?.questionId === openQuestion.id,
        );
        if (hasMirroredMessage) return;

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
    const match = open.find((item) => {
      if (preferredTypes.includes(item.type)) {
        if (item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE) {
          return Boolean(item.metadata?.questionId);
        }
        return true;
      }
      return false;
    });
    if (match) return match;
  }
  return open[0];
}
