/**
 * Seller Inline Composer Assist – Golden Flows
 * node src/services/dealer/sellerInlineComposerAssist.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  INLINE_RESULT_TYPES,
  insertInlineFactIntoDraft,
  runSellerInlineAssist,
} from './sellerInlineComposerAssist.js';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from './sellerActionIntent.js';

const lead = {
  id: 'lead-inline-notz',
  name: 'Herr Notz',
  contact: { name: 'Herr Notz' },
  ownerName: 'Max Trinkle',
  crm: {
    needProfile: {
      ...createEmptyNeedProfile(),
      understoodLabels: [
        'Familie mit 2 Kindern',
        'AHK wichtig',
        'HUD wichtig',
        'sofortige Verfügbarkeit wichtig',
        'Terracotta interessant',
        'Leasing',
        '15.000 km/Jahr',
        'EV3 GT-Line',
      ],
    },
    sellerInsights: [
      { text: 'Schwarzmetallic sofort verfügbar', labels: ['Schwarzmetallic verfügbar'], createdAt: new Date().toISOString() },
    ],
  },
};

assert.equal(detectSellerActionIntent('EV4 Anhängelast'), SELLER_ACTION_INTENTS.LOOKUP_FACT);

const tow = runSellerInlineAssist(lead, 'EV4 Anhängelast');
assert.ok(tow.ok);
const towFact = tow.results.find((r) => r.type === INLINE_RESULT_TYPES.FACT_SUGGESTION);
assert.ok(towFact, 'verifizierte Anhängelast');
assert.equal(towFact.sourceStatus, 'verified');
assert.equal(towFact.modelKey, 'ev4');
assert.ok(Number(towFact.value) > 0);
assert.ok(/AHK/i.test(towFact.hint || towFact.relatedCustomerNeed || ''));

const range = runSellerInlineAssist(lead, 'Reichweite EV3');
assert.ok(range.ok);
const rangeFact = range.results.find((r) => r.type === INLINE_RESULT_TYPES.FACT_SUGGESTION);
assert.ok(rangeFact);
assert.equal(rangeFact.factKey, 'wltpRange');
assert.equal(rangeFact.sourceStatus, 'verified');

const conflict = runSellerInlineAssist(lead, 'Der EV4 zieht 1200 kg.');
assert.ok(conflict.ok);
const warn = conflict.results.find((r) => r.type === INLINE_RESULT_TYPES.CONFLICT_WARNING);
assert.ok(warn, 'Fact Conflict');
assert.equal(warn.claimed, 1200);
assert.notEqual(Number(warn.verified), 1200);

const inserted = insertInlineFactIntoDraft(
  'Hallo Herr Notz, der EV4 wäre interessant.',
  towFact.insertText,
);
assert.ok(inserted.includes('Anhängelast'));
assert.ok(inserted.includes('Hallo Herr Notz'));

const write = runSellerInlineAssist(
  lead,
  'Schreib ihm, dass Schwarzmetallic sofort verfügbar ist.',
);
assert.ok(write.ok);
const draft = write.results.find((r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT);
assert.ok(draft);
assert.ok(/Terracotta/i.test(draft.body), 'Customer Need bleibt getrennt');
assert.ok(/Schwarz/i.test(draft.body), 'Seller Fact');

const act = runSellerInlineAssist(
  lead,
  'Schick ihm die Selbstauskunft und sag, dass noch der Gehaltsnachweis fehlt.',
);
assert.ok(act.ok);
assert.equal(act.mode, 'act');
assert.ok(act.results.some((r) => r.type === INLINE_RESULT_TYPES.ACTION_DRAFT));

console.log('sellerInlineComposerAssist.test.js: ok');
