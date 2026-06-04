/**
 * featureResolver – Registry-Anbindung für Detail-Empfehlungen
 */
import assert from 'node:assert/strict';
import { buildRecommendation, createInitialDetailSelection } from './featureResolver.js';
import { pickStreamUpgrade } from '../../logic/vehicleDetailStream.js';

const vehicleCatalog = {
  brand: 'Kia',
  model: 'EV3',
  vehicle: {
    brand: 'Kia',
    model: 'EV3',
    powertrain: 'elektro',
    bodyType: 'suv',
    monthlyRate: 318,
  },
  dealerConditions: null,
};

const selection = createInitialDetailSelection(vehicleCatalog.vehicle, {
  trim: 'earth',
  trimName: 'Earth',
  selectedFeatures: ['heated_seats', 'camera_360'],
});

const rec = buildRecommendation(selection, vehicleCatalog);
assert.ok(rec.requiredPackages.length >= 1, 'EV3 Earth + 360° → Paket nötig');
assert.equal(rec.requiredPackages[0].id, 'ev3-technik');
assert.ok(rec.requiredPackages[0].features.some((f) => f.id === 'camera_360' || f.label?.includes('360')));

const streamPkg = pickStreamUpgrade(rec);
assert.equal(streamPkg.kind, 'package');
assert.equal(streamPkg.data.id, 'ev3-technik');

const afterAccept = buildRecommendation(
  { ...selection, selectedPackages: ['ev3-technik'] },
  vehicleCatalog,
);
assert.ok(
  !afterAccept.requiredPackages.some((p) => p.id === 'ev3-technik')
    || pickStreamUpgrade(afterAccept, { selectedPackageIds: ['ev3-technik'] }).kind !== 'package',
  'Nach Paket-Übernahme kein doppeltes Paket-Upgrade',
);

console.log('featureResolver.test.js: ok');
