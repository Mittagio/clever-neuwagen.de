/**
 * Journey-Phase aus vorhandenen Signalen ableiten.
 */
import { JOURNEY_PHASE, getJourneyPhaseLabel } from './journeyTypes.js';
import { CANONICAL_OFFER_STATE } from './journeyTypes.js';

export function deriveJourneyPhase(signals = {}) {
  const {
    leadStatus,
    canonicalOffer,
    docsMissing,
    leasingStatus,
    vehicleFulfillmentStatus,
    deliverySent,
    deliveryConfirmed,
    handoverDone,
    hasTestDrive,
    hasInterested,
    daysSinceOpened,
    daysSinceSent,
    portalActive,
    hasVehicleProposal,
    hasWish,
    hasContact,
    history = [],
  } = signals;

  if (leadStatus === 'verloren') {
    return JOURNEY_PHASE.LOST;
  }

  if (handoverDone) {
    return JOURNEY_PHASE.CLOSED;
  }

  if (deliveryConfirmed || vehicleFulfillmentStatus === 'ready_for_handover') {
    return JOURNEY_PHASE.HANDOVER;
  }

  if (deliverySent || vehicleFulfillmentStatus === 'delivery_ready') {
    return JOURNEY_PHASE.DELIVERY;
  }

  if (
    vehicleFulfillmentStatus === 'in_transit'
    || vehicleFulfillmentStatus === 'arriving'
    || leasingStatus === 'approved'
  ) {
    return JOURNEY_PHASE.ORDER;
  }

  if (leasingStatus === 'submitted' || leasingStatus === 'pending') {
    return JOURNEY_PHASE.FINANCING;
  }

  const offerState = canonicalOffer?.state ?? CANONICAL_OFFER_STATE.NONE;

  const docsRelevant = hasInterested
    || offerState === CANONICAL_OFFER_STATE.ACCEPTED
    || leasingStatus === 'submitted'
    || leasingStatus === 'pending'
    || leasingStatus === 'approved'
    || Boolean(vehicleFulfillmentStatus);

  if (docsMissing && docsRelevant) {
    return JOURNEY_PHASE.DOCUMENTS;
  }

  if (hasTestDrive) {
    return JOURNEY_PHASE.TEST_DRIVE;
  }

  if (offerState === CANONICAL_OFFER_STATE.ACCEPTED || hasInterested) {
    return JOURNEY_PHASE.ORDER;
  }

  if (offerState === CANONICAL_OFFER_STATE.OPENED) {
    if (daysSinceOpened != null && daysSinceOpened >= 1) {
      return JOURNEY_PHASE.CUSTOMER_CONSIDERING;
    }
    return JOURNEY_PHASE.CUSTOMER_CONSIDERING;
  }

  if (offerState === CANONICAL_OFFER_STATE.SENT) {
    if (daysSinceSent != null && daysSinceSent >= 2) {
      return JOURNEY_PHASE.CUSTOMER_CONSIDERING;
    }
    return JOURNEY_PHASE.OFFER_SENT;
  }

  if (offerState === CANONICAL_OFFER_STATE.CREATED) {
    return JOURNEY_PHASE.OFFER_CREATED;
  }

  if (offerState === CANONICAL_OFFER_STATE.DRAFT && hasVehicleProposal) {
    return JOURNEY_PHASE.OFFER_CREATED;
  }

  if (hasVehicleProposal) {
    return JOURNEY_PHASE.VEHICLE_FOUND;
  }

  if (portalActive && offerState === CANONICAL_OFFER_STATE.NONE) {
    return JOURNEY_PHASE.NEEDS_ANALYSIS;
  }

  if (hasWish) {
    return JOURNEY_PHASE.NEEDS_ANALYSIS;
  }

  if (hasContact && history.length > 0) {
    return JOURNEY_PHASE.FIRST_CONTACT;
  }

  if (hasContact) {
    return JOURNEY_PHASE.FIRST_CONTACT;
  }

  return JOURNEY_PHASE.NEW_INQUIRY;
}

export function computePhaseConfidence(signals = {}, phase = JOURNEY_PHASE.NEW_INQUIRY) {
  let confidence = 0.55;

  const offerState = signals.canonicalOffer?.state;

  if (phase === JOURNEY_PHASE.LOST && signals.leadStatus === 'verloren') confidence = 0.98;
  if (phase === JOURNEY_PHASE.CLOSED && signals.handoverDone) confidence = 0.98;
  if (phase === JOURNEY_PHASE.HANDOVER && signals.deliveryConfirmed) confidence = 0.92;
  if (phase === JOURNEY_PHASE.DELIVERY && signals.deliverySent) confidence = 0.88;
  if (phase === JOURNEY_PHASE.FINANCING && signals.leasingStatus) confidence = 0.85;
  if (phase === JOURNEY_PHASE.DOCUMENTS && signals.docsMissing) confidence = 0.82;
  if (phase === JOURNEY_PHASE.TEST_DRIVE && signals.hasTestDrive) confidence = 0.9;
  if (phase === JOURNEY_PHASE.OFFER_SENT && offerState === CANONICAL_OFFER_STATE.SENT) confidence = 0.88;
  if (phase === JOURNEY_PHASE.OFFER_CREATED && offerState === CANONICAL_OFFER_STATE.CREATED) confidence = 0.86;
  if (phase === JOURNEY_PHASE.CUSTOMER_CONSIDERING && offerState === CANONICAL_OFFER_STATE.OPENED) {
    confidence = 0.84;
  }
  if (phase === JOURNEY_PHASE.VEHICLE_FOUND && signals.hasVehicleProposal) confidence = 0.8;
  if (phase === JOURNEY_PHASE.NEEDS_ANALYSIS && signals.hasWish) confidence = 0.72;
  if (phase === JOURNEY_PHASE.FIRST_CONTACT && signals.hasContact) confidence = 0.7;
  if (phase === JOURNEY_PHASE.NEW_INQUIRY) confidence = 0.6;

  return Math.max(0, Math.min(1, confidence));
}

export function resolveJourneyPhase(signals = {}) {
  const phase = deriveJourneyPhase(signals);
  return {
    phase,
    phaseLabel: getJourneyPhaseLabel(phase),
    confidence: computePhaseConfidence(signals, phase),
  };
}
