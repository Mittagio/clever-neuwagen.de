/**
 * OpenAI-Wissensschicht – Allgemeinwissen, Fremdmarken, Händlerdaten-Grenzen
 */
import assert from 'node:assert/strict';
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES } from './customerQueryTypes.js';
import { routeQueryKnowledge } from './queryKnowledgeRouting.js';
import { KNOWLEDGE_ROUTES } from './customerQueryTypes.js';

const zeekrByd = classifyWithRules('Zeekr Reichweite oder BYD Seal 6?');
assert.equal(zeekrByd.queryType, QUERY_TYPES.COMPETITOR_COMPARISON);

const zeekrOrchestrated = await orchestrateCustomerQuery({
  query: 'Zeekr Reichweite oder BYD Seal 6?',
  useOpenAi: false,
});
assert.ok(zeekrOrchestrated.ok);
assert.equal(zeekrOrchestrated.facts.kind, 'general_knowledge');
assert.match(zeekrOrchestrated.answer?.body ?? '', /Zeekr|BYD|Plug-in|Elektro/i);
assert.match(zeekrOrchestrated.answer?.body ?? '', /Kia|EV4|EV5|EV6/i);
assert.ok(zeekrOrchestrated.followUpSuggestions?.length >= 3);
assert.ok(zeekrOrchestrated.followUpSuggestions.some((s) => /EV4|Kia|Verkäufer/i.test(s.label)));

const gleEv9 = await orchestrateCustomerQuery({
  query: 'Mercedes GLE oder Kia EV9?',
  useOpenAi: false,
});
assert.ok(gleEv9.ok);
assert.equal(gleEv9.classification.queryType, QUERY_TYPES.COMPETITOR_COMPARISON);
assert.match(gleEv9.answer?.body ?? '', /GLE|EV9|Diesel|Elektro|Laden/i);
assert.match(gleEv9.answer?.body ?? '', /Autohaus/i);
assert.ok(gleEv9.followUpSuggestions?.some((s) => /Angebot|EV9|Anhänger|Fahrprofil/i.test(s.label)));

const wohnwagen = await orchestrateCustomerQuery({
  query: 'Wie weit komme ich mit Wohnwagen elektrisch?',
  useOpenAi: false,
});
assert.ok(wohnwagen.ok);
assert.match(wohnwagen.answer?.body ?? '', /Anhänger|Reichweite|sinkt|Gewicht/i);
assert.doesNotMatch(wohnwagen.answer?.body ?? '', /weiß ich nicht|keine Antwort/i);
assert.ok(wohnwagen.followUpSuggestions?.length >= 3);

const dieselEv = await orchestrateCustomerQuery({
  query: 'Was ist besser Diesel oder Elektro?',
  useOpenAi: false,
});
assert.ok(dieselEv.ok);
assert.equal(dieselEv.classification.queryType, QUERY_TYPES.GENERAL_CAR_COMPARISON);
assert.match(dieselEv.answer?.body ?? '', /Diesel|Elektro/i);
assert.ok(dieselEv.followUpSuggestions?.some((s) => /Fahrprofil|Kia|beraten/i.test(s.label)));

const ev4HeatPump = await orchestrateCustomerQuery({
  query: 'Hat EV4 Wärmepumpe?',
  useOpenAi: false,
});
assert.ok(ev4HeatPump.ok);
assert.equal(ev4HeatPump.classification.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4HeatPump.classification.modelKey, 'ev4');
const heatRoute = routeQueryKnowledge('Hat EV4 Wärmepumpe?', ev4HeatPump.classification);
assert.equal(heatRoute.route, KNOWLEDGE_ROUTES.CLEVER_DATA);

const ev4Leasing = await orchestrateCustomerQuery({
  query: 'EV4 Leasingrate 48 Monate 10.000 km',
  useOpenAi: false,
});
assert.ok(ev4Leasing.ok);
assert.equal(ev4Leasing.classification.modelKey, 'ev4');
assert.equal(ev4Leasing.classification.needsDealerCheck, true);
assert.match(ev4Leasing.answer?.body ?? '', /Autohaus|Rate|Händler/i);
assert.doesNotMatch(ev4Leasing.answer?.body ?? '', /^\d+.*€/);

console.log('generalKnowledgeFlow.test.js: OK');
