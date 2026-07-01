/**
 * Händler-Markenwelt – Abnahme Frag Clever
 */
import assert from 'node:assert/strict';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES } from './customerQueryTypes.js';
import { filterFollowUpsForBrandScope, getDealerBrandScope } from './dealerBrandScope.js';

const TRINKLE = 'autohaus-trinkle';
const BYD_DEALER = 'byd-haendler-demo';
const trinkleScope = getDealerBrandScope(TRINKLE);

function assertNoForeignFollowUps(followUps, scope) {
  const filtered = filterFollowUpsForBrandScope(followUps, scope);
  for (const item of filtered) {
    assert.doesNotMatch(item.label ?? '', /Mehr Infos zum Mercedes|Mercedes EQB Angebot|Zeekr technisch|BYD Angebot anfragen/i);
    assert.doesNotMatch(item.query ?? '', /Mehr Infos zum Mercedes|Mercedes EQB Kosten|Zeekr Angebot/i);
  }
  return filtered;
}

const eqb = await orchestrateCustomerQuery({
  query: 'Größe von Mercedes EQB und Kosten',
  dealerId: TRINKLE,
  useOpenAi: false,
});
assert.ok(eqb.ok);
assert.match(eqb.answer?.body ?? '', /EQB|Mercedes|kompakt/i);
assert.match(eqb.answer?.body ?? '', /verbindlich|Autohaus|Markenwelt|Alternativ/i);
assert.match(eqb.answer?.body ?? '', /EV5|EV9|Kia/i);
assert.ok(eqb.competitorInterest);
assert.equal(eqb.classification.queryType, QUERY_TYPES.COMPETITOR_QUESTION);
const eqbFollowUps = assertNoForeignFollowUps(eqb.followUpSuggestions ?? [], trinkleScope);
assert.ok(eqbFollowUps.some((s) => /EV5|EV9|Marken/i.test(s.label)));

const gleEv9 = await orchestrateCustomerQuery({
  query: 'Mercedes GLE oder EV9',
  dealerId: TRINKLE,
  useOpenAi: false,
});
assert.ok(gleEv9.ok);
assert.match(gleEv9.answer?.body ?? '', /EV9|GLE|Mercedes/i);
assert.match(gleEv9.answer?.body ?? '', /Autohaus/i);
const gleFollowUps = assertNoForeignFollowUps(gleEv9.followUpSuggestions ?? [], trinkleScope);
assert.ok(gleFollowUps.some((s) => /EV9/i.test(s.label)));
assert.ok(!gleFollowUps.some((s) => /Mehr Infos zum Mercedes|GLE Angebot/i.test(s.label)));

const zeekrByd = await orchestrateCustomerQuery({
  query: 'Zeekr Reichweite oder BYD Seal 6?',
  dealerId: TRINKLE,
  useOpenAi: false,
});
assert.ok(zeekrByd.ok);
assert.match(zeekrByd.answer?.body ?? '', /Zeekr|BYD|Elektro|Plug-in/i);
assert.match(zeekrByd.answer?.body ?? '', /Markenwelt|Kia|Alternativ/i);
const zbFollowUps = assertNoForeignFollowUps(zeekrByd.followUpSuggestions ?? [], trinkleScope);
assert.ok(zbFollowUps.some((s) => /EV4|EV5|Verkäufer/i.test(s.label)));
assert.ok(!zbFollowUps.some((s) => /Mehr Infos zum Zeekr|BYD Angebot/i.test(s.label)));

const ev9Info = await orchestrateCustomerQuery({
  query: 'Mehr Infos zu EV9',
  dealerId: TRINKLE,
  useOpenAi: false,
});
assert.ok(ev9Info.ok);
assert.match(ev9Info.answer?.body ?? '', /EV9/i);
assert.doesNotMatch(ev9Info.answer?.body ?? '', /führen wir nicht/i);

const bydCompare = await orchestrateCustomerQuery({
  query: 'Zeekr oder BYD Seal 6?',
  dealerId: BYD_DEALER,
  useOpenAi: false,
});
assert.ok(bydCompare.ok);
assert.match(bydCompare.answer?.body ?? '', /BYD|Zeekr|Seal/i);
const bydFollowUps = bydCompare.followUpSuggestions ?? [];
assert.ok(bydFollowUps.some((s) => /BYD|Seal/i.test(s.label)));
assert.ok(!bydFollowUps.some((s) => /Mehr Infos zum Zeekr|Zeekr Angebot/i.test(s.label)));

assert.equal(eqb.dealerBrandScope?.allowedBrands?.join(','), 'kia,suzuki,kgm');

console.log('dealerBrandScopeFlow.test.js: OK');
