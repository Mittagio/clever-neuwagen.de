/**
 * Hybrid Kundenquery – Orchestrator, Ranking, Beratung & Vergleich
 */
import assert from 'node:assert/strict';
import { classifyWithRules, detectRankingContext, detectRankingMetric } from './customerQueryRuleFallback.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES, UI_COMPONENTS, RANKING_METRICS } from './customerQueryTypes.js';
import { getRankingByMetric } from './customerQueryTools.js';
import { matchAdviceTopicByQuery } from './adviceTopicMatcher.js';

const heatPumpAdvice = classifyWithRules('Warum sollte ich eine Wärmepumpe nehmen?');
assert.equal(heatPumpAdvice.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(heatPumpAdvice.adviceTopicId, 'heat_pump');
assert.equal(heatPumpAdvice.shouldShowModels, false);

const heatPumpAdviceQueries = [
  'Wofür ist eine Wärmepumpe gut?',
  'Was bringt eine Wärmepumpe?',
  'Welche Vorteile hat eine Wärmepumpe?',
  'Ist eine Wärmepumpe gut?',
  'Brauche ich eine Wärmepumpe?',
  'Lohnt sich eine Wärmepumpe?',
  'Mit oder ohne Wärmepumpe?',
];
for (const q of heatPumpAdviceQueries) {
  const result = classifyWithRules(q);
  assert.equal(result.queryType, QUERY_TYPES.ADVICE_QUESTION, `${q} → advice_question`);
  assert.equal(result.adviceTopicId, 'heat_pump', `${q} → heat_pump`);
  assert.equal(result.shouldShowModels, false, `${q} → keine Modellkarten`);
}

const towingRange = classifyWithRules('Wie weit kann ich mit einem Elektroauto meinen Anhänger ziehen?');
assert.equal(towingRange.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(towingRange.adviceTopicId, 'ev_towing_range');
assert.equal(towingRange.shouldShowModels, false);

const wohnwagen = classifyWithRules('Wie weit komme ich mit Wohnwagen?');
assert.equal(wohnwagen.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(wohnwagen.adviceTopicId, 'ev_towing_range');

const ev4TrailerTech = classifyWithRules('EV4 Anhängelast?');
assert.equal(ev4TrailerTech.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4TrailerTech.modelKey, 'ev4');

const ev4TrailerWish = classifyWithRules('Ich suche EV4 mit Anhängelast');
assert.equal(ev4TrailerWish.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(ev4TrailerWish.modelKey, 'ev4');

const towingRanking = classifyWithRules('Welcher Kia zieht am meisten?');
assert.equal(towingRanking.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(towingRanking.rankingMetric, RANKING_METRICS.TOWING);

const ev4Feature = classifyWithRules('EV4 mit oder ohne Wärmepumpe?');
assert.equal(ev4Feature.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4Feature.modelKey, 'ev4');
assert.equal(ev4Feature.featureId, 'heat_pump');

const ev4Wish = classifyWithRules('Ich suche EV4 mit Wärmepumpe');
assert.equal(ev4Wish.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(ev4Wish.modelKey, 'ev4');

const ev4MitFeature = classifyWithRules('EV4 mit Wärmepumpe');
assert.equal(ev4MitFeature.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(ev4MitFeature.modelKey, 'ev4');

const ev4Equipment = classifyWithRules('EV4 Wärmepumpe');
assert.equal(ev4Equipment.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4Equipment.modelKey, 'ev4');

const ev4HasFeature = classifyWithRules('Hat der EV4 eine Wärmepumpe?');
assert.equal(ev4HasFeature.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4HasFeature.modelKey, 'ev4');

const vehicleWish = classifyWithRules('E-Auto bis 400 € SUV');
assert.equal(vehicleWish.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(vehicleWish.shouldShowModels, true);

const special = classifyWithRules('Kann ich Windabweiser am EV4 montieren?');
assert.equal(special.queryType, QUERY_TYPES.SPECIAL_CHECK_QUESTION);
assert.equal(special.shouldAskForContact, true);

const trunkRanking = classifyWithRules('welcher kia den größten kofferraum?');
assert.equal(trunkRanking.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(trunkRanking.rankingMetric, RANKING_METRICS.TRUNK_VOLUME);

const rangeRanking = classifyWithRules('mit welchem kia komme ich am weitesten?');
assert.equal(rangeRanking.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(rangeRanking.rankingMetric, RANKING_METRICS.WLTP_RANGE);

const compareQ = classifyWithRules('EV4 oder EV5 größer?');
assert.equal(compareQ.queryType, QUERY_TYPES.COMPARISON_QUESTION);
assert.deepEqual(compareQ.comparisonModels, ['ev4', 'ev5']);

assert.equal(detectRankingMetric('mit welchem kia komme ich am weitesten?'), RANKING_METRICS.WLTP_RANGE);

assert.ok(matchAdviceTopicByQuery('Leasing oder Finanzierung?'));

const trunkRankData = getRankingByMetric(RANKING_METRICS.TRUNK_VOLUME);
assert.ok(trunkRankData?.matches?.length >= 2);
assert.ok(trunkRankData.matches[0].facts.trunkL >= trunkRankData.matches[1].facts.trunkL);

const orchestratedAdvice = await orchestrateCustomerQuery({
  query: 'Warum sollte ich eine Wärmepumpe nehmen?',
  useOpenAi: false,
});
assert.ok(orchestratedAdvice.ok);
assert.equal(orchestratedAdvice.classification.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.ok(orchestratedAdvice.answer?.body);
assert.match(orchestratedAdvice.answer.body, /Wärmepumpe|Reichweite|Umgebungswärme/i);
assert.equal(orchestratedAdvice.ui.component, UI_COMPONENTS.ADVICE_ANSWER);

const orchestratedTowing = await orchestrateCustomerQuery({
  query: 'Wie weit kann ich mit einem Elektroauto meinen Anhänger ziehen?',
  useOpenAi: false,
});
assert.ok(orchestratedTowing.ok);
assert.equal(orchestratedTowing.classification.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(orchestratedTowing.classification.adviceTopicId, 'ev_towing_range');
assert.equal(orchestratedTowing.ui.component, UI_COMPONENTS.ADVICE_ANSWER);
assert.equal(orchestratedTowing.ui.shouldShowModels, false);
assert.ok(orchestratedTowing.smartAnswer?.title);
assert.match(orchestratedTowing.smartAnswer.title, /Anhänger|Reichweite/i);
assert.ok(orchestratedTowing.smartAnswer.usefulWhen?.length >= 3);
assert.ok(orchestratedTowing.smartAnswer.showDealerCta);
assert.ok(orchestratedTowing.adviceContact?.adviceTopicId === 'ev_towing_range');

const orchestratedWofuer = await orchestrateCustomerQuery({
  query: 'Wofür ist eine Wärmepumpe gut?',
  useOpenAi: false,
});
assert.ok(orchestratedWofuer.ok);
assert.equal(orchestratedWofuer.classification.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(orchestratedWofuer.ui.component, UI_COMPONENTS.ADVICE_ANSWER);
assert.match(orchestratedWofuer.answer?.body ?? '', /Wärmepumpe|Reichweite|Umgebungswärme/i);

const orchestratedTrunk = await orchestrateCustomerQuery({
  query: 'welcher kia den größten kofferraum?',
  useOpenAi: false,
});
assert.ok(orchestratedTrunk.ok);
assert.equal(orchestratedTrunk.classification.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(orchestratedTrunk.ui.component, UI_COMPONENTS.RANKING_ANSWER);
assert.ok(orchestratedTrunk.smartAnswer?.title);
assert.match(orchestratedTrunk.smartAnswer.title, /Kofferraum|Liter|führt/i);
assert.ok(orchestratedTrunk.smartAnswer.highlights?.length >= 2);
assert.doesNotMatch(orchestratedTrunk.answer?.body ?? '', /Alltag, Budget/i);

const orchestratedRange = await orchestrateCustomerQuery({
  query: 'mit welchem kia komme ich am weitesten?',
  useOpenAi: false,
});
assert.ok(orchestratedRange.ok);
assert.equal(orchestratedRange.classification.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(orchestratedRange.ui.component, UI_COMPONENTS.RANKING_ANSWER);
assert.match(orchestratedRange.smartAnswer?.title ?? '', /WLTP|km|Reichweite|führt/i);

const orchestratedCompare = await orchestrateCustomerQuery({
  query: 'EV4 oder EV5 größer?',
  useOpenAi: false,
});
assert.ok(orchestratedCompare.ok);
assert.equal(orchestratedCompare.classification.queryType, QUERY_TYPES.COMPARISON_QUESTION);
assert.equal(orchestratedCompare.ui.component, UI_COMPONENTS.COMPARISON_ANSWER);
assert.ok(orchestratedCompare.smartAnswer?.facts?.length >= 2);

const largestEv = classifyWithRules('welches elektroauto ist das größte');
assert.equal(largestEv.queryType, QUERY_TYPES.RANKING_QUESTION);
assert.equal(largestEv.rankingMetric, RANKING_METRICS.LENGTH);
assert.equal(largestEv.rankingFilter, 'elektro');

const orchestratedLargestEv = await orchestrateCustomerQuery({
  query: 'welches elektroauto ist das größte',
  useOpenAi: false,
});
assert.ok(orchestratedLargestEv.ok);
assert.equal(orchestratedLargestEv.ui.component, UI_COMPONENTS.RANKING_ANSWER);
assert.ok(orchestratedLargestEv.smartAnswer?.title);
assert.match(orchestratedLargestEv.smartAnswer.title, /Elektro|EV|größte/i);

const modelQ = await orchestrateCustomerQuery({
  query: 'Hat der EV3 eine Wärmepumpe?',
  useOpenAi: false,
});
assert.ok(modelQ.ok);
assert.equal(modelQ.classification.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);

console.log('cleverCustomerQuery.test.js: OK');
