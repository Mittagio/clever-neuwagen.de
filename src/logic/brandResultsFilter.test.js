import assert from 'node:assert/strict';
import {
  extractResultCatalogFromVehicles,
  toggleExcludedBrand,
  toggleExcludedModel,
  vehiclePassesBrandExclusion,
  vehiclePassesModelExclusion,
  vehicleToModelFilterId,
  computeOfferStats,
  buildOfferCountLine,
  isAllBrandsExcluded,
} from './brandResultsFilter.js';

const vehicles = [
  { brand: 'Kia', model: 'EV3', slug: 'kia-ev3', id: '1' },
  { brand: 'Kia', model: 'Niro EV', slug: 'kia-niro-ev', id: '2' },
  { brand: 'MG', model: 'MG4', slug: 'mg-mg4', id: '3' },
  { brand: 'Dacia', model: 'Spring', slug: 'dacia-spring', id: '4' },
];

const catalog = extractResultCatalogFromVehicles(vehicles);
assert.equal(catalog.brands.length, 3);
assert.equal(catalog.brands.find((b) => b.id === 'kia').models.length, 2);

let excludedBrands = toggleExcludedBrand([], 'mg');
excludedBrands = toggleExcludedBrand(excludedBrands, 'dacia');
assert.deepEqual(excludedBrands, ['mg', 'dacia']);

assert.equal(vehiclePassesBrandExclusion(vehicles[2], excludedBrands), false);
assert.equal(vehiclePassesBrandExclusion(vehicles[0], excludedBrands), true);

let excludedModels = toggleExcludedModel([], 'dacia-spring');
assert.equal(vehiclePassesModelExclusion(vehicles[3], excludedModels), false);
assert.equal(vehicleToModelFilterId(vehicles[0]), 'kia-ev3');

const stats = computeOfferStats(vehicles, ['mg', 'dacia'], []);
assert.equal(stats.total, 4);
assert.equal(stats.visible, 2);
assert.equal(stats.hidden, 2);
assert.equal(buildOfferCountLine({ visible: 0, hidden: 2 }), 'Keine Angebote sichtbar');
assert.equal(buildOfferCountLine({ visible: 3, hidden: 0 }), '3 Fahrzeuge geprüft');
assert.equal(buildOfferCountLine({ visible: 5, hidden: 2 }), '5 Angebote · 2 ausgeblendet');
assert.equal(buildOfferCountLine({ visible: 3, hidden: 0, total: 225 }), '225 Fahrzeuge geprüft · 3 passen');
assert.ok(isAllBrandsExcluded(catalog, ['kia', 'mg', 'dacia']));

console.log('✓ Marken-/Modell-Katalog-Tests bestanden.');
