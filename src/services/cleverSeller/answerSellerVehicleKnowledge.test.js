/**
 * Seller Lexikon = gleiche Stammdaten wie Landing/Beratung
 * node --test src/services/cleverSeller/answerSellerVehicleKnowledge.test.js
 */
import assert from 'node:assert/strict';
import {
  answerSellerVehicleKnowledge,
  isSellerVehicleKnowledgeQuery,
} from './answerSellerVehicleKnowledge.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from '../dealer/sellerActionIntent.js';
import { parseAdvisoryQuestion } from '../search/advisoryQuestionParser.js';

assert.equal(isSellerVehicleKnowledgeQuery('Wie groß ist der EV6?'), true);
assert.equal(
  detectSellerActionIntent('Wie groß ist der EV6?'),
  SELLER_ACTION_INTENTS.LOOKUP_FACT,
);
assert.equal(
  detectSellerActionIntent('Welcher hat mehr Reichweite? EV4 oder EV6?'),
  SELLER_ACTION_INTENTS.LOOKUP_FACT,
);
assert.equal(detectSellerActionIntent('Kia EV6'), SELLER_ACTION_INTENTS.LOOKUP_FACT);
assert.equal(isSellerVehicleKnowledgeQuery('Kia EV6'), true);
assert.equal(parseAdvisoryQuestion('Wie groß ist der EV6?')?.topic, 'dimensions');

const size = answerSellerVehicleKnowledge({ sellerInput: 'Wie groß ist der EV6?' });
assert.equal(size.ok, true);
assert.equal(size.status, 'advisory');
assert.match(String(size.body || size.message || ''), /4,70|Länge/i);
assert.match(String(size.displayValue || ''), /4,70|lang|Maße/i);
assert.ok(String(size.body || size.message || '').length > 40);

const bare = answerSellerVehicleKnowledge({ sellerInput: 'Kia EV6' });
assert.equal(bare.ok, true);
assert.equal(bare.status, 'advisory');
assert.match(String(bare.body || bare.message || ''), /4,70|Länge|WLTP|528/i);
assert.ok(String(bare.body || '').length > 40, 'Bare Modellname liefert Kurzprofil mit Inhalt');

const compare = answerSellerVehicleKnowledge({
  sellerInput: 'Welcher hat mehr Reichweite? EV4 oder EV6?',
});
assert.equal(compare.ok, true);
assert.equal(compare.status, 'advisory');
assert.match(String(compare.message || ''), /WLTP|594|528|Reichweite/i);
assert.match(String(compare.message || compare.narrative?.join(' ') || ''), /EV4|EV6/i);

const turn = runCleverSellerTurn({
  sellerInput: 'Welcher hat mehr Reichweite? EV4 oder EV6?',
  lead: null,
  leadsSnapshot: [],
});
assert.ok(
  turn.preparedActions?.some((a) => a.type === 'lookup_vehicle_fact')
  || turn.knowledgeResult
  || turn.preparedActions?.some((a) => a.payload?.knowledgeResult),
);
const knowledge = turn.knowledgeResult
  || turn.preparedActions?.find((a) => a.payload?.knowledgeResult)?.payload?.knowledgeResult;
assert.ok(knowledge?.ok);
assert.match(String(knowledge.message || knowledge.displayValue || ''), /WLTP|km/i);

const review = buildUniversalReviewModel({ ...turn, knowledgeResult: knowledge });
assert.ok(review);
const knowledgeSec = review.actionSections?.find((s) => s.kind === 'knowledge_result');
assert.ok(knowledgeSec?.body);
assert.match(String(knowledgeSec.body), /WLTP|km|Reichweite/i);

const sizeTurn = runCleverSellerTurn({
  sellerInput: 'Wie groß ist der EV6?',
  lead: null,
  leadsSnapshot: [],
});
const sizeKnowledge = sizeTurn.knowledgeResult
  || sizeTurn.preparedActions?.find((a) => a.payload?.knowledgeResult)?.payload?.knowledgeResult;
const sizeReview = buildUniversalReviewModel({ ...sizeTurn, knowledgeResult: sizeKnowledge });
const sizeSec = sizeReview?.actionSections?.find((s) => s.kind === 'knowledge_result');
assert.ok(sizeSec?.body);
assert.match(String(sizeSec.body), /4,70|Länge/i);

console.log('answerSellerVehicleKnowledge.test.js: ok');
