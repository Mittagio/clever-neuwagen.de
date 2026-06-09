/**
 * node src/services/search/profileConflictHint.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { mergeDealerChipFilters } from '../dealer/dealerWishChips.js';
import { detectProfileConflict } from './profileConflictHint.js';

const intentHybrid = parseSearchIntent('Hybrid Familienauto');
const filtersElektro = mergeDealerChipFilters(['fuel_elektro_300']);
const profileMismatch = buildSearchProfile({
  intent: intentHybrid,
  filters: filtersElektro,
  chipIds: ['fuel_elektro_300'],
});
const conflictFuel = detectProfileConflict(profileMismatch, {
  intent: intentHybrid,
  filters: filtersElektro,
});
assert.ok(conflictFuel, 'Hybrid-Text + Elektro-Chip');
assert.equal(conflictFuel.type, 'fuel_text_chip_mismatch');

const budgetSeven = buildSearchProfile({
  intent: parseSearchIntent(''),
  filters: mergeDealerChipFilters(['fuel_elektro_300', 'seats_7']),
  chipIds: ['fuel_elektro_300', 'seats_7'],
});
const conflictSeven = detectProfileConflict(budgetSeven, {
  filters: mergeDealerChipFilters(['fuel_elektro_300', 'seats_7']),
});
assert.ok(conflictSeven, 'Elektro 300€ + 7-Sitzer');
assert.equal(conflictSeven.type, 'budget_seven_electric');
assert.match(conflictSeven.message, /Sorento/i);

const okProfile = buildSearchProfile({
  intent: parseSearchIntent('7-Sitzer Familienauto'),
  filters: mergeDealerChipFilters(['seats_7']),
});
assert.equal(detectProfileConflict(okProfile), null, 'Nur 7-Sitzer ohne Budget-Konflikt');

console.log('profileConflictHint.test.js: ok');
