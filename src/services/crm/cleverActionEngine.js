/**
 * Clever Action Engine – genau eine primäre Empfehlung pro Kundenakte
 */
import { computeUnterlagenSummary } from '../cleverUnterlagen.js';
import { needsSelbstauskunft, getSelbstauskunft, SELBSTAUSKUNFT_STATUS } from '../cleverSelbstauskunft.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { getCustomerFirstName } from '../customerAkte.js';

export const CLEVER_ACTION_IDS = {
  DELIVERY_READY: 'delivery_ready',
  VEHICLE_ARRIVING: 'vehicle_arriving',
  LEASING_APPROVED: 'leasing_approved',
  LEASING_READY: 'leasing_ready',
  DOCUMENTS_MISSING: 'documents_missing',
  OFFER_OPENED_CALL: 'offer_opened_call',
  OFFER_SEND: 'offer_send',
  OFFER_FOLLOWUP: 'offer_followup',
  GENERAL_REMINDER: 'general_reminder',
};

/** Niedrigere Zahl = höhere Priorität */
export const CLEVER_ACTION_PRIORITY = {
  [CLEVER_ACTION_IDS.DELIVERY_READY]: 10,
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: 20,
  [CLEVER_ACTION_IDS.LEASING_APPROVED]: 30,
  [CLEVER_ACTION_IDS.LEASING_READY]: 40,
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: 50,
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: 60,
  [CLEVER_ACTION_IDS.OFFER_SEND]: 70,
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: 80,
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: 90,
};

const ACTION_DEFINITIONS = {
  [CLEVER_ACTION_IDS.DELIVERY_READY]: {
    title: 'Fahrzeug übergeben',
    ctaLabel: 'Übergabetermin bestätigen',
    handlerType: 'delivery_handover',
  },
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: {
    title: 'Auslieferung planen',
    ctaLabel: 'Termin vereinbaren',
    handlerType: 'delivery_plan',
  },
  [CLEVER_ACTION_IDS.LEASING_APPROVED]: {
    title: 'Fahrzeug bestellen',
    ctaLabel: 'Bestellung vorbereiten',
    handlerType: 'order',
  },
  [CLEVER_ACTION_IDS.LEASING_READY]: {
    title: 'Leasing einreichen',
    ctaLabel: 'Leasingantrag starten',
    handlerType: 'leasing_submit',
  },
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: {
    title: 'Unterlagen anfordern',
    ctaLabel: 'Dokumentenlink senden',
    handlerType: 'documents',
  },
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: {
    title: 'Jetzt anrufen',
    ctaLabel: 'Anrufen',
    handlerType: 'call',
  },
  [CLEVER_ACTION_IDS.OFFER_SEND]: {
    title: 'Angebot senden',
    ctaLabel: 'Angebot senden',
    handlerType: 'offer_send',
  },
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: {
    title: 'Nachfassen',
    ctaLabel: 'Kunde kontaktieren',
    handlerType: 'call',
  },
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: {
    title: 'Kontakt aufnehmen',
    ctaLabel: 'Jetzt anrufen',
    handlerType: 'call',
  },
};

const MS_PER_DAY = 86400000;

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / MS_PER_DAY);
}

function daysSinceLabel(days) {
  if (days == null || days < 0) return null;
  if (days === 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

function normalizeOfferStatus(card = {}) {
  return card.vehicleOffer?.status ?? card.offer?.status ?? null;
}

function getPrimaryOfferCard(vehicleCards = []) {
  const opened = vehicleCards.find((c) => normalizeOfferStatus(c) === VEHICLE_OFFER_STATUS.OPENED);
  if (opened) return opened;
  const sent = vehicleCards.find((c) => normalizeOfferStatus(c) === VEHICLE_OFFER_STATUS.SENT);
  if (sent) return sent;
  const ready = vehicleCards.find((c) => {
    const status = normalizeOfferStatus(c);
    return [
      VEHICLE_OFFER_STATUS.DRAFT,
      VEHICLE_OFFER_STATUS.PDF_UPLOADED,
      VEHICLE_OFFER_STATUS.LINK_READY,
    ].includes(status);
  });
  if (ready) return ready;
  return vehicleCards[0] ?? null;
}

function getOfferSentAt(card = {}) {
  return card.vehicleOffer?.sentAt
    ?? card.offer?.sentAt
    ?? card.vehicleOffer?.onlineLink?.createdAt
    ?? null;
}

function getOfferOpenedAt(card = {}) {
  return card.vehicleOffer?.tracking?.lastOpenedAt
    ?? card.offer?.openedAt
    ?? null;
}

function isUnterlagenComplete(summary) {
  if (!summary?.totalCount) return false;
  return summary.doneCount >= Math.max(1, summary.totalCount - 1);
}

function isUnterlagenMissing(summary) {
  if (!summary?.totalCount) return false;
  return summary.doneCount < Math.max(1, summary.totalCount - 1);
}

function buildActionCandidate(actionId, { reason, explanation, meta = {} }) {
  const def = ACTION_DEFINITIONS[actionId];
  if (!def) return null;
  return {
    actionId,
    title: def.title,
    reason,
    explanation,
    priority: CLEVER_ACTION_PRIORITY[actionId] ?? 99,
    ctaLabel: def.ctaLabel,
    handlerType: def.handlerType,
    whyClever: reason,
    meta,
  };
}

export function buildCleverActionContext({
  lead = null,
  vehicleCards = [],
  customerName = '',
} = {}) {
  const crm = lead?.crm ?? {};
  const paymentType = vehicleCards[0]?.paymentType ?? lead?.paymentType ?? lead?.wish?.paymentType ?? 'leasing';
  const primaryCard = getPrimaryOfferCard(vehicleCards);
  const offerStatus = normalizeOfferStatus(primaryCard);
  const unterlagenSummary = lead ? computeUnterlagenSummary(lead, paymentType) : null;
  const selbstauskunft = lead ? getSelbstauskunft(crm.cleverUnterlagen) : null;
  const selbstauskunftComplete = selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.completed.id
    || selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.checked.id;

  const vehicleFulfillmentStatus = crm.vehicleFulfillment?.status ?? null;
  const leasingStatus = crm.leasing?.status ?? null;
  const sentAt = getOfferSentAt(primaryCard);
  const openedAt = getOfferOpenedAt(primaryCard);
  const daysSinceSent = daysSince(sentAt);
  const daysSinceOpened = daysSince(openedAt);
  const daysSinceActivity = daysSince(lead?.updatedAt ?? lead?.createdAt);
  const firstName = getCustomerFirstName(customerName || lead?.contact?.name);

  return {
    lead,
    crm,
    vehicleCards,
    primaryCard,
    paymentType,
    offerStatus,
    unterlagenSummary,
    selbstauskunftComplete,
    vehicleFulfillmentStatus,
    leasingStatus,
    sentAt,
    openedAt,
    daysSinceSent,
    daysSinceOpened,
    daysSinceActivity,
    firstName,
    desiredDeliveryDate: lead?.wish?.desiredDeliveryDate ?? lead?.deliveryTime ?? null,
    hasPhone: Boolean(lead?.contact?.phone?.trim()),
    hasEmail: Boolean(lead?.contact?.email?.trim()),
  };
}

export function evaluateCleverActions(context) {
  const candidates = [];
  const {
    offerStatus,
    unterlagenSummary,
    selbstauskunftComplete,
    vehicleFulfillmentStatus,
    leasingStatus,
    daysSinceSent,
    daysSinceOpened,
    daysSinceActivity,
    firstName,
    vehicleCards,
    paymentType,
    primaryCard,
  } = context;

  if (vehicleFulfillmentStatus === 'delivery_ready' || vehicleFulfillmentStatus === 'ready_for_handover') {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.DELIVERY_READY, {
      reason: 'Fahrzeug und Zulassung fertig',
      explanation: 'Fahrzeug und Unterlagen sind bereit. Jetzt den Übergabetermin bestätigen.',
    }));
  }

  if (vehicleFulfillmentStatus === 'in_transit' || vehicleFulfillmentStatus === 'arriving') {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.VEHICLE_ARRIVING, {
      reason: 'Fahrzeug ist im Zulauf',
      explanation: 'Das Fahrzeug ist unterwegs. Ein Termin macht die Übergabe planbar.',
    }));
  }

  if (leasingStatus === 'approved') {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.LEASING_APPROVED, {
      reason: 'Leasingfreigabe liegt vor',
      explanation: 'Die Bank hat freigegeben. Jetzt die Bestellung vorbereiten.',
    }));
  }

  const docsComplete = isUnterlagenComplete(unterlagenSummary) || selbstauskunftComplete;
  const needsDocs = needsSelbstauskunft(paymentType) || paymentType === 'financing' || paymentType === 'threeWayFinancing';

  if (needsDocs && docsComplete && leasingStatus !== 'approved' && leasingStatus !== 'submitted') {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.LEASING_READY, {
      reason: 'Unterlagen vollständig',
      explanation: 'Alle Unterlagen liegen vor. Der Leasingantrag kann gestartet werden.',
    }));
  }

  const pastOfferStage = [
    VEHICLE_OFFER_STATUS.SENT,
    VEHICLE_OFFER_STATUS.OPENED,
    VEHICLE_OFFER_STATUS.ACCEPTED,
  ].includes(offerStatus);

  if (needsDocs && isUnterlagenMissing(unterlagenSummary) && !selbstauskunftComplete && pastOfferStage) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.DOCUMENTS_MISSING, {
      reason: 'Selbstauskunft oder Dokumente fehlen',
      explanation: 'Für den Abschluss fehlen noch Unterlagen. Jetzt den Dokumentenlink senden.',
    }));
  }

  if (offerStatus === VEHICLE_OFFER_STATUS.OPENED) {
    const when = daysSinceLabel(daysSinceOpened) ?? 'kürzlich';
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_OPENED_CALL, {
      reason: 'Kunde hat Angebot geöffnet',
      explanation: firstName
        ? `${firstName} hat das Angebot ${when} geöffnet. Die Abschlusswahrscheinlichkeit ist aktuell erhöht.`
        : `Der Kunde hat das Angebot ${when} geöffnet. Die Abschlusswahrscheinlichkeit ist aktuell erhöht.`,
      meta: { daysSinceOpened },
    }));
  }

  const unsentStatuses = [
    VEHICLE_OFFER_STATUS.DRAFT,
    VEHICLE_OFFER_STATUS.PDF_UPLOADED,
    VEHICLE_OFFER_STATUS.LINK_READY,
  ];
  if (primaryCard && (unsentStatuses.includes(offerStatus) || (!offerStatus && primaryCard))) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_SEND, {
      reason: 'Angebot erstellt, aber noch nicht versendet',
      explanation: 'Dieses Angebot wurde erstellt, aber noch nicht an den Kunden verschickt.',
      meta: { cardId: primaryCard.id },
    }));
  }

  if (offerStatus === VEHICLE_OFFER_STATUS.SENT && daysSinceSent != null && daysSinceSent >= 2) {
    const when = daysSinceLabel(daysSinceSent);
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_FOLLOWUP, {
      reason: `Angebot ${when} versendet`,
      explanation: firstName
        ? `${firstName} hat seit ${daysSinceSent} Tagen nicht reagiert.`
        : `Der Kunde hat seit ${daysSinceSent} Tagen nicht reagiert.`,
      meta: { daysSinceSent },
    }));
  }

  if (vehicleCards.length > 0 || daysSinceActivity != null) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.GENERAL_REMINDER, {
      reason: 'Chance warm halten',
      explanation: vehicleCards.length > 0
        ? 'Ein kurzer Kontakt bringt den nächsten Schritt ins Gespräch.'
        : 'Ein passendes Fahrzeug auf dem Tisch erleichtert den nächsten Kontakt.',
    }));
  }

  return candidates.filter(Boolean);
}

export function recommendCleverAction(context) {
  const candidates = evaluateCleverActions(context);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.priority - b.priority)[0];
}

export function buildCleverActionRecommendation(input = {}) {
  const context = buildCleverActionContext(input);
  const recommendation = recommendCleverAction(context);
  if (!recommendation) return null;

  return {
    ...recommendation,
    analyticsText: formatCleverRecommendationHistoryText(recommendation),
  };
}

export function formatCleverRecommendationHistoryText(recommendation) {
  if (!recommendation?.title) return 'Clever empfahl: Kontakt aufnehmen';
  return `Clever empfahl: ${recommendation.title}`;
}

export function formatCleverActionFollowedHistoryText(recommendation) {
  if (!recommendation?.title) return 'Clever-Empfehlung befolgt';
  return `Clever-Empfehlung befolgt: ${recommendation.title}`;
}

/** Abwärtskompatibel mit buildNextBestStepHint */
export function cleverActionToHint(recommendation, { telHref = null } = {}) {
  if (!recommendation) return null;
  const canCall = recommendation.handlerType === 'call' && Boolean(telHref);
  return {
    actionId: recommendation.actionId,
    title: recommendation.title,
    text: recommendation.explanation,
    reason: recommendation.reason,
    whyClever: recommendation.whyClever,
    cta: recommendation.ctaLabel,
    handlerType: recommendation.handlerType,
    canCall,
    action: mapHandlerToLegacyAction(recommendation.handlerType),
    analyticsText: recommendation.analyticsText,
    meta: recommendation.meta,
  };
}

function mapHandlerToLegacyAction(handlerType) {
  if (handlerType === 'documents' || handlerType === 'leasing_submit') return 'unterlagen';
  if (handlerType === 'offer_send') return 'offer_send';
  if (handlerType === 'call') return 'call';
  return handlerType;
}
