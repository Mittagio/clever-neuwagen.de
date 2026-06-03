import assert from 'node:assert/strict';
import {
  getKiaMarketplaceVehicles,
  getKiaSalesVehiclePool,
  isKiaVehicle,
  vehicleMatchesKiaModelId,
  getKiaTrimLines,
  getKiaPackages,
  getKiaFeatureLibrary,
  getKiaModelOverview,
  hasRegistryCleverQuote,
} from '../../data/kia/kiaPartnerHub.js';
import { MARKETPLACE_VEHICLES } from '../../data/marketplaceVehicles.js';

const kiaOnly = getKiaMarketplaceVehicles();
assert.ok(kiaOnly.length >= 5, 'Mindestens 5 Kia-Fahrzeuge im Marketplace');
assert.ok(kiaOnly.every(isKiaVehicle), 'Marketplace-Filter nur Kia');
assert.ok(
  MARKETPLACE_VEHICLES.some((v) => !isKiaVehicle(v)),
  'Nicht-Kia bleiben im Gesamt-Marketplace (Kundensuche)',
);

const sportagePool = getKiaSalesVehiclePool({ activeModelIds: ['sportage'] });
assert.ok(sportagePool.every((v) => vehicleMatchesKiaModelId(v, 'sportage')));

const ev3Pool = getKiaSalesVehiclePool({ activeModelIds: ['ev3'] });
assert.ok(ev3Pool.every((v) => vehicleMatchesKiaModelId(v, 'ev3')));
assert.ok(ev3Pool.length >= 2, 'EV3 GT-Line und Earth im Pool');

const sportageTrims = getKiaTrimLines('sportage');
assert.ok(sportageTrims.length >= 3, 'Sportage Ausstattungslinien');

const ev3Packages = getKiaPackages('ev3');
assert.ok(ev3Packages.length >= 1, 'EV3 Pakete aus Registry');

const library = getKiaFeatureLibrary();
assert.ok(library.catalog.length > 0);
assert.ok(library.registryFeatures.length > 0);

const overview = getKiaModelOverview();
assert.ok(overview.registry.some((m) => m.key === 'sportage'));
assert.ok(overview.registry.some((m) => m.key === 'ev3'));
assert.ok(overview.meta?.sourceUrl?.includes('kia.com/de/broschuere'));

const sportageVehicle = kiaOnly.find((v) => v.model.includes('Sportage'));
assert.ok(hasRegistryCleverQuote(sportageVehicle));

console.log('kiaPartnerHub tests OK');
