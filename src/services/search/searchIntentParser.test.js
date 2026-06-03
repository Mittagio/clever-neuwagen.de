/**
 * Intent-Parser Tests – ausführen: node src/services/search/searchIntentParser.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';

function test(name, input, expect) {
  const intent = parseSearchIntent(input);
  for (const [key, value] of Object.entries(expect)) {
    const actual = intent[key];
    if (Array.isArray(value)) {
      assert.deepEqual(actual, value, `${name}: ${key}`);
    } else {
      assert.equal(actual, value, `${name}: ${key} expected ${value}, got ${actual}`);
    }
  }
  console.log(`✓ ${name}`);
}

test('Test 1: 360 Grad Kamera', '360 Grad Kamera', {
  features: ['camera_360'],
  model: null,
});

test('Test 2: Elektro Reichweite + Leasing', 'Elektroauto über 400 km Reichweite bis 400 € Leasing', {
  fuel: 'elektro',
  rangeKmMin: 400,
  payment: 'leasing',
  maxRate: 400,
});

test('Test 3: Sportage Benziner Automatik', 'Sportage Benziner Automatik', {
  model: 'Sportage',
  fuel: 'verbrenner',
  transmission: 'automatic',
});

test('Test 4: Anhängelast Kauf', 'Auto mit 2 Tonnen Anhängelast unter 30.000 €', {
  towCapacityKg: 2000,
  payment: 'cash',
  maxPrice: 30000,
});

test('Test 5: Kia EV3 sofort', 'Kia EV3 sofort verfügbar', {
  brand: 'Kia',
  model: 'EV3',
  availability: 'sofort_verfuegbar',
});

test('Test 6: E-Auto Schorndorf', 'E-Auto bis 400 € in Schorndorf', {
  fuel: 'elektro',
  maxRate: 400,
  payment: 'leasing',
  location: 'Schorndorf',
});

test('Test 7: Kauf unter 20.000', 'Kauf unter 20.000 €', {
  payment: 'cash',
  maxPrice: 20000,
  maxRate: null,
});

console.log('\nAlle Intent-Tests bestanden.');
