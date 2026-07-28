/**
 * Seller OpenAI-Eskalation – Gate + Merge (ohne Live-API)
 * node src/services/cleverSeller/sellerOpenAiEscalation.test.js
 */
import assert from 'node:assert/strict';
import {
  evaluateSellerInterpretEscalation,
  isCleverSellerOpenAiInterpretEnabled,
  shouldEscalateSellerInterpretation,
} from './cleverSellerOrchestratorConfig.js';
import {
  mergeSellerIntents,
  mergeSellerInterpretation,
} from './mergeSellerInterpretation.js';
import { interpretSellerInputWithOpenAi } from './interpretSellerInputWithOpenAi.js';
import { runCleverSellerTurnAsync } from './runCleverSellerTurn.js';
import { SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

assert.equal(
  isCleverSellerOpenAiInterpretEnabled({ CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true' }),
  false,
  'ohne API-Key aus',
);
assert.equal(
  isCleverSellerOpenAiInterpretEnabled({
    CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
  }),
  true,
);

assert.equal(
  shouldEscalateSellerInterpretation({
    sellerInput: 'irgendwas unklar hier',
    facts: [],
    intents: [{ type: SELLER_TURN_INTENTS.UNKNOWN }],
    confidence: 0.4,
  }).shouldEscalate,
  true,
);

assert.equal(
  shouldEscalateSellerInterpretation({
    sellerInput: 'Schreib ihm: Lieferzeit 3 Monate',
    inputMode: 'customer_message',
    facts: [],
    intents: [{ type: SELLER_TURN_INTENTS.DRAFT_MESSAGE }],
  }).shouldEscalate,
  false,
);

assert.equal(
  evaluateSellerInterpretEscalation({
    sellerInput: 'irgendwas unklar hier xx',
    facts: [],
    intents: [{ type: 'unknown' }],
  }, {}).shouldEscalate,
  false,
  'Flag aus → keine Eskalation',
);

const merged = mergeSellerInterpretation(
  [{ factClass: 'customer_fact', field: 'childrenCount', label: '2 Kinder', confidence: 0.9 }],
  [{ factClass: 'customer_fact', field: 'maritalStatus', label: 'verheiratet', confidence: 0.8 }],
);
assert.equal(merged.length, 2);
assert.ok(merged.every((f) => (
  f.source !== SELLER_FACT_SOURCE.OPENAI_INTERPRETATION || f.needsConfirmation === true
)));
assert.equal(merged[1].needsConfirmation, true);
assert.equal(merged[1].source, SELLER_FACT_SOURCE.OPENAI_INTERPRETATION);

const intents = mergeSellerIntents(
  [{ type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, confidence: 0.9 }],
  [{ type: SELLER_TURN_INTENTS.PREPARE_OFFER, confidence: 0.7 }],
);
assert.equal(intents.length, 2);

// Mock OpenAI
const fakeFetch = async () => ({
  ok: true,
  json: async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          confidence: 0.72,
          facts: [{
            factClass: 'commercial_preference',
            field: 'monthlyBudget',
            value: 350,
            label: '350 € Wunschrate',
            confidence: 0.8,
          }],
          intents: [{ type: 'update_customer_context', confidence: 0.7 }],
        }),
      },
    }],
  }),
});

const ai = await interpretSellerInputWithOpenAi(
  { sellerInput: 'Kunde will irgendwas mit Rate' },
  { fetchImpl: fakeFetch, apiKey: 'sk-test' },
);
assert.equal(ai.ok, true);
assert.equal(ai.facts[0].label, '350 € Wunschrate');

const turn = await runCleverSellerTurnAsync({
  lead: { id: 'lead-esc', crm: { needProfile: {}, sellerInsights: [] } },
  sellerInput: 'Kunde hat irgendwie Interesse an was Neuem, unklar',
  env: {
    CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
    CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
  },
  openAiOptions: { fetchImpl: fakeFetch, apiKey: 'sk-test', forceEscalate: true },
});
assert.equal(turn.openaiEscalation?.used, true);
assert.ok(turn.extractedFacts.some((f) => f.needsConfirmation && /Wunschrate/i.test(f.label)));
assert.ok(turn.warnings.some((w) => /OpenAI/i.test(w)));

console.log('sellerOpenAiEscalation.test.js: ok');
