/**
 * Geführter Beratungsflow – Session, Follow-ups, Kontext
 */
import assert from 'node:assert/strict';
import {
  appendAdvisorExchange,
  buildAdvisorConversationSummary,
  createCustomerAdvisorSession,
  extractCustomerSignals,
  sessionToApiContext,
} from './customerAdvisorSession.js';
import { resolveContextualQuery } from './contextualQueryResolver.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';

const session = createCustomerAdvisorSession('dealer-test');
const ctx = sessionToApiContext(session);

const largestAmbiguous = await orchestrateCustomerQuery({
  query: 'Größtes Elektroauto?',
  useOpenAi: false,
});
assert.ok(largestAmbiguous.ok);
assert.ok(largestAmbiguous.followUpSuggestions?.length >= 3);
assert.match(largestAmbiguous.smartAnswer?.title ?? '', /größt|Größt/i);
assert.ok(largestAmbiguous.followUpSuggestions.some((s) => /EV9|Kofferraum|Außenmaße|7-Sitzer/i.test(s.label)));

const ev9Detail = await orchestrateCustomerQuery({
  query: 'Mehr Infos zum Kia EV9',
  useOpenAi: false,
  context: ctx,
});
assert.ok(ev9Detail.ok);
assert.equal(ev9Detail.facts.modelKey, 'ev9');
assert.ok(ev9Detail.followUpSuggestions?.length >= 3);
assert.match(ev9Detail.smartAnswer?.title ?? '', /EV9/i);

let activeSession = appendAdvisorExchange(session, 'Mehr Infos zum Kia EV9', ev9Detail);

const familyEv9 = await orchestrateCustomerQuery({
  query: 'Beste EV9-Variante für Familie',
  useOpenAi: false,
  context: sessionToApiContext(activeSession),
});
assert.ok(familyEv9.ok);
assert.match(familyEv9.smartAnswer?.title ?? '', /Familie/i);
assert.ok(familyEv9.followUpSuggestions?.length >= 3);

activeSession = appendAdvisorExchange(activeSession, 'Beste EV9-Variante für Familie', familyEv9);

const contextual = resolveContextualQuery('Und wenn ich einen Sorento Diesel nehme?', {
  modelsInFocus: ['ev9'],
});
assert.ok(contextual.enriched);
assert.deepEqual(contextual.comparisonModels, ['ev9', 'sorento']);

const sorentoCompare = await orchestrateCustomerQuery({
  query: 'Und wenn ich einen Sorento Diesel nehme?',
  useOpenAi: false,
  context: sessionToApiContext(activeSession),
});
assert.ok(sorentoCompare.ok);
assert.equal(sorentoCompare.classification.queryType, QUERY_TYPES.COMPARISON_QUESTION);
assert.ok(sorentoCompare.followUpSuggestions?.length >= 3);
assert.match(sorentoCompare.smartAnswer?.title ?? sorentoCompare.answer?.title ?? '', /Sorento|EV9|vergleich/i);

const towing = await orchestrateCustomerQuery({
  query: 'Wie weit kann ich mit einem Elektroauto meinen Anhänger ziehen?',
  useOpenAi: false,
});
assert.ok(towing.ok);
assert.equal(towing.classification.adviceTopicId, 'ev_towing_range');
assert.ok(towing.followUpSuggestions?.some((s) => /Anhänger|Verkäufer|EV9/i.test(s.label)));

activeSession = appendAdvisorExchange(activeSession, 'Anhänger Frage', towing);
const signals = extractCustomerSignals(activeSession);
assert.ok(signals.some((s) => /Anhänger/i.test(s)));

const summary = buildAdvisorConversationSummary(activeSession);
assert.ok(summary.includes('Beratungsverlauf'));

console.log('advisorConversationFlow.test.js: OK');
