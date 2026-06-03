import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import {
  detectSearchConflict,
  detectBrandExclusionConflict,
  resolveSearchConflict,
} from './searchConflictHint.js';

const intent = parseSearchIntent('EV3 Benziner');
const conflict = detectSearchConflict(intent);
assert.ok(conflict);
assert.match(conflict.message, /nicht als Benziner/i);

const brandConflict = detectBrandExclusionConflict({
  brand: 'Kia',
  model: 'Sportage',
  trim: 'Vision',
  modelExplicit: true,
  excludedBrands: ['kia'],
  _catalogBrandCount: 1,
});
assert.ok(brandConflict);
assert.equal(brandConflict.resolveBrandId, 'kia');

const fixed = resolveSearchConflict(
  { excludedBrands: ['kia'], model: 'Sportage' },
  brandConflict,
);
assert.equal(fixed.excludedBrands.length, 0);

console.log('✓ Suchkonflikt-Tests bestanden.');
