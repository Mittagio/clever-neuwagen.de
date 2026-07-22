/**
 * node src/services/clever/openai/tools/resolveVerifiedTowingCapacity.test.js
 */
import assert from 'node:assert/strict';
import { getVerifiedVehicleFacts } from './getVerifiedVehicleFacts.js';
import { resolveVerifiedTowingCapacity } from './resolveVerifiedTowingCapacity.js';

{
  const resolved = resolveVerifiedTowingCapacity('ev2');
  assert.ok(resolved, 'EV2 Anhängelast aus Registry');
  assert.equal(resolved.value, 750);
  console.log('✓ EV2 Technical Registry → 750 kg');
}

{
  const facts = getVerifiedVehicleFacts({
    modelKey: 'ev2',
    requestedFacts: ['towingCapacity'],
  });
  assert.equal(facts.missingFacts.length, 0);
  assert.equal(facts.facts[0]?.value, 750);
  assert.equal(facts.facts[0]?.status, 'verified');
  console.log('✓ getVerifiedVehicleFacts(ev2, towingCapacity) → 750');
}

console.log('\nresolveVerifiedTowingCapacity.test.js: ok');
