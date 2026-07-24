/**
 * sellerActionIntent + Seller Assistant Orchestrator
 * node src/services/dealer/sellerAssistantOrchestrator.test.js
 */
import assert from 'node:assert/strict';
import {
  SELLER_ACTION_INTENTS,
  buildSellerActionIntent,
  detectSellerActionIntent,
  extractSellerFactsFromInput,
} from './sellerActionIntent.js';
import {
  buildSellerMessageDraft,
  runSellerAssistantTurn,
} from './sellerAssistantOrchestrator.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';

assert.equal(
  detectSellerActionIntent('Ich habe einen EV3 GT-Line in Schwarzmetallic sofort verfügbar'),
  SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER,
);
assert.equal(
  detectSellerActionIntent('Mach Herrn Notz den EV4 GT-Line mit 21% und 329 Euro auf vier Jahre'),
  SELLER_ACTION_INTENTS.PREPARE_OFFER,
);

const facts = extractSellerFactsFromInput(
  'Ich habe einen EV3 GT-Line in Schwarzmetallic sofort verfügbar',
);
assert.ok(facts.some((f) => f.key === 'vehicle' && /EV3/i.test(f.label)));
assert.ok(facts.some((f) => f.key === 'color' && /Schwarz/i.test(f.label)));
assert.ok(facts.some((f) => f.key === 'availability'));
assert.ok(facts.every((f) => f.source === 'seller_input'));

const lead = {
  id: 'lead-notz',
  name: 'Herr Notz',
  ownerName: 'Mike Quach',
  crm: {
    needProfile: {
      ...createEmptyNeedProfile(),
      understoodLabels: [
        'EV3 GT-Line',
        'Leasing',
        'AHK wichtig',
        'Terracotta interessant',
      ],
      annualKm: 15000,
      leaseDurationMonths: 48,
    },
    sellerInsights: [],
  },
  wish: {
    mileagePerYear: 15000,
    downPayment: 0,
    termMonths: 48,
  },
};

const intent = buildSellerActionIntent(
  lead,
  'Ich habe sogar einen EV3 GT-Line in Schwarzmetallic da. Der wäre sofort verfügbar.',
);
assert.equal(intent.intent, SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER);
assert.ok(!intent.sellerFacts.some((f) => /Terracotta/i.test(f.label)), 'Seller-Fact ≠ Kundenwunsch');

const draft = buildSellerMessageDraft(lead, intent.sellerInput, intent.sellerFacts);
assert.ok(/Herr Notz/i.test(draft.body));
assert.ok(/Schwarzmetallic/i.test(draft.body));
assert.ok(/Terracotta/i.test(draft.body), 'Kundenfarbe im Draft');
assert.ok(/Anhängerkupplung/i.test(draft.body), 'AHK-Kontext ohne erfundene kg');
assert.ok(!/1\.?200\s*kg/i.test(draft.body), 'keine erfundenen Anhängelast-Werte');

const turn = runSellerAssistantTurn(lead, intent.sellerInput);
assert.equal(turn.result.type, 'message_draft');
assert.equal(turn.requiresSellerConfirmation, true);
assert.ok(turn.result.opportunity?.source === 'seller_input');

const offerTurn = runSellerAssistantTurn(
  lead,
  'Mach Herrn Notz den EV4 GT-Line mit DriveWise in Weiß, 21 Prozent, 329 Euro auf vier Jahre.',
  { modeHint: 'offer' },
);
assert.equal(offerTurn.actionIntent.intent, SELLER_ACTION_INTENTS.PREPARE_OFFER);
assert.equal(offerTurn.result.type, 'offer_draft');
assert.ok(
  offerTurn.result.inheritedFromCustomer.some((i) => /15\.000|15000/i.test(i.label)),
  'km aus Kundenwunsch',
);

console.log('sellerAssistantOrchestrator.test.js: ok');
