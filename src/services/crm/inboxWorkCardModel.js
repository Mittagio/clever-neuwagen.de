/**
 * Clever Eingang – Arbeitskarten-Modell (Priorität, Wärme, nächster Schritt).
 *
 * Zähler-Logik (konsistent im gesamten Feature):
 * - „Offene Arbeitskarten“ / Hero „offene Kunden“ = eindeutige gruppierte Work Cards
 *   (ein Fall pro leadId + offerId-Kombination).
 * - Kategorie-Badges in den Filtern zählen einzelne offene Inbox-Items (Signale),
 *   damit der Verkäufer sieht, wie viele Fragen/Angebote/Unterlagen insgesamt anliegen.
 */
import {
  INBOX_EVENT_TYPES,
  getInboxDisplayMessage,
  getInboxEventMeta,
  isInboxItemUrgent,
} from './cleverInboxService.js';

export const INBOX_WARMTH = {
  URGENT: 'urgent',
  HOT: 'hot',
  WARM: 'warm',
  NEW: 'new',
};

export const INBOX_WARMTH_LABELS = {
  [INBOX_WARMTH.URGENT]: 'Dringend',
  [INBOX_WARMTH.HOT]: 'Heiß',
  [INBOX_WARMTH.WARM]: 'Warm',
  [INBOX_WARMTH.NEW]: 'Neu',
};

const QUESTION_TYPES = new Set([
  INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
  INBOX_EVENT_TYPES.OFFER_QUESTION,
  INBOX_EVENT_TYPES.SPECIAL_QUESTION,
  INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  INBOX_EVENT_TYPES.CONTACT_REQUESTED,
  INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST,
  INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST,
]);

const DOCUMENT_TYPES = new Set([
  INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
  INBOX_EVENT_TYPES.DOCUMENT_UPLOADED,
  INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED,
]);

const OFFER_REACTION_TYPES = new Set([
  INBOX_EVENT_TYPES.OFFER_INTERESTED,
  INBOX_EVENT_TYPES.OFFER_OPENED,
  INBOX_EVENT_TYPES.OFFER_DECLINED,
]);

/** Arbeitswert-Priorität (niedriger = höher) */
const WORK_PRIORITY = {
  [INBOX_EVENT_TYPES.CUSTOMER_QUESTION]: 10,
  [INBOX_EVENT_TYPES.OFFER_QUESTION]: 10,
  [INBOX_EVENT_TYPES.SPECIAL_QUESTION]: 10,
  [INBOX_EVENT_TYPES.CUSTOMER_MESSAGE]: 10,
  [INBOX_EVENT_TYPES.CONTACT_REQUESTED]: 10,
  [INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST]: 12,
  [INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST]: 8,
  [INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED]: 20,
  [INBOX_EVENT_TYPES.DOCUMENT_UPLOADED]: 20,
  [INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED]: 20,
  [INBOX_EVENT_TYPES.OFFER_INTERESTED]: 30,
  [INBOX_EVENT_TYPES.OFFER_OPENED]: 40,
  [INBOX_EVENT_TYPES.OFFER_DECLINED]: 50,
  [INBOX_EVENT_TYPES.LEARNING_REQUEST_CREATED]: 50,
};

/** Menschliche Signale – keine technischen Eventnamen in der UI */
const SIGNAL_LABELS = {
  [INBOX_EVENT_TYPES.CUSTOMER_QUESTION]: 'Frage offen',
  [INBOX_EVENT_TYPES.OFFER_QUESTION]: 'Frage offen',
  [INBOX_EVENT_TYPES.SPECIAL_QUESTION]: 'Frage offen',
  [INBOX_EVENT_TYPES.CUSTOMER_MESSAGE]: 'Nachricht vom Kunden',
  [INBOX_EVENT_TYPES.CONTACT_REQUESTED]: 'Rückrufwunsch',
  [INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST]: 'Frag Clever',
  [INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST]: 'Bestandsfahrzeug-Anfrage',
  [INBOX_EVENT_TYPES.OFFER_INTERESTED]: 'Interesse markiert',
  [INBOX_EVENT_TYPES.OFFER_OPENED]: 'Angebot geöffnet',
  [INBOX_EVENT_TYPES.OFFER_DECLINED]: 'Angebot abgelehnt',
  [INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED]: 'Selbstauskunft eingereicht',
  [INBOX_EVENT_TYPES.DOCUMENT_UPLOADED]: 'Unterlage hochgeladen',
  [INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED]: 'Unterlagen vollständig',
  [INBOX_EVENT_TYPES.LEARNING_REQUEST_CREATED]: 'Lernanfrage',
};

const NEXT_STEP_BY_TYPE = {
  [INBOX_EVENT_TYPES.CUSTOMER_QUESTION]: { step: 'Frage beantworten', action: 'Antworten' },
  [INBOX_EVENT_TYPES.OFFER_QUESTION]: { step: 'Frage beantworten', action: 'Antworten' },
  [INBOX_EVENT_TYPES.SPECIAL_QUESTION]: { step: 'Frage beantworten', action: 'Antworten' },
  [INBOX_EVENT_TYPES.CUSTOMER_MESSAGE]: { step: 'Nachricht beantworten', action: 'Antworten' },
  [INBOX_EVENT_TYPES.CONTACT_REQUESTED]: { step: 'Kunden kontaktieren', action: 'Antworten' },
  [INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST]: { step: 'Frage beantworten', action: 'Antworten' },
  [INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED]: { step: 'Selbstauskunft prüfen', action: 'Prüfen' },
  [INBOX_EVENT_TYPES.DOCUMENT_UPLOADED]: { step: 'Unterlage ansehen', action: 'Prüfen' },
  [INBOX_EVENT_TYPES.DOCUMENT_LINK_COMPLETED]: { step: 'Unterlagen prüfen', action: 'Prüfen' },
  [INBOX_EVENT_TYPES.OFFER_INTERESTED]: { step: 'Nachfassen', action: 'Nachfassen' },
  [INBOX_EVENT_TYPES.OFFER_OPENED]: { step: 'Nachfassen vorbereiten', action: 'Nachfassen' },
  [INBOX_EVENT_TYPES.OFFER_DECLINED]: { step: 'Alternative anbieten', action: 'Nachfassen' },
  [INBOX_EVENT_TYPES.LEARNING_REQUEST_CREATED]: { step: 'Anfrage prüfen', action: 'Prüfen' },
};

function isQuestionType(type) {
  return QUESTION_TYPES.has(type);
}

function isDocumentType(type) {
  return DOCUMENT_TYPES.has(type);
}

function isOfferReactionType(type) {
  return OFFER_REACTION_TYPES.has(type);
}

export function getInboxWorkPriority(item = {}) {
  return WORK_PRIORITY[item.type] ?? 60;
}

export function getInboxSignalLabel(type) {
  return SIGNAL_LABELS[type] ?? null;
}

function isRecent(iso, hours = 24) {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < hours * 60 * 60 * 1000;
}

/**
 * Wärme aus einer Gruppe von Signalen (ein Fall).
 */
export function computeInboxWarmth(items = []) {
  if (!items.length) return null;

  const types = new Set(items.map((item) => item.type));
  const hasQuestion = [...types].some((type) => isQuestionType(type));
  const hasInterest = types.has(INBOX_EVENT_TYPES.OFFER_INTERESTED);
  const hasOpened = types.has(INBOX_EVENT_TYPES.OFFER_OPENED);
  const hasDocument = [...types].some((type) => isDocumentType(type));
  const openCount = items.filter((item) => item.type === INBOX_EVENT_TYPES.OFFER_OPENED).length;
  const urgent = items.some((item) => isInboxItemUrgent(item));

  if (hasQuestion && (hasInterest || hasDocument || urgent)) {
    return INBOX_WARMTH.URGENT;
  }
  if (urgent || types.has(INBOX_EVENT_TYPES.CONTACT_REQUESTED)) {
    return INBOX_WARMTH.URGENT;
  }
  if (hasInterest && hasQuestion) return INBOX_WARMTH.HOT;
  if (openCount >= 2) return INBOX_WARMTH.HOT;
  if (hasDocument && (hasInterest || hasOpened)) return INBOX_WARMTH.HOT;
  if (hasInterest || hasOpened) return INBOX_WARMTH.WARM;
  if (items.some((item) => isRecent(item.createdAt))) return INBOX_WARMTH.NEW;
  return null;
}

export function resolveInboxNextStep(primaryItem = {}, groupItems = []) {
  const items = groupItems.length ? groupItems : [primaryItem];
  const sorted = [...items].sort((a, b) => getInboxWorkPriority(a) - getInboxWorkPriority(b));
  const primary = sorted[0] ?? primaryItem;
  const preset = NEXT_STEP_BY_TYPE[primary.type];
  const meta = getInboxEventMeta(primary.type);

  return {
    stepLabel: preset?.step ?? 'Bearbeiten',
    actionLabel: primary.actionLabel ?? preset?.action ?? meta.actionLabel ?? 'Öffnen',
    actionTarget: primary.actionTarget ?? meta.actionTarget ?? 'lead',
    primaryItem: primary,
  };
}

export function buildInboxCustomerTitle(item = {}) {
  const name = String(item.customerName ?? '').trim() || 'Kunde';
  const vehicle = String(item.vehicleLabel ?? '').trim();
  if (vehicle) {
    const vehicleDisplay = vehicle.toLowerCase().startsWith('kia ')
      ? vehicle
      : `Kia ${vehicle}`;
    return `${name} · ${vehicleDisplay}`;
  }
  return name;
}

export function resolveInboxOfferContext(item = {}) {
  const meta = item.metadata ?? {};
  const paymentLabel = meta.paymentTypeLabel ?? meta.paymentType ?? null;
  const conditions = meta.offerConditionsLine ?? meta.conditionsLine ?? null;
  const priceLine = meta.offerPriceLine ?? meta.priceLine ?? null;
  const monthlyRate = meta.monthlyRate ?? null;

  const parts = [];
  if (paymentLabel && conditions) {
    parts.push(`${paymentLabel} · ${conditions}`);
  } else if (conditions) {
    parts.push(conditions);
  } else if (paymentLabel) {
    parts.push(paymentLabel);
  }

  let rateDisplay = null;
  if (monthlyRate != null && monthlyRate !== '') {
    const num = Number(monthlyRate);
    rateDisplay = Number.isFinite(num)
      ? `${num.toLocaleString('de-DE')} €/Monat`
      : String(monthlyRate);
  } else if (priceLine) {
    rateDisplay = priceLine.replace(' /Monat', '/Monat').replace(' € /Monat', ' €/Monat');
  }

  return {
    conditionsLine: parts.join(' · ') || null,
    rateLine: rateDisplay,
  };
}

function resolveMainConcern(primaryItem = {}, groupItems = []) {
  const questionItem = groupItems.find((item) => (
    item.type === INBOX_EVENT_TYPES.OFFER_QUESTION
    || item.type === INBOX_EVENT_TYPES.CUSTOMER_QUESTION
    || item.type === INBOX_EVENT_TYPES.SPECIAL_QUESTION
    || (item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE && item.message)
  ));
  if (questionItem) {
    const msg = getInboxDisplayMessage(questionItem);
    if (msg) return msg;
  }

  const message = getInboxDisplayMessage(primaryItem);
  if (message && !/^Kunde hat/i.test(message)) return message;

  if (primaryItem.type === INBOX_EVENT_TYPES.OFFER_INTERESTED) {
    return 'Kunde hat diese Variante als interessant markiert.';
  }
  if (primaryItem.type === INBOX_EVENT_TYPES.OFFER_OPENED) {
    return getInboxDisplayMessage(primaryItem) || 'Kunde hat das Angebot geöffnet.';
  }
  if (primaryItem.type === INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED) {
    return 'Selbstauskunft liegt zur Prüfung bereit.';
  }
  if (isDocumentType(primaryItem.type)) {
    return getInboxDisplayMessage(primaryItem) || 'Neue Unterlage vom Kunden.';
  }

  return primaryItem.title || 'Kundenmeldung';
}

function buildWorkCardGroupKey(item = {}) {
  const leadId = item.leadId ?? item.customerId ?? 'unknown';
  const offerId = item.offerId ?? 'general';
  return `${leadId}::${offerId}`;
}

function collectSignals(groupItems = [], primaryItem = {}) {
  const labels = [];
  const seen = new Set();
  groupItems.forEach((item) => {
    const label = getInboxSignalLabel(item.type);
    if (!label || item.id === primaryItem.id) return;
    if (seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  });
  return labels;
}

export function buildInboxWorkCardView(primaryItem = {}, groupItems = []) {
  const items = groupItems.length ? groupItems : [primaryItem];
  const next = resolveInboxNextStep(primaryItem, items);
  const primary = next.primaryItem;
  const offerContext = resolveInboxOfferContext(primary);
  const warmth = computeInboxWarmth(items);
  const signals = collectSignals(items, primary);

  return {
    id: primary.id,
    primaryItem: primary,
    groupItems: items,
    customerTitle: buildInboxCustomerTitle(primary),
    offerContext,
    mainConcern: resolveMainConcern(primary, items),
    signals,
    warmth,
    warmthLabel: warmth ? INBOX_WARMTH_LABELS[warmth] : null,
    nextStepLabel: next.stepLabel,
    actionLabel: next.actionLabel,
    actionTarget: next.actionTarget,
    workPriority: getInboxWorkPriority(primary),
    createdAt: items.reduce((latest, item) => (
      !latest || new Date(item.createdAt) > new Date(latest) ? item.createdAt : latest
    ), primary.createdAt),
    isGrouped: items.length > 1,
  };
}

/**
 * Gruppiert offene Items zu Arbeitskarten (UI-Schärfung: ein Fall pro Kunde+Angebot).
 */
export function buildInboxWorkCards(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const key = buildWorkCardGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const cards = [...groups.values()].map((groupItems) => {
    const sorted = [...groupItems].sort((a, b) => {
      const prio = getInboxWorkPriority(a) - getInboxWorkPriority(b);
      if (prio !== 0) return prio;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return buildInboxWorkCardView(sorted[0], sorted);
  });

  return sortInboxWorkCards(cards);
}

export function sortInboxWorkCards(cards = []) {
  return [...cards].sort((a, b) => {
    if (a.workPriority !== b.workPriority) return a.workPriority - b.workPriority;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

export function isWarmOfferWorkCard(card = {}) {
  if (!card.warmth) return false;
  return card.warmth === INBOX_WARMTH.WARM
    || card.warmth === INBOX_WARMTH.HOT
    || card.warmth === INBOX_WARMTH.URGENT;
}

export function isTodayImportantWorkCard(card = {}) {
  if (!card.warmth) return card.workPriority <= 20;
  return card.warmth === INBOX_WARMTH.URGENT
    || card.warmth === INBOX_WARMTH.HOT
    || card.workPriority <= 20;
}

export function filterWorkCardsByTodayImportant(cards = []) {
  return cards.filter(isTodayImportantWorkCard);
}

export function countUniqueOpenCustomers(items = []) {
  const ids = new Set(
    items.map((item) => item.leadId ?? item.customerId).filter(Boolean),
  );
  return ids.size;
}

export function countUrgentQuestions(items = []) {
  return items.filter((item) => (
    isQuestionType(item.type) && isInboxItemUrgent(item)
  )).length;
}

export function countWarmOffersFromWorkCards(cards = []) {
  return cards.filter((card) => (
    isWarmOfferWorkCard(card)
    && card.groupItems.some((item) => isOfferReactionType(item.type))
  )).length;
}

function countLabel(count, singular, plural = `${singular}n`) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

/**
 * Hero-Zusammenfassung für Clever Eingang (Arbeitskarten-basiert).
 */
export function buildInboxHeroSummary(openItems = [], categoryCounts = {}) {
  const workCards = buildInboxWorkCards(openItems);
  const openCustomerCount = countUniqueOpenCustomers(openItems);
  const urgentQuestionCount = countUrgentQuestions(openItems);
  const warmOfferCount = countWarmOffersFromWorkCards(workCards);

  const heroParts = [];
  if (openCustomerCount > 0) {
    heroParts.push(countLabel(openCustomerCount, 'offener Kunde', 'offene Kunden'));
  }
  if (urgentQuestionCount > 0) {
    heroParts.push(countLabel(urgentQuestionCount, 'dringende Frage', 'dringende Fragen'));
  }
  if (warmOfferCount > 0) {
    heroParts.push(countLabel(warmOfferCount, 'warmes Angebot', 'warme Angebote'));
  }

  const heroLine = heroParts.length
    ? heroParts.join(' · ')
    : 'Keine offenen Arbeitskarten';

  const statCards = [
    { id: 'questions', label: 'Fragen', count: categoryCounts.questionCount ?? 0 },
    { id: 'warmOffers', label: 'Warme Angebote', count: warmOfferCount },
    { id: 'documents', label: 'Unterlagen', count: categoryCounts.documentCount ?? 0 },
  ];

  const primaryWorkCard = workCards[0] ?? null;

  return {
    workCardCount: workCards.length,
    openCustomerCount,
    urgentQuestionCount,
    warmOfferCount,
    heroLine,
    statCards,
    primaryWorkCard,
    workCards,
  };
}

/**
 * Prüft, ob ein String technische Eventnamen enthält (für UI-Tests).
 */
export function containsTechnicalEventName(text = '') {
  const raw = String(text);
  return Object.values(INBOX_EVENT_TYPES).some((type) => raw.includes(type));
}
