import assert from 'node:assert/strict';
import { resolveWishFeaturesFromChips } from '../../data/dealer/dealerWishCatalog.js';
import {
  getDealerWishGroupsForModel,
  getPopularWishesForModel,
  inferWishChipsFromSearch,
  scoreWishGroupForSearch,
} from './dealerWishCatalogService.js';
import { buildVehicleContextLine } from './vehicleSalesJourney.js';

const ev4Groups = getDealerWishGroupsForModel('ev4');
assert.ok(ev4Groups.find((g) => g.id === 'comfort'));
assert.ok(!ev4Groups.find((g) => g.id === 'family')?.chips.some((c) => c.id === 'seats_7'));

const ev9Popular = getPopularWishesForModel('ev9');
assert.ok(ev9Popular);
assert.equal(ev9Popular.chips.length, 4);
assert.ok(ev9Popular.title.includes('EV9'));

const ranked = getDealerWishGroupsForModel('ev9', {
  searchProfile: { fuel: 'electric', seatsMin: 7, requiredFeatures: ['towbar', 'seats_7'] },
  searchFilters: { fuel: 'elektro', towCapacityKg: 2000, seatsMin: 7 },
  searchChipIds: ['seats_7', 'tow_2000', 'fuel_elektro'],
});
const topThree = ranked.slice(0, 3).map((g) => g.id);
assert.ok(topThree.includes('transport'), `transport in top 3: ${topThree.join(',')}`);
assert.ok(topThree.includes('family'), `family in top 3: ${topThree.join(',')}`);
assert.ok(topThree.includes('electro'), `electro in top 3: ${topThree.join(',')}`);
assert.equal(ranked[0].id, 'transport', `expected transport first, got ${ranked[0].id}`);

assert.ok(scoreWishGroupForSearch('transport', null, { towCapacityKg: 2000 }, ['tow_2000']) >= 14);

const features = resolveWishFeaturesFromChips(['heat_pump', 'camera_360', 'towbar']);
assert.ok(features.includes('heat_pump'));
assert.ok(features.includes('camera_360'));

const ev9Prefill = inferWishChipsFromSearch('ev9', {
  searchProfile: { seatsMin: 7, requiredFeatures: ['towbar', 'heat_pump'] },
  searchFilters: { towCapacityKg: 2000, seatsMin: 7 },
  searchChipIds: ['seats_7', 'tow_2000', 'heat_pump'],
});
assert.ok(ev9Prefill.includes('seats_7'));
assert.ok(ev9Prefill.includes('towbar'));
assert.ok(ev9Prefill.includes('heat_pump'));

const ev4Prefill = inferWishChipsFromSearch('ev4', {
  searchProfile: { fuel: 'electric', requiredFeatures: ['range_400'] },
  searchFilters: { fuel: 'elektro', rangeKmMin: 400 },
  searchChipIds: ['range_400', 'heat_pump'],
});
assert.ok(ev4Prefill.includes('range_400'));
assert.ok(ev4Prefill.includes('heat_pump'));
assert.ok(!ev4Prefill.includes('seats_7'));

const ev9Context = buildVehicleContextLine('ev9', {
  searchProfile: { requiredFeatures: ['towbar'] },
  searchChipIds: ['tow_2000'],
});
assert.ok(ev9Context?.includes('2,5 t'));

console.log('dealerWishCatalogService.test.js: ok');
