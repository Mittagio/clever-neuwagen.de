import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { buildDealerSmartAnswer } from '../dealer/dealerSmartAnswerService.js';
import {
  analyzeCustomerQueryType,
  matchElectricLineupQuestion,
  matchPurchaseIntent,
} from './customerQueryType.js';

assert.ok(matchElectricLineupQuestion('welche e autos gibt es bei kia'));
assert.ok(matchElectricLineupQuestion('Welche Elektroautos bietet Kia?'));
assert.equal(matchElectricLineupQuestion('akkugröße ev6'), false);

assert.ok(matchPurchaseIntent('Ich möchte einen EV4', { modelExplicit: true }));
assert.ok(matchPurchaseIntent('Zeig mir den EV3', {}));
assert.equal(matchPurchaseIntent('Elektro bis 300 Euro', {}), false);

function typeOf(query) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  return analyzeCustomerQueryType(query, intent, profile);
}

assert.equal(typeOf('welche e autos gibt es bei kia'), 'knowledge');
assert.equal(typeOf('Elektro bis 300 €'), 'search');
assert.equal(typeOf('EV3 oder EV4'), 'compare');
assert.equal(typeOf('Wie groß ist die Batterie vom EV9?'), 'knowledge');
assert.equal(typeOf('Zeig mir den EV3'), 'purchase');
assert.equal(typeOf('7 Sitzer mit Anhängerkupplung'), 'search');

const lineupAnswer = buildDealerSmartAnswer('welche e autos gibt es bei kia', []);
assert.ok(lineupAnswer);
assert.equal(lineupAnswer.journeyKind, 'lineup');
assert.ok(lineupAnswer.modelCards?.length >= 6);
assert.ok(lineupAnswer.interestOptions?.some((o) => o.modelKey === 'ev6'));
assert.ok(lineupAnswer.interestOptions?.some((o) => o.modelKey === 'unsure'));

console.log('customerQueryType.test.js: ok');
