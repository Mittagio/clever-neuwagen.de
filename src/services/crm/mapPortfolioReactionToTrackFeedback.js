/**
 * Kundenportal-Reaktion → Vehicle-Track-Feedback + Varianten-Feedback.
 * Keine Spuren löschen; Favorit bevorzugt, deferred bleibt erhalten.
 * Bei commercialScenarioId: Feedback je Variante (Epic 4), Dual-Spur bleibt eine Spur.
 * Reaktion-Strings spiegeln PORTFOLIO_REACTION_STATUS (kein Import → kein Zyklus).
 */
import {
  applyTrackFeedbackFacts,
  getVehicleTrackMeta,
  patchVehicleTrackOnLead,
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from './vehicleTrack.js';
import {
  applyScenarioOfferFeedbackFacts,
  reasonFromPortalReaction,
  SCENARIO_FEEDBACK_SOURCE,
} from './scenarioOfferFeedback.js';
import { listCommercialScenarios } from './commercialScenarios.js';

const REACTION = {
  INTERESTED: 'interested',
  CALL_REQUESTED: 'call_requested',
  DECLINED: 'declined',
  MORE_INFO: 'more_info',
  CHANGE_REQUESTED: 'change_requested',
};

function countExplicitScenariosOnTrack(lead, trackId) {
  const all = listCommercialScenarios(lead).filter((s) => s.source !== 'legacy');
  if (!trackId) return all.length;
  const bound = all.filter((s) => !s.vehicleTrackId || s.vehicleTrackId === trackId);
  return (bound.length ? bound : all).length;
}

/**
 * @returns {{ trackFacts: object[], scenarioFeedback: object[] }}
 */
export function mapPortfolioReactionBundle({
  vehicleCardId = null,
  reactionStatus = 'none',
  declineReason = null,
  commercialScenarioId = null,
  offerId = null,
  declineNote = null,
  questionText = null,
  changeDimension = null,
  lead = {},
} = {}) {
  const trackId = String(vehicleCardId ?? '').trim();
  const scenarioId = String(commercialScenarioId ?? '').trim() || null;
  const dualOnTrack = Boolean(scenarioId)
    && countExplicitScenariosOnTrack(lead, trackId) >= 2;

  const scenarioFeedback = [];
  if (scenarioId && (
    reactionStatus === REACTION.INTERESTED
    || reactionStatus === REACTION.CALL_REQUESTED
    || reactionStatus === REACTION.DECLINED
    || reactionStatus === REACTION.MORE_INFO
    || reactionStatus === REACTION.CHANGE_REQUESTED
  )) {
    const reason = reasonFromPortalReaction({
      reactionStatus,
      declineReason,
      changeDimension,
      declineNote,
      questionText,
    });
    const freeText = (declineNote || questionText || '').trim() || null;
    scenarioFeedback.push({
      commercialScenarioId: scenarioId,
      offerId: offerId || null,
      vehicleTrackId: trackId || null,
      reactionStatus,
      reason,
      freeText,
      source: SCENARIO_FEEDBACK_SOURCE.PORTAL,
    });
  }

  const trackFacts = [];
  if (!trackId) {
    return { trackFacts, scenarioFeedback };
  }

  if (reactionStatus === REACTION.INTERESTED) {
    trackFacts.push({
      trackId,
      status: VEHICLE_TRACK_STATUS.FAVORITE,
      lastCustomerReaction: REACTION.INTERESTED,
    });
  } else if (reactionStatus === REACTION.CALL_REQUESTED) {
    trackFacts.push({
      trackId,
      ...(dualOnTrack ? {} : { status: VEHICLE_TRACK_STATUS.ACTIVE }),
      lastCustomerReaction: REACTION.CALL_REQUESTED,
    });
  } else if (reactionStatus === REACTION.DECLINED) {
    if (dualOnTrack) {
      // Variante abgelehnt ≠ gesamte Fahrzeugspur deferred
      trackFacts.push({
        trackId,
        lastCustomerReaction: REACTION.DECLINED,
      });
    } else {
      const fact = {
        trackId,
        status: VEHICLE_TRACK_STATUS.DEFERRED,
        lastCustomerReaction: REACTION.DECLINED,
      };
      if (declineReason === 'too_expensive') {
        fact.rejectionReason = REJECTION_REASON.PRICE_TOO_HIGH;
      } else if (declineReason) {
        fact.rejectionReason = REJECTION_REASON.OTHER;
      }
      trackFacts.push(fact);
    }
  } else if (reactionStatus === REACTION.CHANGE_REQUESTED) {
    const wish = String(questionText ?? '').trim();
    const existing = getVehicleTrackMeta(
      (lead?.crm?.vehicleConfigurations ?? []).find((c) => c.id === trackId),
    );
    const keepFavorite = existing.status === VEHICLE_TRACK_STATUS.FAVORITE;
    trackFacts.push({
      trackId,
      ...(dualOnTrack || keepFavorite ? {} : { status: VEHICLE_TRACK_STATUS.ACTIVE }),
      lastCustomerReaction: REACTION.CHANGE_REQUESTED,
      ...(wish ? { addRequirement: wish } : {}),
    });
  } else if (reactionStatus === REACTION.MORE_INFO) {
    trackFacts.push({
      trackId,
      lastCustomerReaction: REACTION.MORE_INFO,
    });
  }

  return { trackFacts, scenarioFeedback };
}

/**
 * Brandes-kompatibel: Array von Track-Facts (ohne commercialScenarioId).
 * Mit commercialScenarioId / returnBundle → Bundle.
 */
export function mapPortfolioReactionToTrackFeedback(opts = {}) {
  const bundle = mapPortfolioReactionBundle(opts);
  if (opts.commercialScenarioId || opts.returnBundle === true) {
    return bundle;
  }
  return bundle.trackFacts;
}

/**
 * Wendet Portal-Reaktion auf Tracks + Varianten-Feedback an (ohne andere Spuren zu löschen).
 * Bei Favorit: bisherige Favoriten → active (nicht deferred/lost).
 */
export function applyPortfolioReactionToTracks(lead = {}, {
  vehicleCardId = null,
  reactionStatus = 'none',
  declineReason = null,
  commercialScenarioId = null,
  offerId = null,
  declineNote = null,
  questionText = null,
  changeDimension = null,
} = {}) {
  const bundle = mapPortfolioReactionBundle({
    vehicleCardId,
    reactionStatus,
    declineReason,
    commercialScenarioId,
    offerId,
    declineNote,
    questionText,
    changeDimension,
    lead,
  });

  let next = lead;

  if (bundle.scenarioFeedback.length) {
    next = applyScenarioOfferFeedbackFacts(next, bundle.scenarioFeedback);
  }

  const facts = bundle.trackFacts;
  if (!facts.length) return next;

  const promotesFavorite = facts.some((f) => f.status === VEHICLE_TRACK_STATUS.FAVORITE);

  if (promotesFavorite && vehicleCardId) {
    for (const config of next.crm?.vehicleConfigurations ?? []) {
      if (config.id === vehicleCardId) continue;
      const meta = getVehicleTrackMeta(config);
      if (meta.status === VEHICLE_TRACK_STATUS.FAVORITE) {
        next = patchVehicleTrackOnLead(next, config.id, {
          status: VEHICLE_TRACK_STATUS.ACTIVE,
        });
      }
    }
  }

  return applyTrackFeedbackFacts(next, facts);
}
