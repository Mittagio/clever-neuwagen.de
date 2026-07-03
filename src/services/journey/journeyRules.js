/**
 * Journey-Signale aus vorhandenen Daten lesen – keine neue Datenhaltung.
 */
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { resolveOfferSelectionGroups } from '../sales/offerSelectionGroup.js';
import {
  resolveBoardOfferStatus,
  BOARD_OFFER_STATUS,
  hasCalculatedOfferPayment,
} from '../dealer/boardOfferModel.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import {
  getCustomerOfferInteraction,
  INTEREST_STATUS,
} from '../customerOfferInteraction.js';
import { getCustomerPortalAccess, PORTAL_ACCESS_STATUS } from '../crm/customerPortalAccessService.js';
import { computeUnterlagenSummary } from '../cleverUnterlagen.js';
import { getSelbstauskunft, SELBSTAUSKUNFT_STATUS } from '../cleverSelbstauskunft.js';
import { listInboxItemsForCustomer } from '../crm/cleverInboxService.js';
import { pipelineToLeadStatus } from '../dealerAiLeadCrm.js';
import {
  CANONICAL_OFFER_RANK,
  CANONICAL_OFFER_STATE,
  getCanonicalOfferStateLabel,
} from './journeyTypes.js';

const MS_PER_DAY = 86400000;

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / MS_PER_DAY);
}

function mapVehicleOfferStatusToCanonical(status) {
  if (!status) return null;
  if (status === VEHICLE_OFFER_STATUS.ACCEPTED) return CANONICAL_OFFER_STATE.ACCEPTED;
  if (status === VEHICLE_OFFER_STATUS.REJECTED) return CANONICAL_OFFER_STATE.REJECTED;
  if (status === VEHICLE_OFFER_STATUS.OPENED) return CANONICAL_OFFER_STATE.OPENED;
  if (status === VEHICLE_OFFER_STATUS.SENT) return CANONICAL_OFFER_STATE.SENT;
  if (
    status === VEHICLE_OFFER_STATUS.LINK_READY
    || status === VEHICLE_OFFER_STATUS.PDF_UPLOADED
  ) {
    return CANONICAL_OFFER_STATE.CREATED;
  }
  if (status === VEHICLE_OFFER_STATUS.DRAFT) return CANONICAL_OFFER_STATE.DRAFT;
  return null;
}

function mapBoardStatusToCanonical(boardStatus) {
  if (boardStatus === BOARD_OFFER_STATUS.OFFER_SENT) return CANONICAL_OFFER_STATE.SENT;
  if (boardStatus === BOARD_OFFER_STATUS.OFFER_CREATED) return CANONICAL_OFFER_STATE.CREATED;
  if (boardStatus === BOARD_OFFER_STATUS.INTERESTED) return CANONICAL_OFFER_STATE.ACCEPTED;
  if (boardStatus === BOARD_OFFER_STATUS.DECLINED) return CANONICAL_OFFER_STATE.REJECTED;
  if (boardStatus === BOARD_OFFER_STATUS.DRAFT) return CANONICAL_OFFER_STATE.DRAFT;
  return null;
}

function canonicalFromCard(card, lead) {
  const interaction = getCustomerOfferInteraction(lead, card.id);
  const vehicleOfferStatus = card.vehicleOffer?.status ?? card.offer?.status ?? null;
  const boardStatus = resolveBoardOfferStatus(card, lead);

  const candidates = [
    mapVehicleOfferStatusToCanonical(vehicleOfferStatus),
    mapBoardStatusToCanonical(boardStatus),
  ];

  if (interaction?.interestStatus === INTEREST_STATUS.INTERESTED) {
    candidates.push(CANONICAL_OFFER_STATE.ACCEPTED);
  }
  if (interaction?.interestStatus === INTEREST_STATUS.NOT_INTERESTED) {
    candidates.push(CANONICAL_OFFER_STATE.REJECTED);
  }

  let best = CANONICAL_OFFER_STATE.NONE;
  let bestRank = CANONICAL_OFFER_RANK[CANONICAL_OFFER_STATE.NONE];
  for (const state of candidates) {
    if (!state) continue;
    const rank = CANONICAL_OFFER_RANK[state] ?? 0;
    if (rank > bestRank) {
      best = state;
      bestRank = rank;
    }
  }

  if (best === CANONICAL_OFFER_STATE.NONE && card) {
    const config = lead?.crm?.vehicleConfigurations?.find(
      (entry) => entry.id === card.configurationId || entry.id === card.id,
    );
    const payment = config?.boardOffer?.payment ?? card.boardOffer?.payment;
    if (hasCalculatedOfferPayment(payment ?? {})) {
      best = CANONICAL_OFFER_STATE.CREATED;
    } else if (card.model || card.modelName) {
      best = CANONICAL_OFFER_STATE.DRAFT;
    }
  }

  return {
    state: best,
    source: 'vehicle_card',
    cardId: card.id,
    boardStatus,
    vehicleOfferStatus,
  };
}

function canonicalFromLegacyOffer(offer = {}, sourceKey) {
  const status = offer?.status ?? offer?.vehicleOffer?.status ?? null;
  const mapped = mapVehicleOfferStatusToCanonical(status);
  if (mapped) {
    return { state: mapped, source: sourceKey, cardId: offer?.vehicleCardId ?? offer?.id ?? null };
  }
  if (offer?.boardStatus) {
    const fromBoard = mapBoardStatusToCanonical(offer.boardStatus);
    if (fromBoard) return { state: fromBoard, source: sourceKey, cardId: offer?.id ?? null };
  }
  return null;
}

/**
 * Zentrale Kanonisierung über vehicleOffers, Board, Portfolio, Legacy.
 */
export function resolveCanonicalOfferState(lead = null, { vehicleCards: overrideCards = null } = {}) {
  if (!lead) {
    return {
      state: CANONICAL_OFFER_STATE.NONE,
      label: getCanonicalOfferStateLabel(CANONICAL_OFFER_STATE.NONE),
      source: null,
      cardId: null,
      offerCount: 0,
      sources: [],
    };
  }

  const vehicleCards = overrideCards ?? buildVehicleOpportunityCards({ lead });
  const candidates = [];

  for (const card of vehicleCards) {
    candidates.push(canonicalFromCard(card, lead));
  }

  const legacyVehicleOffers = lead.crm?.vehicleOffers ?? {};
  for (const [cardId, offer] of Object.entries(legacyVehicleOffers)) {
    const mapped = canonicalFromLegacyOffer(
      { ...offer, vehicleCardId: cardId },
      'crm.vehicleOffers',
    );
    if (mapped) candidates.push(mapped);
  }

  for (const offer of lead.offers ?? []) {
    const mapped = canonicalFromLegacyOffer(offer, 'lead.offers');
    if (mapped) candidates.push(mapped);
  }

  for (const group of lead.crm?.offerSelectionGroups ?? []) {
    if (group?.sentAt || group?.status === 'sent') {
      candidates.push({
        state: CANONICAL_OFFER_STATE.SENT,
        source: 'offerSelectionGroups',
        cardId: group.id,
      });
    }
  }

  let best = {
    state: CANONICAL_OFFER_STATE.NONE,
    source: null,
    cardId: null,
  };
  let bestRank = CANONICAL_OFFER_RANK[CANONICAL_OFFER_STATE.NONE];

  for (const candidate of candidates) {
    if (!candidate?.state) continue;
    const rank = CANONICAL_OFFER_RANK[candidate.state] ?? 0;
    if (rank > bestRank) {
      best = candidate;
      bestRank = rank;
    }
  }

  const sources = [...new Set(candidates.map((c) => c.source).filter(Boolean))];

  return {
    state: best.state,
    label: getCanonicalOfferStateLabel(best.state),
    source: best.source,
    cardId: best.cardId,
    offerCount: vehicleCards.length,
    sources,
    vehicleCards,
  };
}

/**
 * Alle relevanten Signale für Phase, Score und Timeline.
 */
export function collectJourneySignals(lead = null, options = {}) {
  if (!lead) return null;

  const crm = lead.crm ?? {};
  const vehicleCards = options.vehicleCards ?? buildVehicleOpportunityCards({ lead });
  const canonicalOffer = resolveCanonicalOfferState(lead, { vehicleCards });
  const offerSelectionGroups = options.offerSelectionGroups
    ?? resolveOfferSelectionGroups({ lead });
  const paymentType = vehicleCards[0]?.paymentType ?? lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const unterlagenSummary = computeUnterlagenSummary(lead, paymentType);
  const selbstauskunft = getSelbstauskunft(crm.cleverUnterlagen);
  const selbstauskunftComplete = selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.completed.id
    || selbstauskunft?.status === SELBSTAUSKUNFT_STATUS.checked.id;
  const portal = getCustomerPortalAccess(lead);
  const inboxItems = lead.id ? listInboxItemsForCustomer(lead.id) : [];
  const pipelineStatusId = crm.pipelineStatusId ?? 'neu';
  const leadStatus = lead.status ?? pipelineToLeadStatus(pipelineStatusId);
  const history = Array.isArray(lead.history) ? lead.history : [];
  const deliveryConfirmation = lead.deliveryConfirmation ?? null;
  const vehicleFulfillmentStatus = crm.vehicleFulfillment?.status ?? null;
  const leasingStatus = crm.leasing?.status ?? null;

  const primaryCard = vehicleCards.find((card) => card.id === canonicalOffer.cardId) ?? vehicleCards[0] ?? null;
  const sentAt = primaryCard?.vehicleOffer?.sentAt
    ?? primaryCard?.offer?.sentAt
    ?? null;
  const openedAt = primaryCard?.vehicleOffer?.tracking?.lastOpenedAt
    ?? primaryCard?.offer?.openedAt
    ?? null;

  const docsMissing = unterlagenSummary?.totalCount
    && unterlagenSummary.doneCount < Math.max(1, unterlagenSummary.totalCount - 1);

  const hasInterested = vehicleCards.some((card) => {
    const interaction = getCustomerOfferInteraction(lead, card.id);
    return interaction?.interestStatus === INTEREST_STATUS.INTERESTED;
  });

  return {
    lead,
    crm,
    leadStatus,
    pipelineStatusId,
    canonicalOffer,
    vehicleCards,
    offerSelectionGroups,
    primaryCard,
    paymentType,
    unterlagenSummary,
    selbstauskunftComplete,
    docsMissing,
    portal,
    inboxItems,
    history,
    deliveryConfirmation,
    vehicleFulfillmentStatus,
    leasingStatus,
    hasInterested,
    hasTestDrive: leadStatus === 'probefahrt' || Boolean(lead.wantTestDrive),
    hasWish: Boolean(lead.wish?.model || lead.wish?.paymentType || lead.desiredRate),
    hasContact: Boolean(lead.contact?.phone || lead.contact?.email),
    hasVehicleProposal: vehicleCards.length > 0,
    daysSinceActivity: daysSince(lead.updatedAt ?? lead.createdAt),
    daysSinceSent: daysSince(sentAt),
    daysSinceOpened: daysSince(openedAt),
    portalActive: portal?.status === PORTAL_ACCESS_STATUS.OPENED
      || portal?.status === PORTAL_ACCESS_STATUS.VIEWED
      || portal?.status === PORTAL_ACCESS_STATUS.CODE_VERIFIED,
    deliverySent: Boolean(deliveryConfirmation?.sentAt),
    deliveryConfirmed: leadStatus === 'auslieferung_bestaetigt'
      || Boolean(deliveryConfirmation?.confirmedAt),
    handoverDone: leadStatus === 'ausgeliefert',
  };
}
