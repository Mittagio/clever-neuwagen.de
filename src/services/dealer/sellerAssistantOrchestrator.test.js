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
  buildSellerCleverMoment,
  buildSellerMessageDraft,
  runSellerAssistantTurn,
} from './sellerAssistantOrchestrator.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';

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

assert.equal(
  detectSellerActionIntent('Schreib Herrn Notz, dass noch Gehaltsnachweis und Selbstauskunft fehlen'),
  SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS,
);

const workspaceTurn = runSellerAssistantTurn(
  lead,
  'Schreib Herrn Notz, dass noch Gehaltsnachweis und Selbstauskunft fehlen.',
);
assert.equal(workspaceTurn.result.type, 'workspace_package');
assert.ok(workspaceTurn.result.actions?.length >= 1);
assert.equal(workspaceTurn.requiresSellerConfirmation, true);

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

const momentLead = {
  ...lead,
  crm: {
    ...lead.crm,
    customerOfferPortfolio: {
      id: 'pf-1',
      items: [
        {
          id: 'u1',
          modelLabel: 'Kia EV3 GT-Line',
          customerReaction: {
            status: PORTFOLIO_REACTION_STATUS.INTERESTED,
            questionText: '',
            reactedAt: '2026-07-24T09:20:00.000Z',
          },
        },
        {
          id: 'u2',
          modelLabel: 'Kia EV3 GT-Line',
          customerReaction: {
            status: PORTFOLIO_REACTION_STATUS.MORE_INFO,
            questionText: 'Wie hoch ist die Anhängelast?',
            reactedAt: '2026-07-24T09:25:00.000Z',
          },
        },
      ],
      tracking: { lastOpenedAt: '2026-07-24T09:10:00.000Z' },
    },
  },
};

const moment = buildSellerCleverMoment(momentLead);
assert.ok(moment);
assert.ok(/EV3/i.test(moment.summary));
assert.ok(/Anhängelast/i.test(moment.summary));
assert.equal(moment.primaryAction.modeHint, 'message');

console.log('sellerAssistantOrchestrator.test.js: ok');
