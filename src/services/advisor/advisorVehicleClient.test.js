/**
 * Fahrzeugdetail Backend-Slug
 * node src/services/advisor/advisorVehicleClient.test.js
 */

import assert from 'node:assert/strict';
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';
import { getServerVehicleBySlug } from '../../../server/advisorEngine.js';

const stock = getKiaTrinklePilotStock();
const sample = stock.find((v) => v.modelKey === 'ev3') ?? stock[0];

const serverResult = getServerVehicleBySlug(sample.slug, 'autohaus-trinkle');
assert.ok(serverResult, 'Server liefert Fahrzeug');
assert.equal(serverResult.vehicle.slug, sample.slug);
assert.equal(serverResult.match.slug, sample.slug);
assert.equal(serverResult.vehicle.trimId, sample.trimId);
assert.equal(serverResult.vehicle.monthlyRate, sample.monthlyRate);
assert.ok(serverResult.match.cleverQuote?.percent, 'CleverQuote vom Backend');

assert.equal(getServerVehicleBySlug('does-not-exist'), null);

console.log('advisorVehicleClient tests OK');
