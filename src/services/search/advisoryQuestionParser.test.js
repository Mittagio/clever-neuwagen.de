import assert from 'node:assert/strict';
import { parseAdvisoryQuestion } from './advisoryQuestionParser.js';

const ev3len = parseAdvisoryQuestion('Wie lang ist der EV3?');
assert.equal(ev3len?.topic, 'dimensions');
assert.equal(ev3len?.modelKey, 'ev3');

const ev9range = parseAdvisoryQuestion('ev9 reichweite');
assert.equal(ev9range?.topic, 'attribute');
assert.equal(ev9range?.modelKey, 'ev9');

const garage = parseAdvisoryQuestion('Passt der EV3 in meine Garage?');
assert.equal(garage?.topic, 'garage');

const compare = parseAdvisoryQuestion('EV3 oder EV4?');
assert.equal(compare?.topic, 'comparison');
assert.equal(compare?.modelKeyA, 'ev3');
assert.equal(compare?.modelKeyB, 'ev4');

const heat = parseAdvisoryQuestion('Hat der EV3 Sitzheizung?');
assert.equal(heat?.topic, 'feature');
assert.equal(heat?.featureId, 'heated_seats');

const winter = parseAdvisoryQuestion('Wie weit kommt der EV9 im Winter?');
assert.equal(winter?.topic, 'range_winter');

assert.equal(parseAdvisoryQuestion('Elektro 300 km Anhängerkupplung 30.000 €'), null);

console.log('advisoryQuestionParser.test.js: ok');
