import assert from 'node:assert/strict';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import {
  buildBrandExclusionConflictCopy,
  buildCrossBrandAlternatives,
  isBrandExclusionConflict,
} from './brandExclusionConflictView.js';
import { brandToFilterId } from './brandResultsFilter.js';

const conflict = {
  type: 'brand_excluded_vs_search',
  brandLabel: 'Kia',
  resolveBrandId: 'kia',
};

assert.ok(isBrandExclusionConflict(conflict));

const filters = {
  brand: 'Kia',
  model: 'Sportage',
  trim: 'Vision',
  modelExplicit: true,
  fuel: 'verbrenner',
  excludedBrands: ['kia'],
  termMonths: 48,
  mileagePerYear: 10000,
};

const copy = buildBrandExclusionConflictCopy(filters, conflict);
assert.match(copy.headline, /Kia ist aktuell ausgeblendet/);
assert.match(copy.subline, /Kia Sportage/);
assert.equal(copy.primaryLabel, 'Kia wieder anzeigen');
assert.match(copy.secondaryLabel, /Alternativen/);

const wishes = { model: 'Sportage', brand: 'Kia', trim: 'Vision', features: [], budget: { type: 'leasing' } };
const alts = buildCrossBrandAlternatives({
  allVehicles: MARKETPLACE_VEHICLES,
  filters,
  wishes,
  conflict,
  limit: 8,
});

assert.ok(alts.length > 0, 'cross-brand alternatives');
assert.ok(alts.every((m) => brandToFilterId(m.vehicle?.brand) !== 'kia'), 'no Kia while excluded');

console.log('✓ Brand-Exclusion-Konflikt-View Tests bestanden.');
