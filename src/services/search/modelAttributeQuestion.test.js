import assert from 'node:assert/strict';
import { parseModelAttributeQuestion, detectModelKeyInQuery } from './modelAttributeQuestion.js';

const ev9 = parseModelAttributeQuestion('ev9 reichweite');
assert.equal(ev9?.modelKey, 'ev9');
assert.equal(ev9?.attribute, 'range');

assert.equal(parseModelAttributeQuestion('Sportage Kofferraum')?.modelKey, 'sportage');
assert.equal(parseModelAttributeQuestion('Sportage Kofferraum')?.attribute, 'trunk');

assert.equal(detectModelKeyInQuery('ev9 gt reichweite'), 'ev9-gt');
assert.equal(parseModelAttributeQuestion('nur ev9'), null);

console.log('modelAttributeQuestion.test.js: ok');
