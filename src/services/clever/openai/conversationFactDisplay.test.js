/**
 * Tests: menschliche Fact-Chips, keine technischen Keys.
 */
import assert from 'node:assert/strict';
import {
  formatHumanFactChip,
  looksTechnicalFactLabel,
  sanitizeFactPair,
} from './conversationFactDisplay.js';

{
  const seats = formatHumanFactChip('seats', 5);
  assert.equal(seats.chip, '💺 5 Sitze');
  assert.ok(!looksTechnicalFactLabel(seats.chip));
}

{
  const range = formatHumanFactChip('wltpRange', 350);
  assert.ok(range.chip.includes('350'));
  assert.ok(range.chip.includes('WLTP'));
  assert.ok(!range.chip.includes('wltpRange'));
}

{
  const tow = formatHumanFactChip('towingCapacity', 1000);
  assert.ok(tow.chip.includes('1.000') || tow.chip.includes('1000'));
  assert.ok(tow.chip.includes('Anhängelast'));
}

{
  assert.equal(sanitizeFactPair('EV2 seats', '5'), null);
  assert.equal(sanitizeFactPair('EV2 wltpRange', '350'), null);
  assert.ok(looksTechnicalFactLabel('EV2 seats'));
}

console.log('✓ conversationFactDisplay human-readable');
