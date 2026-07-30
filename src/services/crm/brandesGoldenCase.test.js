/**
 * Brandes Golden Case – Seed + Portal-Feedback → Tracks
 */
import assert from 'node:assert/strict';
import {
  BRANDES_LEAD_ID,
  BRANDES_TRACK_IDS,
  createBrandesGoldenCaseLead,
  cloneBrandesGoldenCaseLead,
} from './brandesGoldenCase.js';
import {
  listCustomerVehicleTracks,
  getVehicleTrackMeta,
  VEHICLE_TRACK_STATUS,
  REJECTION_REASON,
} from './vehicleTrack.js';
import { buildGoldenMoment, GOLDEN_MOMENT_TYPE } from '../journey/goldenMoment.js';
import {
  applyPortfolioEvent,
  PORTFOLIO_EVENTS,
  PORTFOLIO_REACTION_STATUS,
  PORTFOLIO_STATUS,
} from './customerOfferPortfolioService.js';
import {
  mapPortfolioReactionToTrackFeedback,
  applyPortfolioReactionToTracks,
} from './mapPortfolioReactionToTrackFeedback.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
} from './cleverInboxService.js';

__resetInboxStoreForTests([]);

// --- Seed: Golden Moment feuert ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  assert.equal(lead.id, BRANDES_LEAD_ID);
  assert.equal(lead.name, 'Herr Brandes');
  assert.equal(lead.wish.paymentType, 'leasing');
  assert.equal(lead.wish.termMonths, 48);
  assert.equal(lead.wish.mileagePerYear, 15000);
  assert.equal(lead.wish.downPayment, 0);

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 3);
  const xceed = tracks.find((t) => t.id === BRANDES_TRACK_IDS.XCEED);
  const sportage = tracks.find((t) => t.id === BRANDES_TRACK_IDS.SPORTAGE);
  const tivoli = tracks.find((t) => t.id === BRANDES_TRACK_IDS.TIVOLI);
  assert.equal(xceed.status, VEHICLE_TRACK_STATUS.FAVORITE);
  assert.equal(sportage.status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.equal(sportage.rejectionReason, REJECTION_REASON.PRICE_TOO_HIGH);
  assert.equal(tivoli.status, VEHICLE_TRACK_STATUS.OPEN);
  assert.ok(lead.crm.vehicleConfigurations.find((c) => c.id === BRANDES_TRACK_IDS.SPORTAGE));

  const moment = buildGoldenMoment(lead);
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER);
  assert.equal(moment.recommendedAction, 'prepare_revised_offer');
  assert.match(moment.headline, /XCeed/i);
  assert.equal(moment.score, null);
  assert.equal(moment.closureChance, null);
  assert.ok(!/%/.test(JSON.stringify(moment)));
}

// --- phase sent: noch kein Favorit ---
{
  const sent = createBrandesGoldenCaseLead({ phase: 'sent' });
  const tracks = listCustomerVehicleTracks(sent);
  assert.ok(tracks.every((t) => t.status === VEHICLE_TRACK_STATUS.OPEN));
  const moment = buildGoldenMoment(sent);
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.MULTI_COMPARE_READY);
}

// --- Mapping: INTERESTED → favorite ---
{
  const facts = mapPortfolioReactionToTrackFeedback({
    vehicleCardId: BRANDES_TRACK_IDS.XCEED,
    reactionStatus: PORTFOLIO_REACTION_STATUS.INTERESTED,
  });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].status, VEHICLE_TRACK_STATUS.FAVORITE);
}

// --- Mapping: DECLINED too_expensive → deferred + price_too_high ---
{
  const facts = mapPortfolioReactionToTrackFeedback({
    vehicleCardId: BRANDES_TRACK_IDS.SPORTAGE,
    reactionStatus: PORTFOLIO_REACTION_STATUS.DECLINED,
    declineReason: 'too_expensive',
  });
  assert.equal(facts[0].status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.equal(facts[0].rejectionReason, REJECTION_REASON.PRICE_TOO_HIGH);
}

// --- applyPortfolioReactionToTracks: Favorit ohne Löschen ---
{
  let lead = createBrandesGoldenCaseLead({ phase: 'sent' });
  lead = applyPortfolioReactionToTracks(lead, {
    vehicleCardId: BRANDES_TRACK_IDS.XCEED,
    reactionStatus: PORTFOLIO_REACTION_STATUS.INTERESTED,
  });
  lead = applyPortfolioReactionToTracks(lead, {
    vehicleCardId: BRANDES_TRACK_IDS.SPORTAGE,
    reactionStatus: PORTFOLIO_REACTION_STATUS.DECLINED,
    declineReason: 'too_expensive',
  });

  const configs = lead.crm.vehicleConfigurations;
  assert.equal(configs.length, 3, 'keine Spur gelöscht');
  assert.equal(
    getVehicleTrackMeta(configs.find((c) => c.id === BRANDES_TRACK_IDS.XCEED)).status,
    VEHICLE_TRACK_STATUS.FAVORITE,
  );
  assert.equal(
    getVehicleTrackMeta(configs.find((c) => c.id === BRANDES_TRACK_IDS.SPORTAGE)).status,
    VEHICLE_TRACK_STATUS.DEFERRED,
  );
  assert.equal(
    getVehicleTrackMeta(configs.find((c) => c.id === BRANDES_TRACK_IDS.SPORTAGE)).rejectionReason,
    REJECTION_REASON.PRICE_TOO_HIGH,
  );
}

// --- Portal applyPortfolioEvent: Brandes INTERESTED + DECLINED ---
{
  const base = cloneBrandesGoldenCaseLead({ phase: 'sent', id: 'lead-brandes-portal-test' });
  const portfolioItems = [
    {
      id: 'pu-xceed',
      sourceType: 'vehicle_card',
      vehicleCardId: BRANDES_TRACK_IDS.XCEED,
      modelKey: 'xceed',
      modelLabel: 'Kia XCeed',
      customerReaction: {
        status: PORTFOLIO_REACTION_STATUS.NONE,
        declineReason: null,
        declineNote: '',
        questionText: '',
        reactedAt: null,
      },
    },
    {
      id: 'pu-sportage',
      sourceType: 'vehicle_card',
      vehicleCardId: BRANDES_TRACK_IDS.SPORTAGE,
      modelKey: 'sportage',
      modelLabel: 'Kia Sportage',
      customerReaction: {
        status: PORTFOLIO_REACTION_STATUS.NONE,
        declineReason: null,
        declineNote: '',
        questionText: '',
        reactedAt: null,
      },
    },
    {
      id: 'pu-tivoli',
      sourceType: 'vehicle_card',
      vehicleCardId: BRANDES_TRACK_IDS.TIVOLI,
      modelKey: 'tivoli',
      modelLabel: 'Kia Tivoli',
      customerReaction: {
        status: PORTFOLIO_REACTION_STATUS.NONE,
        declineReason: null,
        declineNote: '',
        questionText: '',
        reactedAt: null,
      },
    },
  ];

  const leadWithPortfolio = {
    ...base,
    crm: {
      ...base.crm,
      customerOfferPortfolio: {
        id: 'pf-brandes',
        token: 'brandes-test-token',
        status: PORTFOLIO_STATUS.SENT,
        items: portfolioItems,
        tracking: { openCount: 0 },
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const interested = applyPortfolioEvent(
    leadWithPortfolio,
    'pu-xceed',
    PORTFOLIO_EVENTS.OFFER_INTERESTED,
    { token: 'brandes-test-token' },
  );
  assert.ok(interested.ok);
  assert.equal(
    getVehicleTrackMeta(
      interested.lead.crm.vehicleConfigurations.find((c) => c.id === BRANDES_TRACK_IDS.XCEED),
    ).status,
    VEHICLE_TRACK_STATUS.FAVORITE,
  );

  const declined = applyPortfolioEvent(
    interested.lead,
    'pu-sportage',
    PORTFOLIO_EVENTS.OFFER_DECLINED,
    { token: 'brandes-test-token', declineReason: 'too_expensive' },
  );
  assert.ok(declined.ok);
  const sportageMeta = getVehicleTrackMeta(
    declined.lead.crm.vehicleConfigurations.find((c) => c.id === BRANDES_TRACK_IDS.SPORTAGE),
  );
  assert.equal(sportageMeta.status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.equal(sportageMeta.rejectionReason, REJECTION_REASON.PRICE_TOO_HIGH);
  assert.equal(declined.lead.crm.vehicleConfigurations.length, 3);

  // XCeed bleibt Favorit; Tivoli offen; Sportage deferred → Golden Moment
  const moment = buildGoldenMoment(declined.lead);
  // Ohne Requirements noch FAVORITE_FOLLOW_UP – Requirements separat setzen wäre Seller-Pfad.
  // Hier: Favorit + deferred reicht für follow-up; INTERESTED allein setzt keine AHK/Rot.
  assert.ok(moment);
  assert.ok(
    moment.type === GOLDEN_MOMENT_TYPE.FAVORITE_FOLLOW_UP
      || moment.type === GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER,
  );
  assert.equal(moment.vehicleTrackId, BRANDES_TRACK_IDS.XCEED);
  assert.equal(moment.score, null);
}

__clearInboxTestMode();

console.log('brandesGoldenCase.test.js: ok');
