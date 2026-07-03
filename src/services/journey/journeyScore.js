/**
 * Journey-Scores – Abschlusschance aus Presenter, weitere heuristisch.
 */
import { buildCleverActionContext } from '../crm/cleverActionEngine.js';
import {
  computeAbschlusschance,
  collectWhyBullets,
} from '../crm/cleverRecommendationPresenter.js';
import { PORTAL_ACCESS_STATUS } from '../crm/customerPortalAccessService.js';
import { CANONICAL_OFFER_STATE } from './journeyTypes.js';

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeAktivitaetScore(signals = {}, context = {}) {
  let score = 35;

  if (signals.portalActive) score += 25;
  if (signals.portal?.status === PORTAL_ACCESS_STATUS.VIEWED) score += 15;
  if (signals.hasInterested) score += 20;
  if (signals.inboxItems?.length) score += Math.min(15, signals.inboxItems.length * 3);
  if (signals.daysSinceActivity != null && signals.daysSinceActivity <= 2) score += 18;
  if (signals.daysSinceActivity != null && signals.daysSinceActivity > 10) score -= 20;
  if (signals.daysSinceOpened === 0) score += 12;

  const offerState = signals.canonicalOffer?.state;
  if (offerState === CANONICAL_OFFER_STATE.OPENED) score += 15;
  if (offerState === CANONICAL_OFFER_STATE.SENT) score += 8;

  return clampScore(score);
}

export function computeDringlichkeitScore(signals = {}, context = {}) {
  let score = 30;

  const offerState = signals.canonicalOffer?.state;
  if (offerState === CANONICAL_OFFER_STATE.OPENED) score += 35;
  if (signals.daysSinceOpened === 1) score += 12;
  if (signals.docsMissing) score += 18;
  if (signals.vehicleFulfillmentStatus === 'delivery_ready') score += 30;
  if (signals.vehicleFulfillmentStatus === 'in_transit') score += 22;
  if (signals.leasingStatus === 'approved') score += 25;
  if (signals.daysSinceSent != null && signals.daysSinceSent >= 5) score += 15;
  if (signals.inboxItems?.some((item) => item.status === 'open')) score += 12;

  return clampScore(score);
}

export function computeKaufwahrscheinlichkeitScore(signals = {}, context = {}, abschlusschance = 50) {
  let score = Math.round(abschlusschance * 0.65);

  if (signals.hasInterested) score += 22;
  if (signals.canonicalOffer?.state === CANONICAL_OFFER_STATE.ACCEPTED) score += 30;
  if (signals.selbstauskunftComplete) score += 10;
  if (signals.leasingStatus === 'approved') score += 18;
  if (signals.hasTestDrive) score += 12;
  if (signals.leadStatus === 'verloren') score = 5;

  return clampScore(score);
}

export function computeCleverPotenzialScore(signals = {}) {
  let score = 40;

  if (signals.vehicleCards?.length >= 2) score += 15;
  if (signals.hasWish && signals.lead?.desiredRate) score += 12;
  if (signals.hasVehicleProposal) score += 10;
  if (signals.portalActive) score += 8;
  if (signals.unterlagenSummary?.doneCount > 0) score += 8;
  if (signals.offerSelectionGroups?.length > 0) score += 6;
  if (!signals.hasContact) score -= 15;

  return clampScore(score);
}

/**
 * Alle fünf Journey-Scores berechnen.
 */
export function computeJourneyScores(signals = {}, recommendation = null) {
  const context = buildCleverActionContext({
    lead: signals.lead,
    vehicleCards: signals.vehicleCards ?? [],
    offerSelectionGroups: signals.offerSelectionGroups ?? [],
    customerName: signals.lead?.contact?.name ?? '',
  });

  const abschlusschance = computeAbschlusschance(context);

  return {
    abschlusschance,
    aktivitaet: computeAktivitaetScore(signals, context),
    dringlichkeit: computeDringlichkeitScore(signals, context),
    kaufwahrscheinlichkeit: computeKaufwahrscheinlichkeitScore(signals, context, abschlusschance),
    cleverPotenzial: computeCleverPotenzialScore(signals),
  };
}

export function buildJourneyReasons(signals = {}, recommendation = null) {
  const context = buildCleverActionContext({
    lead: signals.lead,
    vehicleCards: signals.vehicleCards ?? [],
    offerSelectionGroups: signals.offerSelectionGroups ?? [],
    customerName: signals.lead?.contact?.name ?? '',
  });

  return collectWhyBullets(context, recommendation);
}
