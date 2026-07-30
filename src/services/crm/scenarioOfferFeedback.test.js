/**
 * Epic 4 – Kundenfeedback je Angebotsvariante
 */
import assert from 'node:assert/strict';
import {
  SCENARIO_FEEDBACK_REASON,
  SCENARIO_FEEDBACK_SENTIMENT,
  applyScenarioOfferFeedbackFacts,
  formatScenarioOfferFeedbackChip,
  getScenarioOfferFeedback,
  listScenarioOfferFeedback,
  parseScenarioOfferFeedbackFromText,
  upsertScenarioOfferFeedbackOnLead,
} from './scenarioOfferFeedback.js';
import {
  buildCustomerTruthNotepadGroups,
} from './commercialScenarios.js';
import {
  createSportageDualScenarioLead,
  SPORTAGE_DUAL_OFFER_IDS,
  SPORTAGE_DUAL_SCENARIO_IDS,
  SPORTAGE_DUAL_TRACK_ID,
} from './sportageDualScenarioCase.js';
import {
  getVehicleTrackMeta,
  listCustomerVehicleTracks,
  listScenarioOfferSlots,
  VEHICLE_TRACK_STATUS,
} from './vehicleTrack.js';
import {
  applyPortfolioEvent,
  buildPortfolioItems,
  markPortfolioSent,
  prepareCustomerOfferPortfolio,
  PORTFOLIO_EVENTS,
  PORTFOLIO_REACTION_STATUS,
  PORTFOLIO_STATUS,
} from './customerOfferPortfolioService.js';
import {
  applyPortfolioReactionToTracks,
  mapPortfolioReactionBundle,
} from './mapPortfolioReactionToTrackFeedback.js';
import {
  interpretSellerInput,
} from '../cleverSeller/interpretSellerInput.js';
import {
  applyAcceptedSellerTurn,
} from '../cleverSeller/applyAcceptedSellerTurn.js';
import {
  buildCleverSellerTurnResult,
} from '../cleverSeller/cleverSellerTurnResultSchema.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
} from './cleverInboxService.js';

__resetInboxStoreForTests([]);

// --- parse seller phrases ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const leasingBetter = parseScenarioOfferFeedbackFromText(
    'Leasing gefällt besser',
    lead,
  );
  assert.equal(leasingBetter.length, 1);
  assert.equal(leasingBetter[0].commercialScenarioId, SPORTAGE_DUAL_SCENARIO_IDS.LEASING);
  assert.equal(leasingBetter[0].reason, SCENARIO_FEEDBACK_REASON.PREFERRED);

  const balloon = parseScenarioOfferFeedbackFromText(
    'Finanzierung zu hohe Schlussrate',
    lead,
  );
  assert.equal(balloon[0].commercialScenarioId, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING);
  assert.equal(balloon[0].reason, SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH);

  const term = parseScenarioOfferFeedbackFromText(
    'andere Laufzeit gewünscht',
    lead,
  );
  assert.equal(term.length, 1);
  assert.equal(term[0].reason, SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM);
  assert.ok(
    term[0].commercialScenarioId === SPORTAGE_DUAL_SCENARIO_IDS.FINANCING
    || term[0].commercialScenarioId === SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
  );
}

// --- two different reactions stay separate; one Sportage track ---
{
  let lead = createSportageDualScenarioLead({ phase: 'ready' });
  lead = upsertScenarioOfferFeedbackOnLead(lead, {
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
    offerId: SPORTAGE_DUAL_OFFER_IDS.LEASING,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
    reason: SCENARIO_FEEDBACK_REASON.PREFERRED,
    reactionStatus: 'interested',
    label: 'Leasing · gefällt besser',
    source: 'seller',
  });
  lead = upsertScenarioOfferFeedbackOnLead(lead, {
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
    offerId: SPORTAGE_DUAL_OFFER_IDS.FINANCING,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
    reason: SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
    reactionStatus: 'declined',
    label: 'Finanzierung · Schlussrate zu hoch',
    source: 'seller',
  });

  const list = listScenarioOfferFeedback(lead);
  assert.equal(list.length, 2);
  assert.equal(
    getScenarioOfferFeedback(lead, SPORTAGE_DUAL_SCENARIO_IDS.LEASING).reason,
    SCENARIO_FEEDBACK_REASON.PREFERRED,
  );
  assert.equal(
    getScenarioOfferFeedback(lead, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING).reason,
    SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
  );

  // Offer mirror
  assert.equal(
    lead.crm.vehicleOffers[SPORTAGE_DUAL_OFFER_IDS.LEASING].customerFeedback.reason,
    SCENARIO_FEEDBACK_REASON.PREFERRED,
  );
  assert.equal(
    lead.crm.vehicleOffers[SPORTAGE_DUAL_OFFER_IDS.FINANCING].customerFeedback.reason,
    SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
  );

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 1, 'keine zweite Sportage-Spur');

  const slots = listScenarioOfferSlots(lead, SPORTAGE_DUAL_TRACK_ID);
  assert.match(slots[0].feedbackLabel, /gefällt besser/i);
  assert.match(slots[1].feedbackLabel, /Schlussrate/i);

  const groups = buildCustomerTruthNotepadGroups(lead);
  const feedbackChips = groups.offerWishes.filter((c) => c.kind === 'scenario_feedback');
  assert.equal(feedbackChips.length, 2);
  assert.ok(feedbackChips.some((c) => /Leasing.*gefällt/i.test(c.label)));
  assert.ok(feedbackChips.some((c) => /Finanzierung.*Schlussrate/i.test(c.label)));
}

// --- Portal: interested leasing + declined financing (balloon note) ---
{
  let lead = createSportageDualScenarioLead({ phase: 'ready' });
  const prepared = prepareCustomerOfferPortfolio({ lead });
  assert.equal(prepared.ok, true);
  assert.ok(prepared.portfolio.items.length >= 2);
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      customerOfferPortfolio: markPortfolioSent(prepared.portfolio),
    },
  };
  const portfolio = lead.crm.customerOfferPortfolio;

  const leasingItem = portfolio.items.find(
    (i) => i.commercialScenarioId === SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
  );
  const financingItem = portfolio.items.find(
    (i) => i.commercialScenarioId === SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
  );
  assert.ok(leasingItem);
  assert.ok(financingItem);

  const like = applyPortfolioEvent(
    lead,
    leasingItem.id,
    PORTFOLIO_EVENTS.OFFER_INTERESTED,
    { token: portfolio.token },
  );
  assert.equal(like.ok, true);
  lead = like.lead;

  const decline = applyPortfolioEvent(
    lead,
    financingItem.id,
    PORTFOLIO_EVENTS.OFFER_DECLINED,
    {
      token: portfolio.token,
      declineReason: 'too_expensive',
      declineNote: 'Schlussrate zu hoch',
    },
  );
  assert.equal(decline.ok, true);
  lead = decline.lead;

  assert.equal(
    getScenarioOfferFeedback(lead, SPORTAGE_DUAL_SCENARIO_IDS.LEASING).reason,
    SCENARIO_FEEDBACK_REASON.PREFERRED,
  );
  assert.equal(
    getScenarioOfferFeedback(lead, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING).reason,
    SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
  );

  // Dual: Finanzierung abgelehnt → Spur NICHT deferred
  const trackMeta = getVehicleTrackMeta(
    lead.crm.vehicleConfigurations.find((c) => c.id === SPORTAGE_DUAL_TRACK_ID),
  );
  assert.notEqual(trackMeta.status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.equal(trackMeta.status, VEHICLE_TRACK_STATUS.FAVORITE);
  assert.equal(listCustomerVehicleTracks(lead).length, 1);
  assert.equal(lead.crm.customerOfferPortfolio.status, PORTFOLIO_STATUS.REACTED);
}

// --- mapPortfolioReactionBundle dual decline ---
{
  const lead = createSportageDualScenarioLead({ phase: 'sent' });
  const bundle = mapPortfolioReactionBundle({
    lead,
    vehicleCardId: SPORTAGE_DUAL_TRACK_ID,
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
    offerId: SPORTAGE_DUAL_OFFER_IDS.FINANCING,
    reactionStatus: PORTFOLIO_REACTION_STATUS.DECLINED,
    declineReason: 'too_expensive',
    declineNote: 'Schlussrate zu hoch',
  });
  assert.equal(bundle.scenarioFeedback.length, 1);
  assert.equal(bundle.scenarioFeedback[0].reason, SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH);
  assert.ok(!bundle.trackFacts.some((f) => f.status === VEHICLE_TRACK_STATUS.DEFERRED));
}

// --- Seller interpret + apply ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const interpreted = interpretSellerInput(
    'Leasing gefällt besser. Finanzierung zu hohe Schlussrate.',
    { lead },
  );
  const feedbackFacts = interpreted.facts.filter((f) => f.field === 'scenarioOfferFeedback');
  assert.ok(feedbackFacts.length >= 2);

  const turn = buildCleverSellerTurnResult({
    rawInput: 'Leasing gefällt besser. Finanzierung zu hohe Schlussrate.',
    extractedFacts: feedbackFacts,
  });
  const applied = applyAcceptedSellerTurn(lead, turn, { sellerName: 'Test' });
  assert.equal(applied.ok, true);
  assert.equal(
    getScenarioOfferFeedback(applied.lead, SPORTAGE_DUAL_SCENARIO_IDS.LEASING).sentiment,
    SCENARIO_FEEDBACK_SENTIMENT.POSITIVE,
  );
  assert.equal(
    getScenarioOfferFeedback(applied.lead, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING).reason,
    SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
  );
  assert.equal(listCustomerVehicleTracks(applied.lead).length, 1);
  assert.equal(
    getVehicleTrackMeta(
      applied.lead.crm.vehicleConfigurations.find((c) => c.id === SPORTAGE_DUAL_TRACK_ID),
    ).status,
    VEHICLE_TRACK_STATUS.FAVORITE,
  );
}

// --- change request: andere Laufzeit via portal ---
{
  let lead = createSportageDualScenarioLead({ phase: 'ready' });
  lead = applyPortfolioReactionToTracks(lead, {
    vehicleCardId: SPORTAGE_DUAL_TRACK_ID,
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
    offerId: SPORTAGE_DUAL_OFFER_IDS.FINANCING,
    reactionStatus: PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
    questionText: 'andere Laufzeit gewünscht',
    changeDimension: 'term',
  });
  const fb = getScenarioOfferFeedback(lead, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING);
  assert.equal(fb.reason, SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM);
  assert.match(formatScenarioOfferFeedbackChip(fb, lead), /Laufzeit/i);
}

// --- portfolio items still dual ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const items = buildPortfolioItems({ lead, vehicleCards: [] })
    .filter((i) => i.sourceType === 'commercial_scenario');
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.commercialScenarioId));
}

__clearInboxTestMode?.();
console.log('scenarioOfferFeedback.test.js: OK');
