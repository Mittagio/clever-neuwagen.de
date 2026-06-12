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
  payment: null,
  location: 'Schorndorf',
});

test('Test 7: Kauf unter 20.000', 'Kauf unter 20.000 €', {
  payment: 'cash',
  maxPrice: 20000,
  maxRate: null,
});

test('Länge: 5 Sitze bis 4 Meter', '5 sitze bis 4 Meter länge', {
  seatsMin: 5,
  maxLengthMm: 4000,
});

test('Isofix: 3 Kindersitze', 'Familienauto mit 3 Isofix', {
  isofixRearMin: 3,
});

test('Garage: 2 Meter Höhe', 'Garage Höhe 2 Meter', {
  maxHeightMm: 2000,
});

test('Kofferraum: groß', 'SUV großer Kofferraum bis 45.000 €', {
  maxPrice: 45000,
  features: ['large_trunk'],
});

test('Reichweite: meiste (Superlativ)', 'Fahrzeug mit meister Reichweite', {
  fuel: 'elektro',
  rangeRanking: 'max',
  features: ['reichweite', 'elektro'],
});

test('Antrieb: Diesel oder Benzin', 'Diesel oder Benzin SUV', {
  fuel: null,
  fuelAlternatives: ['diesel', 'verbrenner'],
  bodyType: 'suv',
});

test('Budget: Euro statt €', 'Budget 400 Euro leasing 48 monate', {
  payment: 'leasing',
  maxRate: 400,
});

test('Rate: maximal Euro', 'maximal 400 Euro Rate', {
  maxRate: 400,
  payment: 'leasing',
});

test('Wallbox: Laden zu Hause', 'Elektro mit Wallbox zu Hause', {
  fuel: 'elektro',
  chargingHomeHint: 'Wallbox / Laden zu Hause',
});

test('Isofix: zwei Kindersitze hinten', 'Isofix hinten für zwei Kindersitze', {
  isofixRearMin: 2,
});

test('Isofix: Kindersitz Feature', 'Kindersitz ISOFIX', {
  isofixRearMin: 1,
  features: ['isofix'],
});

test('Antrieb: Plug-in oder Diesel', 'Plug-in oder Diesel', {
  fuel: null,
  fuelAlternatives: ['plugin-hybrid', 'diesel'],
});

test('Laden: Schnellladen CCS', 'Elektro mit Schnellladen und CCS', {
  fuel: 'elektro',
  features: ['fast_charge'],
});

test('Laden: 800V DC', 'EV6 DC-Laden 800V', {
  features: ['fast_charge', 'charge_800v'],
});

test('Finanzierung: 0 Prozent', 'Finanzierung 0 Prozent', {
  payment: 'finance',
  financeZeroPercent: true,
});

test('Finanzierung: 0% Zeichen', '0% Finanzierung', {
  payment: 'finance',
  financeZeroPercent: true,
});

test('Finanzierung: zinsfrei', 'zinsfreie Finanzierung bis 40.000 Euro', {
  payment: 'finance',
  financeZeroPercent: true,
  maxPrice: 40000,
});

console.log('\nAlle Intent-Tests bestanden.');
