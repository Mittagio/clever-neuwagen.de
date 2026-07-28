/**
 * Universal Composer Review: Model + Accept → sellerInsights / tradeIn
 * node src/services/cleverSeller/universalReviewFlow.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { getSellerInsightsFromLead } from '../dealer/sellerInsights.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';

const emptyLead = {
  id: 'lead-review-1',
  name: 'Herr Norz',
  wish: { paymentType: 'leasing', termMonths: 48, annualMileage: 15000 },
  crm: {
    needProfile: createEmptyNeedProfile(),
    customerMessages: [],
    customerMessageThreads: [],
    sellerInsights: [],
  },
};

const dump = `netto 2800
2 kinder
verheiratet
ford kuga
leasing läuft 11/2026 aus
300 euro wunschrate
auto nehmen wir in zahlung`;

const turn = runCleverSellerTurn({ lead: emptyLead, sellerInput: dump });
assert.equal(shouldShowUniversalReview(turn), true);

const model = buildUniversalReviewModel(turn);
assert.ok(model);
assert.equal(model.title, '✨ Clever hat verstanden');
assert.ok(model.factCount >= 5);
assert.match(model.summaryLine, /Neu erkannt/);
assert.ok(model.groups.some((g) => g.id === 'customer'));
assert.ok(model.groups.some((g) => g.id === 'finance'));
assert.ok(model.groups.some((g) => g.id === 'vehicle_current'));
assert.ok(model.groups.some((g) => g.id === 'contract'));
assert.equal(model.primaryCta, 'Übernehmen');

// Outlook-Dump → Review-Gruppen
const outlookDump = `Eduard Hafner Urbach Interesse an PROBEFAHRT KIA SELTOS / KIA K4 SW 0179 7072736 Skoda Octavia Schalter
Do 30.07.2026 10:00
Automatik
Schiebedach
GT LINE / X LINE 3`;
const outlookTurn = runCleverSellerTurn({ lead: emptyLead, sellerInput: outlookDump });
assert.equal(shouldShowUniversalReview(outlookTurn), true);
const outlookModel = buildUniversalReviewModel(outlookTurn);
assert.ok(outlookModel);
assert.ok(outlookModel.groups.some((g) => g.id === 'customer' && /Hafner/i.test(g.line)));
assert.ok(outlookModel.groups.some((g) => g.id === 'appointment' && /Probefahrt/i.test(g.line)));
assert.ok(outlookModel.groups.some((g) => g.id === 'wish' && /Seltos/i.test(g.line)));
assert.ok(outlookModel.groups.some((g) => g.id === 'vehicle_current' && /Octavia/i.test(g.line)));

const applied = applyAcceptedSellerTurn(emptyLead, turn, { postFeedCard: false });
assert.equal(applied.ok, true);
assert.ok(applied.acceptedLabels.length >= 5);

const insights = getSellerInsightsFromLead(applied.lead);
assert.ok(insights.length >= 5);
assert.ok(insights.some((i) => /2\.?800|2800|Netto/i.test(i.text)));
assert.ok(insights.some((i) => /Kinder|verheiratet/i.test(i.text)));

const tradeIn = getTradeIn(applied.lead);
assert.ok(/Kuga/i.test(tradeIn.vehicle || ''));
assert.ok(/Inzahlungnahme/i.test(tradeIn.notes || ''));
assert.equal(applied.lead.desiredRate, 300);
assert.equal(applied.lead.wish?.desiredRate, 300);

assert.equal(shouldShowUniversalReview({ extractedFacts: [] }), false);
assert.equal(
  shouldShowUniversalReview({
    extractedFacts: [{ label: 'x', factClass: 'customer_fact' }],
    intents: [{ type: 'update_customer_context' }],
  }),
  true,
);

console.log('universalReviewFlow.test.js: ok');
