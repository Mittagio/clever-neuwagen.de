/**
 * Clever Journey Manager – öffentliche API.
 * Liest vorhandene Daten, keine doppelte Datenhaltung.
 */
import { collectJourneySignals, resolveCanonicalOfferState } from './journeyRules.js';
import { resolveJourneyPhase } from './journeyStateMachine.js';
import { computeJourneyScores, buildJourneyReasons } from './journeyScore.js';
import { buildJourneyTimeline } from './journeyTimeline.js';
import { buildJourneyRecommendation } from './journeyRecommendation.js';

export { resolveCanonicalOfferState } from './journeyRules.js';
export { JOURNEY_PHASE, CANONICAL_OFFER_STATE } from './journeyTypes.js';

/**
 * Vollständige Journey-Bewertung für einen Lead.
 */
export function evaluateJourney(lead = null, options = {}) {
  if (!lead?.id) return null;

  const signals = collectJourneySignals(lead, {
    vehicleCards: options.vehicleCards,
    offerSelectionGroups: options.offerSelectionGroups,
  });

  const { phase, phaseLabel, confidence } = resolveJourneyPhase(signals);
  const canonicalOfferState = signals.canonicalOffer;
  const { recommendation, view } = buildJourneyRecommendation(signals, options);
  const scores = computeJourneyScores(signals, recommendation);
  const timeline = buildJourneyTimeline(signals);
  const reasons = buildJourneyReasons(signals, recommendation);

  return {
    leadId: lead.id,
    phase,
    phaseLabel,
    confidence,
    canonicalOfferState,
    scores,
    recommendation,
    view,
    timeline,
    reasons,
    signals,
  };
}

function starsFromClosure(closureChance) {
  if (closureChance >= 88) return 5;
  if (closureChance >= 72) return 4;
  if (closureChance >= 55) return 3;
  if (closureChance >= 38) return 2;
  return 1;
}

function starLabel(count) {
  return '⭐'.repeat(Math.max(1, Math.min(5, count)));
}

function toDashboardItem(journey) {
  const view = journey?.view;
  if (!view) return null;

  return {
    leadId: journey.leadId,
    customerName: journey.signals?.lead?.contact?.name ?? 'Kunde',
    headline: view.headline,
    subline: view.subline,
    closureChance: journey.scores?.abschlusschance ?? view.closureChance ?? 0,
    stars: view.stars ?? starsFromClosure(journey.scores?.abschlusschance ?? 0),
    starLabel: view.starLabel ?? starLabel(starsFromClosure(journey.scores?.abschlusschance ?? 0)),
    actionId: view.actionId,
    whySummary: view.whySummary ?? reasonsToSummary(journey.reasons),
    phase: journey.phase,
    phaseLabel: journey.phaseLabel,
  };
}

function reasonsToSummary(reasons = []) {
  return reasons.slice(0, 3).map((r) => r.text).join(' · ');
}

/**
 * Dashboard-Aggregation für Verkäufer – sortiert nach Abschlusschance.
 */
export function evaluateSellerJourneys(leads = [], options = {}) {
  const { maxItems = 12 } = options;
  const items = [];

  for (const lead of leads) {
    if (!lead?.id || lead.status === 'verloren') continue;
    const journey = evaluateJourney(lead, options);
    if (!journey?.view) continue;
    const dashboardItem = toDashboardItem(journey);
    if (!dashboardItem) continue;
    items.push({
      ...dashboardItem,
      journey,
    });
  }

  return items
    .sort((a, b) => {
      if (b.closureChance !== a.closureChance) return b.closureChance - a.closureChance;
      return (a.journey?.recommendation?.priority ?? 99) - (b.journey?.recommendation?.priority ?? 99);
    })
    .slice(0, maxItems);
}
