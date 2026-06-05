/**
 * Rule Engine – Kunde → JSON → DB-Check → CleverQuote
 * node src/services/search/vehicleFeatureRuleEngine.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import {
  evaluateVehicleAgainstProfile,
  searchProfileToApiJson,
} from './vehicleFeatureRuleEngine.js';
import { toCanonicalFeatureId } from './canonicalFeatureIds.js';

const QUERY = 'Auto 350 km Reichweite, Wärmepumpe, 360-Grad-Kamera, Sitzheizung, elektrische Heckklappe';

const intent = parseSearchIntent(QUERY);
const profile = buildSearchProfile({ query: QUERY, intent });

const apiJson = searchProfileToApiJson(profile);
assert.equal(apiJson.fuel, 'electric');
assert.equal(apiJson.minRangeKm, 350);
assert.ok(apiJson.requiredFeatures.includes('heat_pump'));
assert.ok(apiJson.requiredFeatures.includes('camera_360'));
assert.ok(apiJson.requiredFeatures.includes('heated_front_seats'));
assert.ok(apiJson.requiredFeatures.includes('electric_tailgate'));

const ev3Earth = evaluateVehicleAgainstProfile(profile, {
  brand: 'Kia',
  model: 'EV3',
  title: 'Kia EV3 Earth',
  powertrain: 'elektro',
  electricRangeKm: 436,
});
assert.equal(ev3Earth.trim, 'Earth');
assert.notEqual(ev3Earth.checks.find((c) => c.canonicalId === 'camera_360')?.status, 'fulfilled');
assert.notEqual(ev3Earth.checks.find((c) => c.canonicalId === 'electric_tailgate')?.status, 'fulfilled');
assert.ok(ev3Earth.cleverQuotePercent >= 55 && ev3Earth.cleverQuotePercent <= 70, `Earth ~60%: ${ev3Earth.cleverQuotePercent}`);

const ev3Gt = evaluateVehicleAgainstProfile(profile, {
  brand: 'Kia',
  model: 'EV3',
  title: 'Kia EV3 GT-Line',
  powertrain: 'elektro',
  electricRangeKm: 436,
});
assert.equal(ev3Gt.cleverQuotePercent, 100, 'EV3 GT-Line 100%');

const ev4Gt = evaluateVehicleAgainstProfile(profile, {
  brand: 'Kia',
  model: 'EV4',
  title: 'Kia EV4 GT-Line',
  powertrain: 'elektro',
  electricRangeKm: 490,
});
assert.equal(ev4Gt.cleverQuotePercent, 100, 'EV4 GT-Line 100%');

console.log('vehicleFeatureRuleEngine tests OK');
console.log('API-Profil:', JSON.stringify(apiJson, null, 2));
console.log('EV3 Earth:', ev3Earth.cleverQuotePercent + '%');
console.log('EV3 GT-Line:', ev3Gt.cleverQuotePercent + '%');
