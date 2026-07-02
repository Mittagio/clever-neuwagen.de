/**
 * Clever Action Engine – genau eine primäre Empfehlung pro Kundenakte
 */
import { computeUnterlagenSummary } from '../cleverUnterlagen.js';
import { needsSelbstauskunft, getSelbstauskunft, SELBSTAUSKUNFT_STATUS } from '../cleverSelbstauskunft.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import {
  countOpenQuestions,
  getCustomerOfferInteraction,
  INTEREST_STATUS,
} from '../customerOfferInteraction.js';
import {
  findPrimaryOpenInboxItemForLead,
  INBOX_EVENT_TYPES,
  listInboxItemsForCustomer,
} from './cleverInboxService.js';
import { getCustomerFirstName, formatVehicleActionPrefix, formatSelectionActionPrefix } from '../customerAkte.js';
import {
  findPreparedSelectionGroup,
  findReactedSelectionGroup,
} from '../sales/offerSelectionGroup.js';
import {
  getCustomerPortalAccess,
  PORTAL_ACCESS_STATUS,
} from './customerPortalAccessService.js';
import { buildDealerPortalDocumentsOverview } from './customerPortalShellPresenter.js';
import { SELF_DISCLOSURE_STATUS } from './customerPortalSelfDisclosureService.js';

export const CLEVER_ACTION_IDS = {
  VEHICLE_SUGGESTION_REVIEW: 'vehicle_suggestion_review',
  DELIVERY_READY: 'delivery_ready',
  VEHICLE_ARRIVING: 'vehicle_arriving',
  LEASING_APPROVED: 'leasing_approved',
  LEASING_READY: 'leasing_ready',
  DOCUMENTS_MISSING: 'documents_missing',
  DOCUMENTS_INBOX_CHECK: 'documents_inbox_check',
  OFFER_OPENED_CALL: 'offer_opened_call',
  OFFER_SEND: 'offer_send',
  OFFER_FOLLOWUP: 'offer_followup',
  OFFER_QUESTION_ANSWER: 'offer_question_answer',
  OFFER_INTEREST_FOLLOWUP: 'offer_interest_followup',
  SELECTION_SEND: 'selection_send',
  SELECTION_FOLLOWUP: 'selection_followup',
  GENERAL_REMINDER: 'general_reminder',
  ANSWER_CUSTOMER_QUESTION: 'answer_customer_question',
  SEND_CUSTOMER_ANSWER: 'send_customer_answer',
  SHOWROOM_CAPTURE_REVIEW: 'showroom_capture_review',
  PORTAL_LINK_SEND: 'portal_link_send',
  PORTAL_LINK_FOLLOWUP: 'portal_link_followup',
  PORTAL_CODE_REMIND: 'portal_code_remind',
  PORTAL_VIEWED_FOLLOWUP: 'portal_viewed_followup',
  SELF_DISCLOSURE_REVIEW: 'self_disclosure_review',
  SELF_DISCLOSURE_REQUEST: 'self_disclosure_request',
  SELF_DISCLOSURE_FOLLOWUP: 'self_disclosure_followup',
  SELF_DISCLOSURE_CORRECTION_FOLLOWUP: 'self_disclosure_correction_followup',
  APPLICATION_PREPARE: 'application_prepare',
};

/** Niedrigere Zahl = höhere Priorität */
export const CLEVER_ACTION_PRIORITY = {
  [CLEVER_ACTION_IDS.VEHICLE_SUGGESTION_REVIEW]: 55,
  [CLEVER_ACTION_IDS.DELIVERY_READY]: 10,
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: 20,
  [CLEVER_ACTION_IDS.LEASING_APPROVED]: 30,
  [CLEVER_ACTION_IDS.LEASING_READY]: 40,
  [CLEVER_ACTION_IDS.APPLICATION_PREPARE]: 41,
  [CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK]: 54,
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: 60,
  [CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER]: 52,
  [CLEVER_ACTION_IDS.OFFER_INTEREST_FOLLOWUP]: 56,
  [CLEVER_ACTION_IDS.OFFER_SEND]: 70,
  [CLEVER_ACTION_IDS.SELECTION_FOLLOWUP]: 57,
  [CLEVER_ACTION_IDS.SELECTION_SEND]: 68,
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: 80,
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: 85,
  [CLEVER_ACTION_IDS.ANSWER_CUSTOMER_QUESTION]: 50,
  [CLEVER_ACTION_IDS.SEND_CUSTOMER_ANSWER]: 51,
  [CLEVER_ACTION_IDS.SHOWROOM_CAPTURE_REVIEW]: 48,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW]: 49,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_CORRECTION_FOLLOWUP]: 53,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP]: 55,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST]: 61,
  [CLEVER_ACTION_IDS.PORTAL_LINK_SEND]: 64,
  [CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP]: 61,
  [CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP]: 58,
  [CLEVER_ACTION_IDS.PORTAL_CODE_REMIND]: 59,
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: 90,
};

const ACTION_DEFINITIONS = {
  [CLEVER_ACTION_IDS.VEHICLE_SUGGESTION_REVIEW]: {
    title: 'Fahrzeugvorschlag prüfen',
    ctaLabel: 'Fahrzeug prüfen',
    handlerType: 'vehicle_review',
  },
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
  [CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK]: {
    title: 'Unterlagen prüfen',
    ctaLabel: 'Unterlagen öffnen',
    handlerType: 'documents',
  },
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: {
    title: 'Angebot nachfassen',
    ctaLabel: 'Kunden kontaktieren',
    handlerType: 'call',
  },
  [CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER]: {
    title: 'Kundenfrage beantworten',
    ctaLabel: 'Frage beantworten',
    handlerType: 'offer_question',
  },
  [CLEVER_ACTION_IDS.OFFER_INTEREST_FOLLOWUP]: {
    title: 'Interesse nachfassen',
    ctaLabel: 'Kunden kontaktieren',
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
  [CLEVER_ACTION_IDS.SELECTION_SEND]: {
    title: 'Auswahl senden',
    ctaLabel: 'Auswahl senden',
    handlerType: 'selection_send',
  },
  [CLEVER_ACTION_IDS.SELECTION_FOLLOWUP]: {
    title: 'Variante nachfassen',
    ctaLabel: 'Kunde kontaktieren',
    handlerType: 'call',
  },
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: {
    title: 'Kontakt aufnehmen',
    ctaLabel: 'Jetzt anrufen',
    handlerType: 'call',
  },
  [CLEVER_ACTION_IDS.ANSWER_CUSTOMER_QUESTION]: {
    title: 'Kundenfrage beantworten',
    ctaLabel: 'Antwort erstellen',
    handlerType: 'answer_customer_question',
  },
  [CLEVER_ACTION_IDS.SEND_CUSTOMER_ANSWER]: {
    title: 'Antwort an Kunden senden',
    ctaLabel: 'Antwort senden',
    handlerType: 'send_customer_answer',
  },
  [CLEVER_ACTION_IDS.SHOWROOM_CAPTURE_REVIEW]: {
    title: 'Schnellaufnahme prüfen',
    ctaLabel: 'Schnellaufnahme öffnen',
    handlerType: 'showroom_capture_review',
  },
  [CLEVER_ACTION_IDS.PORTAL_LINK_SEND]: {
    title: 'Kundenlink senden',
    ctaLabel: 'Kundenlink senden',
    handlerType: 'selection_send',
  },
  [CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP]: {
    title: 'Kundenlink nachfassen',
    ctaLabel: 'Kundenlink nachfassen',
    handlerType: 'portal_followup',
  },
  [CLEVER_ACTION_IDS.PORTAL_CODE_REMIND]: {
    title: 'Zugang prüfen',
    ctaLabel: 'Code erneut senden',
    handlerType: 'portal_code_remind',
  },
  [CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP]: {
    title: 'Angebot nachfassen',
    ctaLabel: 'Angebot nachfassen',
    handlerType: 'portal_viewed_followup',
  },
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW]: {
    title: 'Selbstauskunft prüfen',
    ctaLabel: 'Selbstauskunft prüfen',
    handlerType: 'self_disclosure_review',
  },
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_CORRECTION_FOLLOWUP]: {
    title: 'Korrektur nachfassen',
    ctaLabel: 'Kunden kontaktieren',
    handlerType: 'portal_followup',
  },
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP]: {
    title: 'Selbstauskunft nachfassen',
    ctaLabel: 'Kunden erinnern',
    handlerType: 'portal_followup',
  },
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST]: {
    title: 'Selbstauskunft anfordern',
    ctaLabel: 'Unterlagen öffnen',
    handlerType: 'documents',
  },
  [CLEVER_ACTION_IDS.APPLICATION_PREPARE]: {
    title: 'Antrag vorbereiten',
    ctaLabel: 'Unterlagen ansehen',
    handlerType: 'unterlagen',
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
  if (!card) return null;
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
  if (!card) return null;
  return card.vehicleOffer?.sentAt
    ?? card.offer?.sentAt
    ?? card.vehicleOffer?.onlineLink?.createdAt
    ?? null;
}

function getOfferOpenedAt(card = {}) {
  if (!card) return null;
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

function buildActionCandidate(actionId, {
  reason,
  explanation,
  meta = {},
  vehicleCard = null,
  selectionGroup = null,
}) {
  const def = ACTION_DEFINITIONS[actionId];
  if (!def) return null;

  let title = def.title;
  let ctaLabel = def.ctaLabel;

  const vehiclePrefix = formatVehicleActionPrefix(vehicleCard);
  if (vehiclePrefix) {
    if (actionId === CLEVER_ACTION_IDS.OFFER_SEND) {
      title = `${vehiclePrefix}-Angebot senden`;
      ctaLabel = title;
    } else if (actionId === CLEVER_ACTION_IDS.VEHICLE_SUGGESTION_REVIEW) {
      title = `${vehiclePrefix}-Vorschlag prüfen`;
      ctaLabel = title;
    } else if (actionId === CLEVER_ACTION_IDS.OFFER_OPENED_CALL) {
      title = `${vehiclePrefix}: Angebot nachfassen`;
      ctaLabel = 'Kunden kontaktieren';
    } else if (actionId === CLEVER_ACTION_IDS.OFFER_FOLLOWUP) {
      title = `${vehiclePrefix}: Nachfassen`;
      ctaLabel = 'Kunde kontaktieren';
    }
  }

  const selectionPrefix = formatSelectionActionPrefix(selectionGroup);
  if (selectionGroup) {
    if (actionId === CLEVER_ACTION_IDS.SELECTION_SEND) {
      title = `${selectionPrefix}-Auswahl senden`;
      ctaLabel = title;
    } else if (actionId === CLEVER_ACTION_IDS.SELECTION_FOLLOWUP) {
      title = `${selectionPrefix}-Variante nachfassen`;
      ctaLabel = 'Kunde kontaktieren';
    }
  }

  return {
    actionId,
    title,
    reason,
    explanation,
    priority: CLEVER_ACTION_PRIORITY[actionId] ?? 99,
    ctaLabel,
    handlerType: def.handlerType,
    whyClever: reason,
    meta,
  };
}

function findCardWithOpenQuestion(vehicleCards = [], lead = null) {
  return vehicleCards.find((card) => {
    const interaction = getCustomerOfferInteraction(lead, card.id);
    return countOpenQuestions(interaction) > 0;
  }) ?? null;
}

function findInterestedCard(vehicleCards = [], lead = null) {
  return vehicleCards.find((card) => {
    const interaction = getCustomerOfferInteraction(lead, card.id);
    if (interaction?.interestStatus === INTEREST_STATUS.INTERESTED) return true;
    return normalizeOfferStatus(card) === VEHICLE_OFFER_STATUS.ACCEPTED;
  }) ?? null;
}

export function buildCleverActionContext({
  lead = null,
  vehicleCards = [],
  offerSelectionGroups = [],
  customerName = '',
} = {}) {
  const crm = lead?.crm ?? {};
  const groups = offerSelectionGroups.length
    ? offerSelectionGroups
    : (crm.offerSelectionGroups ?? []);
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
    offerSelectionGroups: groups,
    preparedSelectionGroup: findPreparedSelectionGroup(groups),
    reactedSelectionGroup: findReactedSelectionGroup(groups),
    primaryCard,
    paymentType,
    offerStatus,
    questionCard: findCardWithOpenQuestion(vehicleCards, lead),
    interestedCard: findInterestedCard(vehicleCards, lead),
    inboxItems: lead?.id ? listInboxItemsForCustomer(lead.id) : [],
    primaryInboxItem: lead?.id
      ? findPrimaryOpenInboxItemForLead(lead.id, [
        INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
        INBOX_EVENT_TYPES.OFFER_QUESTION,
        INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
      ])
      : null,
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
    lead,
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
    preparedSelectionGroup,
    reactedSelectionGroup,
    questionCard,
    interestedCard,
    inboxItems,
    primaryInboxItem,
  } = context;

  const specialQuestion = lead?.specialCustomerQuestion;
  const specialAnswer = lead?.specialQuestionAnswer;

  if (specialQuestion?.status === 'needs_dealer_check' && !specialAnswer?.answerText) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.ANSWER_CUSTOMER_QUESTION, {
      reason: 'Spezielle Kundenfrage',
      explanation: 'Der Kunde hat eine spezielle Frage zum Fahrzeug gestellt.',
      meta: { questionText: specialQuestion.rawText },
    }));
  } else if (specialAnswer?.answerText && !specialAnswer?.sentAt) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SEND_CUSTOMER_ANSWER, {
      reason: 'Antwort vorbereitet',
      explanation: 'Die Antwort zur Kundenfrage ist bereit – jetzt an den Kunden senden.',
      meta: { knowledgeAnswerId: specialAnswer.knowledgeAnswerId ?? null },
    }));
  }

  if (lead?.crm?.hasPendingShowroomCapture && lead?.crm?.pendingShowroomCapture?.status === 'pending') {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SHOWROOM_CAPTURE_REVIEW, {
      reason: 'Showroom Schnellaufnahme',
      explanation: 'Neue Schnellaufnahme aus dem Showroom Modus – bitte prüfen und übernehmen.',
      meta: { captureId: lead.crm.pendingShowroomCapture.id },
    }));
  }

  if (primaryInboxItem) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER, {
      reason: 'Kundenfrage im Clever Eingang',
      explanation: primaryInboxItem.message || 'Der Kunde hat eine Frage gestellt.',
      meta: { cardId: primaryInboxItem.offerId, inboxItemId: primaryInboxItem.id },
      vehicleCard: vehicleCards.find((card) => card.id === primaryInboxItem.offerId) ?? primaryCard,
    }));
  }

  const uploadedDocItem = inboxItems.find((item) => item.type === INBOX_EVENT_TYPES.DOCUMENT_UPLOADED);
  if (uploadedDocItem) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK, {
      reason: 'Unterlage hochgeladen',
      explanation: uploadedDocItem.message || 'Der Kunde hat eine Unterlage hochgeladen.',
      meta: { inboxItemId: uploadedDocItem.id },
      vehicleCard: primaryCard,
    }));
  }

  const selfDisclosure = context.lead?.crm?.selfDisclosure;
  const sdStatus = selfDisclosure?.status ?? SELF_DISCLOSURE_STATUS.NOT_STARTED;
  const applicationDocsOverview = buildDealerPortalDocumentsOverview(context.lead);
  const sdInboxItem = inboxItems.find((item) => item.type === INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED);

  if (sdInboxItem) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW, {
      reason: 'Selbstauskunft eingereicht',
      explanation: sdInboxItem.message || 'Der Kunde hat die Selbstauskunft abgesendet.',
      meta: { inboxItemId: sdInboxItem.id },
    }));
  } else if (sdStatus === SELF_DISCLOSURE_STATUS.SUBMITTED) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW, {
      reason: 'Selbstauskunft eingereicht',
      explanation: 'Der Kunde hat die Selbstauskunft abgesendet. Jetzt prüfen.',
    }));
  } else if (sdStatus === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELF_DISCLOSURE_CORRECTION_FOLLOWUP, {
      reason: 'Korrektur ausstehend',
      explanation: 'Der Kunde muss die Selbstauskunft korrigieren. Kurz nachfassen.',
    }));
  } else if (sdStatus === SELF_DISCLOSURE_STATUS.IN_PROGRESS) {
    const daysSinceSd = daysSince(selfDisclosure?.lastSavedAt ?? selfDisclosure?.startedAt);
    if (daysSinceSd != null && daysSinceSd >= 1) {
      candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP, {
        reason: 'Selbstauskunft unvollständig',
        explanation: 'Der Kunde hat die Selbstauskunft begonnen, aber noch nicht abgeschlossen.',
      }));
    }
  }

  if (applicationDocsOverview.allDone
    && (sdStatus === SELF_DISCLOSURE_STATUS.REVIEWED || !selfDisclosure)
    && applicationDocsOverview.evidence.total > 0) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.APPLICATION_PREPARE, {
      reason: 'Antrag vorbereiten',
      explanation: 'Selbstauskunft und Nachweise sind vollständig. Jetzt den Antrag vorbereiten.',
    }));
  }

  if (questionCard && !primaryInboxItem) {
    const openCount = countOpenQuestions(getCustomerOfferInteraction(context.lead, questionCard.id));
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER, {
      reason: 'Kunde hat eine Frage gestellt',
      explanation: openCount > 1
        ? `Der Kunde hat ${openCount} offene Fragen zu einem Angebot.`
        : 'Der Kunde hat eine Frage zu einem Angebot gestellt.',
      meta: { cardId: questionCard.id },
      vehicleCard: questionCard,
    }));
  }

  if (interestedCard && interestedCard.id !== questionCard?.id) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_INTEREST_FOLLOWUP, {
      reason: 'Kunde hat Interesse markiert',
      explanation: firstName
        ? `${firstName} hat Interesse an einem Vorschlag gezeigt.`
        : 'Der Kunde hat Interesse an einem Vorschlag gezeigt.',
      meta: { cardId: interestedCard.id },
      vehicleCard: interestedCard,
    }));
  }

  if (reactedSelectionGroup) {
    const variantCount = reactedSelectionGroup.variants?.length ?? 0;
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELECTION_FOLLOWUP, {
      reason: 'Kunde hat auf eine Variante reagiert',
      explanation: firstName
        ? `${firstName} hat eine Variante der Clever Auswahl markiert. Jetzt persönlich nachfassen.`
        : 'Der Kunde hat eine Variante der Clever Auswahl markiert. Jetzt persönlich nachfassen.',
      meta: { groupId: reactedSelectionGroup.id, variantCount },
      selectionGroup: reactedSelectionGroup,
    }));
  }

  const portalAccess = getCustomerPortalAccess(context.lead);
  if (portalAccess) {
    const portfolio = context.lead?.crm?.customerOfferPortfolio;
    const hasPortfolioReaction = (portfolio?.items ?? []).some(
      (item) => item.customerReaction?.status && item.customerReaction.status !== 'none',
    );

    if (portalAccess.status === PORTAL_ACCESS_STATUS.PREPARED) {
      candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.PORTAL_LINK_SEND, {
        reason: 'Kundenlink vorbereitet',
        explanation: 'Der persönliche Kundenlink ist vorbereitet – jetzt an den Kunden senden.',
      }));
    } else if (portalAccess.status === PORTAL_ACCESS_STATUS.SENT && !portalAccess.openedAt) {
      candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP, {
        reason: 'Kundenlink noch nicht geöffnet',
        explanation: 'Der Kunde hat den Link noch nicht geöffnet. Kurz nachfassen oder Link erneut senden.',
      }));
    } else if (portalAccess.status === PORTAL_ACCESS_STATUS.OPENED && !portalAccess.verifiedAt) {
      candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.PORTAL_CODE_REMIND, {
        reason: 'Zugang noch nicht bestätigt',
        explanation: 'Der Kunde hat den Link geöffnet, den Code aber noch nicht bestätigt.',
      }));
    } else if (portalAccess.status === PORTAL_ACCESS_STATUS.VIEWED && !hasPortfolioReaction) {
      candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP, {
        reason: 'Auswahl angesehen',
        explanation: 'Der Kunde hat die Fahrzeugauswahl angesehen, aber noch nicht reagiert.',
      }));
      if (sdStatus === SELF_DISCLOSURE_STATUS.NOT_STARTED) {
        candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST, {
          reason: 'Selbstauskunft noch offen',
          explanation: 'Der Kunde hat das Portal angesehen, die Selbstauskunft aber noch nicht gestartet.',
        }));
      }
    }
  } else if (preparedSelectionGroup && !reactedSelectionGroup) {
    const variantCount = preparedSelectionGroup.variants?.length ?? 0;
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.SELECTION_SEND, {
      reason: 'Clever Auswahl vorbereitet',
      explanation: variantCount > 1
        ? `${variantCount} passende Varianten sind vorbereitet.`
        : 'Eine passende Variante ist vorbereitet.',
      meta: { groupId: preparedSelectionGroup.id, variantCount },
      selectionGroup: preparedSelectionGroup,
    }));
  }

  const suggestionCard = vehicleCards.find((card) => card.badge === 'Vorschlag / prüfen')
    ?? vehicleCards.find((card) => /vorschlag/i.test(card.badge ?? ''));

  if (suggestionCard && !['sent', 'opened', 'accepted', 'draft'].includes(offerStatus)) {
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.VEHICLE_SUGGESTION_REVIEW, {
      reason: 'KI-Fahrzeugwunsch erkannt',
      explanation: 'Clever hat einen möglichen Fahrzeugwunsch erkannt. Bitte prüfen oder konfigurieren.',
      meta: { cardId: suggestionCard.id },
      vehicleCard: suggestionCard,
    }));
  }

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

  if (offerStatus === VEHICLE_OFFER_STATUS.OPENED && !questionCard) {
    const when = daysSinceLabel(daysSinceOpened) ?? 'kürzlich';
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_OPENED_CALL, {
      reason: 'Kunde hat Angebot geöffnet',
      explanation: firstName
        ? `${firstName} hat das Angebot ${when} geöffnet.`
        : `Der Kunde hat das Angebot ${when} geöffnet.`,
      meta: { daysSinceOpened, cardId: primaryCard?.id },
      vehicleCard: primaryCard,
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
      vehicleCard: primaryCard,
    }));
  }

  if (offerStatus === VEHICLE_OFFER_STATUS.SENT && daysSinceSent != null && daysSinceSent >= 2) {
    const when = daysSinceLabel(daysSinceSent);
    candidates.push(buildActionCandidate(CLEVER_ACTION_IDS.OFFER_FOLLOWUP, {
      reason: `Angebot ${when} versendet`,
      explanation: firstName
        ? `${firstName} hat seit ${daysSinceSent} Tagen nicht reagiert.`
        : `Der Kunde hat seit ${daysSinceSent} Tagen nicht reagiert.`,
      meta: { daysSinceSent, cardId: primaryCard?.id },
      vehicleCard: primaryCard,
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
  if (handlerType === 'selection_send') return 'selection_send';
  if (handlerType === 'call') return 'call';
  if (handlerType === 'self_disclosure_review') return 'self_disclosure_review';
  return handlerType;
}
