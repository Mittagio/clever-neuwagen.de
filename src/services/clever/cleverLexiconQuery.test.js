/**
 * Hybrid Clever-Lexikon – Orchestrator
 */
import assert from 'node:assert/strict';
import { registerDefaultEquipmentImports } from '../configuration/equipmentImportLoader.js';
import { orchestrateLexiconQuery } from './cleverLexiconQueryOrchestrator.js';
import { searchCleverLexicon } from '../lexicon/cleverLexiconSearchService.js';

registerDefaultEquipmentImports();

const empty = await orchestrateLexiconQuery({ query: '', useOpenAi: false });
assert.equal(empty.ok, false);
assert.equal(empty.error, 'query_required');

const heatPump = await orchestrateLexiconQuery({
  query: 'EV4 Wärmepumpe',
  useOpenAi: false,
});
assert.ok(heatPump.ok);
assert.equal(heatPump.source, 'rules');
assert.ok(heatPump.searchState?.ok);
assert.equal(heatPump.searchState.result.modelKey, 'ev4');
assert.match(heatPump.searchState.result.fieldLabel, /Wärmepumpe/i);
assert.equal(heatPump.searchState.result.confidence, 'high');

const battery = await orchestrateLexiconQuery({
  query: 'EV4 Batterie',
  useOpenAi: false,
});
assert.ok(battery.ok);
assert.equal(battery.searchState.result.intentType, 'technical');
assert.ok(battery.searchState.result.primaryFacts.length > 0);

const unknown = await orchestrateLexiconQuery({
  query: 'Wärmepumpe',
  useOpenAi: false,
});
assert.ok(unknown.ok);
assert.equal(unknown.searchState.ok, false);
assert.ok(unknown.searchState.error);

const direct = searchCleverLexicon('Sportage Anhängelast');
const orchestrated = await orchestrateLexiconQuery({
  query: 'Sportage Anhängelast',
  useOpenAi: false,
});
assert.ok(orchestrated.searchState.ok);
assert.equal(
  orchestrated.searchState.result.modelKey,
  direct.result.modelKey,
);

console.log('cleverLexiconQuery.test.js: OK');
