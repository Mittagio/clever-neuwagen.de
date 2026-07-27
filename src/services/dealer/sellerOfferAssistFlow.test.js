/**
 * node src/services/dealer/sellerOfferAssistFlow.test.js
 */
import assert from 'node:assert/strict';
import {
  enrichOfferTextWithCustomerWish,
  isOfferAssistFollowUp,
  runSellerOfferAssist,
} from './sellerOfferAssistFlow.js';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from './sellerActionIntent.js';
import { parseMagicOfferIntent } from './magicOfferIntentParser.js';
import { INLINE_RESULT_TYPES } from './sellerInlineComposerAssist.js';

assert.equal(
  detectSellerActionIntent('Barangebot für EV5 GT-Line in Schwarz erstellen.'),
  SELLER_ACTION_INTENTS.PREPARE_OFFER,
  'Barangebot → prepare_offer',
);

const parsed = parseMagicOfferIntent('Barangebot für EV5 GT-Line in Schwarz erstellen.');
assert.equal(parsed.offerType, 'purchase', 'Barangebot → purchase');
assert.match(String(parsed.vehicleRequest?.modelHint ?? ''), /ev5/i);

const lead = {
  id: 'lead-test12',
  name: 'TEST12',
  paymentType: 'leasing',
  wish: {
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
  },
  crm: {
    needProfile: {
      selectedModelKey: 'ev5',
      understoodLabels: ['AHK wichtig', 'Familie'],
    },
    sellerInsights: [],
  },
  history: [],
};

const enriched = enrichOfferTextWithCustomerWish(lead, 'EV5 GT-Line Leasing vorbereiten.');
assert.match(enriched, /48 Monate/);
assert.match(enriched, /10\.000 km|10000 km/i);
assert.match(enriched, /Anzahlung|keine/i);

const first = runSellerOfferAssist(lead, 'Barangebot für EV5 GT-Line in Schwarz erstellen.');
assert.ok(first?.ok, 'Offer assist startet');
assert.equal(first.results[0].type, INLINE_RESULT_TYPES.OFFER_DRAFT);
assert.ok(
  /rabatt|offen|bereit|vorbereitet/i.test(`${first.results[0].body} ${first.results[0].hint}`),
  'fragt nach fehlendem Rabatt oder zeigt Status',
);
assert.ok(first.results[0].ahkRelevance, 'AHK aus Notizzettel situativ');

assert.equal(isOfferAssistFollowUp('21 %', first.previousPreparation), true);

const second = runSellerOfferAssist(lead, '21 Prozent', {
  previousPreparation: first.previousPreparation,
});
assert.ok(second?.ok, 'Follow-up Rabatt');
assert.equal(
  second.previousPreparation?.intent?.commercialInput?.discountPercent,
  21,
  'Rabatt übernommen',
);

const probe = runSellerOfferAssist(lead, 'Probefahrt morgen um 10 bestätigen.');
assert.equal(probe, null, 'Probefahrt startet keinen Offer-Flow');

console.log('sellerOfferAssistFlow.test.js: ok');
