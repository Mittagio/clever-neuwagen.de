/**
 * Kundenportal-Reaktion → Vehicle-Track-Feedback.
 * Keine Spuren löschen; Favorit bevorzugt, deferred bleibt erhalten.
 * Reaktion-Strings spiegeln PORTFOLIO_REACTION_STATUS (kein Import → kein Zyklus).
 */
import {
  applyTrackFeedbackFacts,
  getVehicleTrackMeta,
  patchVehicleTrackOnLead,
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from './vehicleTrack.js';

const REACTION = {
  INTERESTED: 'interested',
  CALL_REQUESTED: 'call_requested',
  DECLINED: 'declined',
};

/**
 * @param {{
 *   vehicleCardId?: string|null,
 *   reactionStatus?: string,
 *   declineReason?: string|null,
 * }} opts
 * @returns {object[]} Facts für applyTrackFeedbackFacts
 */
export function mapPortfolioReactionToTrackFeedback({
  vehicleCardId = null,
  reactionStatus = 'none',
  declineReason = null,
} = {}) {
  const trackId = String(vehicleCardId ?? '').trim();
  if (!trackId) return [];

  if (reactionStatus === REACTION.INTERESTED) {
    return [{
      trackId,
      status: VEHICLE_TRACK_STATUS.FAVORITE,
      lastCustomerReaction: REACTION.INTERESTED,
    }];
  }

  if (reactionStatus === REACTION.CALL_REQUESTED) {
    return [{
      trackId,
      status: VEHICLE_TRACK_STATUS.ACTIVE,
      lastCustomerReaction: REACTION.CALL_REQUESTED,
    }];
  }

  if (reactionStatus === REACTION.DECLINED) {
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
    return [fact];
  }

  return [];
}

/**
 * Wendet Portal-Reaktion auf Tracks an (ohne andere Spuren zu löschen).
 * Bei Favorit: bisherige Favoriten → active (nicht deferred/lost).
 */
export function applyPortfolioReactionToTracks(lead = {}, {
  vehicleCardId = null,
  reactionStatus = 'none',
  declineReason = null,
} = {}) {
  const facts = mapPortfolioReactionToTrackFeedback({
    vehicleCardId,
    reactionStatus,
    declineReason,
  });
  if (!facts.length) return lead;

  let next = lead;
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
