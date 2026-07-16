/**
 * Eval-Assertions – Unit Tests (keine Live-API).
 */
import assert from 'node:assert/strict';
import {
  evaluateTurnExpectations,
  partialMatch,
  summarizeEvalReport,
} from './cleverEvalAssertions.js';

assert.deepEqual(
  partialMatch({ fuel: 'electric', persons: 7 }, { fuel: 'electric' }),
  [],
);

assert.deepEqual(
  partialMatch({ budget: { downPayment: 0 } }, { budget: { downPayment: 0 } }),
  [],
);

const ev3Turn = {
  reply: 'Der EV3 fährt laut WLTP bis zu 436 km.',
  intent: 'knowledge_question',
  nextAction: { type: 'none', question: null },
  usedFactIds: ['fact:ev3:default:wltpRange'],
  vehicleDirections: [{ modelKey: 'ev3', status: 'interesting', verifiedFactIds: [] }],
};

const ev3Eval = evaluateTurnExpectations(ev3Turn, {
  intent: 'knowledge_question',
  nextAction: { type: 'none' },
  requiresUsedFactIds: true,
  forbiddenInReply: ['Wallbox', 'Leasing'],
}, { selectedModelKey: 'ev3' });

assert.equal(ev3Eval.passed, true, ev3Eval.issues);

const badQuestion = evaluateTurnExpectations(
  { ...ev3Turn, nextAction: { type: 'ask_offer_parameter', question: 'Haben Sie eine Wallbox?' } },
  { nextAction: { type: 'none' }, forbiddenInReply: ['Wallbox'] },
  {},
);
assert.equal(badQuestion.passed, false);

const summary = summarizeEvalReport({
  model: 'test-model',
  turns: [
    { passed: true, mode: 'ai', durationMs: 100, usage: { input_tokens: 10, output_tokens: 5 } },
    { passed: false, mode: 'fallback', durationMs: 50, fallbackReason: 'grounding_failed' },
  ],
});
assert.equal(summary.turnCount, 2);
assert.equal(summary.passed, 1);
assert.equal(summary.fallbacks, 1);

console.log('cleverEvalAssertions.test.js: ok');
