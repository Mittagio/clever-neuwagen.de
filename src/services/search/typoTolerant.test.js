/**
 * Fehlertolerante Suche – Tests
 * node src/services/search/typoTolerant.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';

const EXAMPLE =
  'ich sucheh ienen klleinwagen mit sitzhiezug unnd 70 ps und aautumatik';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('Beispiel: Kleinwagen + Sitzheizung + Automatik + 70 PS', () => {
  const intent = parseSearchIntent(EXAMPLE);
  assert.equal(intent.bodyType, 'kleinwagen', 'bodyType');
  assert.ok(intent.features.includes('heated_seats'), 'heated_seats');
  assert.equal(intent.transmission, 'automatic', 'transmission');
  assert.equal(intent.powerPsTarget, 70, 'powerPsTarget');
  assert.equal(intent.powerPsMin, 55);
  assert.equal(intent.powerPsMax, 85);
  assert.notEqual(intent.model, '360', 'kein Ferrari-360');
});

test('sitzhiezug → Sitzheizung', () => {
  const intent = parseSearchIntent('auto mit sitzhiezug');
  assert.ok(intent.features.includes('heated_seats'));
});

test('aautumatik → Automatik', () => {
  const intent = parseSearchIntent('wagen mit aautumatik');
  assert.equal(intent.transmission, 'automatic');
});

test('klleinwagen → Kleinwagen', () => {
  const intent = parseSearchIntent('klleinwagen gesucht');
  assert.equal(intent.bodyType, 'kleinwagen');
});

test('70 ps Toleranz', () => {
  const intent = parseSearchIntent('ca 70 ps');
  assert.equal(intent.powerPsTarget, 70);
});

console.log('\nAlle Typo-Toleranz-Tests bestanden.');
