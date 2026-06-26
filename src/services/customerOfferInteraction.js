/**
 * Kundenreaktionen auf Angebotsvorschläge (Kundenlink).
 */
import { VEHICLE_OFFER_STATUS } from './vehicleOffer.js';

export const INTEREST_STATUS = {
  NOT_SEEN: 'not_seen',
  OPENED: 'opened',
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  QUESTION_ASKED: 'question_asked',
  CONTACT_REQUESTED: 'contact_requested',
};

export const BOARD_BADGE = {
  draft: { label: 'Entwurf', tone: 'muted' },
  sent: { label: 'Gesendet', tone: 'muted' },
  opened: { label: 'Geöffnet', tone: 'accent' },
  interested: { label: 'Interessiert', tone: 'accent' },
  question: { label: 'Frage offen', tone: 'warn' },
  rejected: { label: 'Abgelehnt', tone: 'muted' },
  closing_ready: { label: 'Abschlussbereit', tone: 'accent' },
};

function uid(prefix = 'q') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {string} offerId
 * @param {string|null} customerId
 */
export function createEmptyInteraction(offerId, customerId = null) {
  return {
    offerId,
    customerId,
    openedAt: null,
    lastViewedAt: null,
    interestStatus: INTEREST_STATUS.NOT_SEEN,
    customerQuestions: [],
    customerFeedback: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} lead
 * @param {string} vehicleCardId
 */
export function getCustomerOfferInteraction(lead = {}, vehicleCardId = '') {
  const stored = lead?.crm?.customerOfferInteractions?.[vehicleCardId];
  if (!stored) return null;
  return {
    ...createEmptyInteraction(vehicleCardId, lead?.id ?? null),
    ...stored,
    offerId: stored.offerId ?? vehicleCardId,
    customerQuestions: Array.isArray(stored.customerQuestions) ? stored.customerQuestions : [],
  };
}

/**
 * @param {object} lead
 * @param {string} vehicleCardId
 * @param {object} patch
 */
export function mergeCustomerOfferInteractionPatch(lead = {}, vehicleCardId, patch) {
  const current = lead?.crm?.customerOfferInteractions ?? {};
  const prev = current[vehicleCardId] ?? createEmptyInteraction(vehicleCardId, lead?.id ?? null);
  return {
    ...current,
    [vehicleCardId]: {
      ...prev,
      ...patch,
      offerId: vehicleCardId,
      customerId: lead?.id ?? prev.customerId ?? null,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * @param {object} interaction
 */
export function recordCustomerOpened(interaction = {}) {
  const now = new Date().toISOString();
  return {
    ...interaction,
    openedAt: interaction.openedAt ?? now,
    lastViewedAt: now,
    interestStatus: interaction.interestStatus === INTEREST_STATUS.NOT_SEEN
      ? INTEREST_STATUS.OPENED
      : interaction.interestStatus,
    updatedAt: now,
  };
}

/**
 * @param {object} interaction
 */
export function recordCustomerDeclined(interaction = {}) {
  return {
    ...interaction,
    interestStatus: INTEREST_STATUS.NOT_INTERESTED,
    customerFeedback: interaction.customerFeedback ?? 'Passt nicht',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} interaction
 */
export function recordCustomerInterested(interaction = {}) {
  return {
    ...interaction,
    interestStatus: INTEREST_STATUS.INTERESTED,
    customerFeedback: interaction.customerFeedback ?? 'Interessiert',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} interaction
 */
export function addCustomerQuestion(interaction = {}, text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return interaction;
  const question = {
    id: uid('cq'),
    text: trimmed,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  return {
    ...interaction,
    interestStatus: INTEREST_STATUS.QUESTION_ASKED,
    customerQuestions: [...(interaction.customerQuestions ?? []), question],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} interaction
 */
export function countOpenQuestions(interaction = null) {
  if (!interaction?.customerQuestions?.length) return 0;
  return interaction.customerQuestions.filter((q) => q.status === 'open').length;
}

function resolveInterestFromOffer(vehicleOffer = {}) {
  const status = vehicleOffer?.status;
  if (status === VEHICLE_OFFER_STATUS.ACCEPTED) return INTEREST_STATUS.INTERESTED;
  if (status === VEHICLE_OFFER_STATUS.REJECTED) return INTEREST_STATUS.NOT_INTERESTED;
  if (status === VEHICLE_OFFER_STATUS.OPENED) return INTEREST_STATUS.OPENED;
  if (status === VEHICLE_OFFER_STATUS.SENT) return INTEREST_STATUS.NOT_SEEN;
  return null;
}

function resolveBadgeFromOffer(vehicleOffer = {}) {
  const status = vehicleOffer?.status;
  if (status === VEHICLE_OFFER_STATUS.REJECTED) return BOARD_BADGE.rejected;
  if (status === VEHICLE_OFFER_STATUS.ACCEPTED) return BOARD_BADGE.interested;
  if (status === VEHICLE_OFFER_STATUS.OPENED) return BOARD_BADGE.opened;
  if (status === VEHICLE_OFFER_STATUS.SENT) return BOARD_BADGE.sent;
  if (
    status === VEHICLE_OFFER_STATUS.DRAFT
    || status === VEHICLE_OFFER_STATUS.PDF_UPLOADED
    || status === VEHICLE_OFFER_STATUS.LINK_READY
    || !status
  ) {
    return BOARD_BADGE.draft;
  }
  return BOARD_BADGE.draft;
}

/**
 * Board-Badge mit Priorität: Frage offen > Interessiert > Geöffnet > Gesendet > Entwurf
 *
 * @param {object} card
 * @param {object|null} interaction
 * @param {object|null} vehicleOffer
 * @param {object} [options]
 */
export function resolveBoardBadge(card = {}, interaction = null, vehicleOffer = null, options = {}) {
  const vo = vehicleOffer ?? card.vehicleOffer ?? null;
  const openQuestions = countOpenQuestions(interaction);

  if (openQuestions > 0 || interaction?.interestStatus === INTEREST_STATUS.QUESTION_ASKED) {
    return { ...BOARD_BADGE.question, openQuestionCount: openQuestions || 1 };
  }

  if (interaction?.interestStatus === INTEREST_STATUS.INTERESTED) {
    return BOARD_BADGE.interested;
  }

  if (
    interaction?.interestStatus === INTEREST_STATUS.OPENED
    || interaction?.interestStatus === INTEREST_STATUS.CONTACT_REQUESTED
  ) {
    return BOARD_BADGE.opened;
  }

  if (interaction?.interestStatus === INTEREST_STATUS.NOT_INTERESTED) {
    return BOARD_BADGE.rejected;
  }

  if (options.closingReady) {
    return BOARD_BADGE.closing_ready;
  }

  return resolveBadgeFromOffer(vo);
}

/**
 * @param {object} interaction
 * @param {object|null} vehicleOffer
 */
export function resolveEffectiveInterestStatus(interaction = null, vehicleOffer = null) {
  if (interaction?.interestStatus && interaction.interestStatus !== INTEREST_STATUS.NOT_SEEN) {
    return interaction.interestStatus;
  }
  return resolveInterestFromOffer(vehicleOffer) ?? INTEREST_STATUS.NOT_SEEN;
}

/**
 * @param {object} interaction
 * @param {object|null} vehicleOffer
 * @returns {Array<{ id: string, label: string, at?: string }>}
 */
export function buildCustomerReactionLines(interaction = null, vehicleOffer = null) {
  const lines = [];
  const openedAt = interaction?.openedAt
    ?? interaction?.lastViewedAt
    ?? vehicleOffer?.tracking?.firstOpenedAt
    ?? vehicleOffer?.tracking?.lastOpenedAt;

  if (openedAt) {
    lines.push({
      id: 'opened',
      label: 'Geöffnet',
      at: openedAt,
    });
  }

  const interest = resolveEffectiveInterestStatus(interaction, vehicleOffer);
  if (interest === INTEREST_STATUS.INTERESTED) {
    lines.push({ id: 'interested', label: 'Interesse markiert' });
  }
  if (interest === INTEREST_STATUS.NOT_INTERESTED) {
    lines.push({ id: 'rejected', label: 'Abgelehnt' });
  }
  if (interest === INTEREST_STATUS.CONTACT_REQUESTED) {
    lines.push({ id: 'contact', label: 'Kontakt angefordert' });
  }

  return lines;
}

/**
 * @param {object|null} vehicleOffer
 */
export function resolveLinkStatusLabel(vehicleOffer = null) {
  if (!vehicleOffer) return 'Noch nicht vorbereitet';
  const status = vehicleOffer.status;
  if (status === VEHICLE_OFFER_STATUS.SENT) return 'Gesendet';
  if (status === VEHICLE_OFFER_STATUS.OPENED) return 'Geöffnet';
  if (status === VEHICLE_OFFER_STATUS.ACCEPTED) return 'Kunde interessiert';
  if (status === VEHICLE_OFFER_STATUS.REJECTED) return 'Kunde abgelehnt';
  if (vehicleOffer.onlineLink?.url) return 'Link vorbereitet';
  if (status === VEHICLE_OFFER_STATUS.PDF_UPLOADED) return 'PDF hinterlegt';
  return 'Entwurf';
}
