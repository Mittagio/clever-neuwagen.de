import assert from 'node:assert/strict';
import test from 'node:test';
import { MARKETPLACE_VEHICLES } from './marketplaceVehicles.js';
import { getKiaMarketplaceVehicles } from './kia/kiaPartnerHub.js';

const PILOT_DEALER_ID = 'autohaus-trinkle';

function buildPilotPool(source) {
  let pool = getKiaMarketplaceVehicles(source);
  return pool.filter((v) => (v.dealerSlug ?? PILOT_DEALER_ID) === PILOT_DEALER_ID);
}

test('Pilot-Pool: nur Kia @ autohaus-trinkle', () => {
  const pool = buildPilotPool(MARKETPLACE_VEHICLES);

  assert.ok(pool.length > 0, 'mindestens ein Kia-Fahrzeug');
  assert.ok(pool.every((v) => v.brand === 'Kia'), 'nur Kia');
  assert.ok(
    pool.every((v) => (v.dealerSlug ?? PILOT_DEALER_ID) === PILOT_DEALER_ID),
    'nur Trinkle',
  );
  assert.ok(
    MARKETPLACE_VEHICLES.some((v) => v.brand !== 'Kia'),
    'Fixture enthält Nicht-Kia (Filter greift im Pilot)',
  );
});
