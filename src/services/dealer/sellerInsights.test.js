/**
 * sellerInsights – Service-Tests
 */
import assert from 'node:assert/strict';
import {
  appendSellerInsightToLead,
  createSellerInsight,
  getSellerInsightsFromLead,
  hasSellerInsights,
  normalizeSellerInsights,
  SELLER_INSIGHT_SOURCE,
} from './sellerInsights.js';

const insight = createSellerInsight(
  'Anhängelast jetzt doch 2.500 kg. Hund fährt regelmäßig mit.',
  { context: 'phone_call' },
);
assert.ok(insight, 'Insight erstellt');
assert.equal(insight.source, SELLER_INSIGHT_SOURCE);
assert.equal(insight.context, 'phone_call');
assert.ok(insight.understoodLabels.length >= 1, 'Parser erzeugt Labels');
assert.ok(
  insight.understoodLabels.some((label) => /anhängelast|hund/i.test(label)),
  `Labels: ${insight.understoodLabels.join(', ')}`,
);

const lead = appendSellerInsightToLead({ id: 'lead-1', crm: {} }, insight.text, {
  context: 'phone_call',
});
assert.ok(hasSellerInsights(lead));
assert.equal(getSellerInsightsFromLead(lead).length, 1);
assert.equal(getSellerInsightsFromLead(lead)[0].text, insight.text);

const leadTwo = appendSellerInsightToLead(lead, 'Dachzelt wird regelmäßig genutzt.');
assert.equal(getSellerInsightsFromLead(leadTwo).length, 2);

const normalized = normalizeSellerInsights([
  { text: 'Hund fährt mit', createdAt: '2026-01-02T10:00:00.000Z' },
  { text: 'Lieferzeit wichtiger als Preis', createdAt: '2026-01-01T10:00:00.000Z' },
]);
assert.equal(normalized[0].text, 'Lieferzeit wichtiger als Preis', 'chronologisch sortiert');

const baseLead = {
  id: 'lead-need-profile',
  crm: {
    needProfile: {
      rawMessages: ['Ich suche einen EV3'],
      initialWish: 'Ich suche einen EV3',
      version: 1,
    },
  },
};
const withInsight = appendSellerInsightToLead(baseLead, 'Hund fährt regelmäßig mit.');
assert.deepEqual(withInsight.crm.needProfile, baseLead.crm.needProfile, 'needProfile bleibt unverändert');
assert.equal(withInsight.crm.sellerInsights.length, 1);

console.log('sellerInsights.test.js: ok');
