/**
 * Slice 8: Contract Golden Moments
 * node --test src/services/cleverSeller/globalComposer.slice8.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  evaluateContractGoldenSignals,
  buildContractGoldenBodyLines,
} from './contractGoldenSignals.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import {
  buildGoldenMoment,
  GOLDEN_MOMENT_TYPE,
} from '../journey/goldenMoment.js';
import {
  evaluateJourneyReminder,
} from '../journey/journeyReminderService.js';
import {
  JOURNEY_REMINDER_RULE_IDS,
  resolveLeasingEndDate,
} from '../journey/journeyReminderRules.js';

const NOW = new Date('2026-07-31T10:00:00+02:00');
const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

function brandesWithContract() {
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN_CONTRACT,
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  return applied.lead;
}

// --- Signals ---
{
  const lead = brandesWithContract();
  const signals = evaluateContractGoldenSignals(lead, { now: NOW });
  assert.equal(signals.active, true);
  assert.equal(signals.within12m, true);
  assert.equal(signals.within6m, true);
  assert.equal(signals.within3m, false);
  assert.equal(signals.needsMileageCheck, true);
  assert.equal(signals.endDate, '2026-11-30');
  assert.equal(signals.source, 'customer_contract');
  assert.ok(signals.favorite);
  assert.equal(signals.followUpOfferMissing, true);
  const lines = buildContractGoldenBodyLines(lead, signals, { now: NOW });
  assert.ok(lines.some((l) => /30\.11\.2026/.test(l)));
  assert.ok(lines.some((l) => /XCeed/i.test(l)));
  assert.ok(lines.some((l) => /Nachfolgeangebot/i.test(l)));
}

// --- Golden Moment type ---
{
  const lead = brandesWithContract();
  const moment = buildGoldenMoment(lead, { now: NOW });
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.CONTRACT_SUCCESSION);
  assert.match(moment.primaryLabel, /XCeed.*Nachfolgeangebot/i);
  assert.match(moment.headline, /Leasingvertrag|endet/i);
  assert.equal(moment.score, null);
  assert.equal(moment.closureChance, null);
  assert.ok(!/%/.test(JSON.stringify(moment)));
}

// --- resolveLeasingEndDate from contract ---
{
  const lead = brandesWithContract();
  assert.equal(resolveLeasingEndDate(lead), '2026-11-30');
}

// --- Journey reminder 6m (Juli→Nov = 4 Monate), ohne Favoriten-Konflikt ---
{
  const lead = brandesWithContract();
  // Nur Vertrags-Signal: Favoriten-Spuren entfernen, damit LEASING_EXPIRES greift
  lead.crm.vehicleConfigurations = (lead.crm.vehicleConfigurations || []).map((c) => ({
    ...c,
    vehicleTrack: { ...(c.vehicleTrack || {}), status: 'open' },
  }));
  const reminder = evaluateJourneyReminder(lead, { now: NOW });
  assert.ok(reminder?.active);
  assert.equal(reminder.ruleId, JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_6M);
}

// --- Journey reminder 3m ---
{
  const lead = brandesWithContract();
  lead.crm.vehicleConfigurations = (lead.crm.vehicleConfigurations || []).map((c) => ({
    ...c,
    vehicleTrack: { ...(c.vehicleTrack || {}), status: 'open' },
  }));
  lead.crm.customerContracts[0].dates.contractEndDate = '2026-09-30';
  lead.wish.leasingEndDate = '2026-09-30';
  const reminder = evaluateJourneyReminder(lead, { now: NOW });
  assert.equal(reminder.ruleId, JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_3M);
}

// --- Journey reminder 12m ---
{
  const lead = brandesWithContract();
  lead.crm.vehicleConfigurations = (lead.crm.vehicleConfigurations || []).map((c) => ({
    ...c,
    vehicleTrack: { ...(c.vehicleTrack || {}), status: 'open' },
  }));
  lead.crm.customerContracts[0].dates.contractEndDate = '2027-05-31';
  lead.wish.leasingEndDate = '2027-05-31';
  const reminder = evaluateJourneyReminder(lead, { now: NOW });
  assert.equal(reminder.ruleId, JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_12M);
}

// --- Mit Favorit: Favorite-Reminder hat Vorrang, Golden Moment bleibt Contract Succession ---
{
  const lead = brandesWithContract();
  const reminder = evaluateJourneyReminder(lead, { now: NOW });
  assert.ok(reminder?.active);
  assert.ok([
    JOURNEY_REMINDER_RULE_IDS.FAVORITE_NEEDS_REVISED_OFFER,
    JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_6M,
  ].includes(reminder.ruleId));
  const moment = buildGoldenMoment(lead, { now: NOW });
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.CONTRACT_SUCCESSION);
}

// --- Composer: nächster Schritt ---
{
  const lead = brandesWithContract();
  const interpreted = interpretSellerInput('Was ist der nächste Schritt?');
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP));

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Was ist der nächste Schritt?',
    customerName: 'Brandes',
  });
  assert.ok(turn.goldenMoment || turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP));
  const moment = turn.goldenMoment
    || turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP)?.payload?.goldenMoment;
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.CONTRACT_SUCCESSION);
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.ok(review.actionSections.some((s) => s.kind === 'golden_moment'));
  assert.match(String(review.actionSections.find((s) => s.kind === 'golden_moment')?.body || review.actionSections.find((s) => s.kind === 'golden_moment')?.headline || ''), /30\.11\.2026|XCeed|Nachfolge/i);
}

// --- Composer: Nachfolgeangebot phrasing ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Bereite ein Nachfolgeangebot vor.',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP)
    || turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP)
    || turn.goldenMoment);
}

// --- Keine Auto-Nachricht ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Was ist der nächste Schritt?',
  });
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared' && a.payload?.autoSend
  )));
  assert.equal(turn.proposedUpdates?.length || 0, 0);
}

console.log('globalComposer.slice8.test.js: ok');
