/**
 * Hybrid Kundenquery – Orchestrator & Regeln
 */
import assert from 'node:assert/strict';
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';
import { matchAdviceTopic } from './adviceTopicCatalog.js';

const heatPumpAdvice = classifyWithRules('Warum sollte ich eine Wärmepumpe nehmen?');
assert.equal(heatPumpAdvice.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.equal(heatPumpAdvice.topic, 'heat_pump_benefit');
assert.equal(heatPumpAdvice.shouldShowModels, false);

const ev4Feature = classifyWithRules('EV4 mit oder ohne Wärmepumpe?');
assert.equal(ev4Feature.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev4Feature.modelKey, 'ev4');
assert.equal(ev4Feature.featureId, 'heat_pump');

const vehicleWish = classifyWithRules('E-Auto bis 400 € SUV');
assert.equal(vehicleWish.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(vehicleWish.shouldShowModels, true);

const special = classifyWithRules('Kann ich Windabweiser am EV4 montieren?');
assert.equal(special.queryType, QUERY_TYPES.SPECIAL_CHECK_QUESTION);
assert.equal(special.shouldAskForContact, true);

assert.ok(matchAdviceTopic('Leasing oder Finanzierung?'));

const orchestrated = await orchestrateCustomerQuery({
  query: 'Warum sollte ich eine Wärmepumpe nehmen?',
  useOpenAi: false,
});
assert.ok(orchestrated.ok);
assert.equal(orchestrated.classification.queryType, QUERY_TYPES.ADVICE_QUESTION);
assert.ok(orchestrated.answer?.body);
assert.match(orchestrated.answer.body, /Wärmepumpe|Reichweite/i);
assert.equal(orchestrated.ui.component, UI_COMPONENTS.ADVICE_ANSWER);
assert.ok(orchestrated.smartAnswer?.title);

const modelQ = await orchestrateCustomerQuery({
  query: 'Hat der EV3 eine Wärmepumpe?',
  useOpenAi: false,
});
assert.ok(modelQ.ok);
assert.equal(modelQ.classification.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);

console.log('cleverCustomerQuery.test.js: OK');
