/**
 * Journey-Empfehlung – delegiert an cleverActionEngine + Presenter.
 */
import { buildCleverActionRecommendation } from '../crm/cleverActionEngine.js';
import { buildCleverEmpfiehltView } from '../crm/cleverRecommendationPresenter.js';

export function buildJourneyRecommendation(signals = {}, options = {}) {
  const {
    excludedActionIds = [],
    telHref = null,
    offerPath = null,
    customerName = signals.lead?.contact?.name ?? '',
  } = options;

  const lead = signals.lead;
  const vehicleCards = options.vehicleCards ?? signals.vehicleCards ?? [];
  const offerSelectionGroups = options.offerSelectionGroups ?? signals.offerSelectionGroups ?? [];

  const recommendation = buildCleverActionRecommendation({
    lead,
    vehicleCards,
    offerSelectionGroups,
    customerName,
  });

  const view = buildCleverEmpfiehltView({
    lead,
    vehicleCards,
    offerSelectionGroups,
    customerName,
    excludedActionIds,
    telHref,
    offerPath,
  });

  return {
    recommendation,
    view,
  };
}
