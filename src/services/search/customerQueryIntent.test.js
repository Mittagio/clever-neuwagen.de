import assert from 'node:assert/strict';
import { classifyCustomerQueryIntent, hasFactualProfileCriteria } from './customerQueryIntent.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';

function mode(query) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  return classifyCustomerQueryIntent(query, intent, profile);
}

assert.equal(mode('2 Tonnen Anhängelast 7-Sitzer'), 'search');
assert.equal(mode('Elektro 300 km Anhängerkupplung 30.000 €'), 'search');
assert.equal(mode('Wie lang ist der EV3?'), 'info');
assert.equal(mode('Garage Höhe 2 Meter'), 'search');
assert.equal(mode('Fahrzeug mit meiste Reichweite'), 'info');
assert.equal(mode('Kofferraum mindestens 500 Liter'), 'search');

assert.equal(mode('Ich suche einen Sportage Hybrid'), 'search');
assert.equal(mode('Elektro bis 300 € Leasing'), 'search');
assert.equal(mode('EV3 sofort verfügbar'), 'search');
assert.equal(mode('ev9 reichweite'), 'info');

assert.ok(hasFactualProfileCriteria(buildSearchProfile({
  intent: parseSearchIntent('7-Sitzer'),
  query: '7-Sitzer',
})));

console.log('customerQueryIntent.test.js: ok');
