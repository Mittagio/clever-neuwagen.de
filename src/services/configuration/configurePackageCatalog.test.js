/**
 * Tests: Paket-Katalog – trimabhängige Verfügbarkeit
 */
import assert from 'node:assert/strict';
import { buildPackageCatalog } from './configurePackageCatalog.js';

const air = buildPackageCatalog('ev2', 'air', []);
const airIds = air.packages.map((p) => p.id);
assert.ok(!airIds.includes('ev2-winter-connect'), 'Air: kein Winter-Connect');
assert.ok(airIds.includes('ev2-sitz'), 'Air: Sitz-Paket sichtbar');

const earth = buildPackageCatalog('ev2', 'earth', []);
const earthIds = earth.packages.map((p) => p.id);
assert.ok(earthIds.includes('ev2-winter-connect'), 'Earth: Winter-Connect verfügbar');
assert.ok(earthIds.includes('ev2-sitz'), 'Earth: Sitz-Paket verfügbar');

const gt = buildPackageCatalog('ev2', 'gt-line', []);
const drivewise = gt.packages.find((p) => p.id === 'ev2-drivewise-park');
assert.ok(drivewise, 'GT-Line: DriveWise sichtbar');
assert.equal(drivewise.status, 'included', 'GT-Line: DriveWise enthalten');

const groups = earth.groups.map((g) => g.id);
assert.ok(groups.includes('komfort'), 'Komfort-Gruppe');
assert.ok(groups.includes('technik'), 'Technik-Gruppe');

console.log('configurePackageCatalog.test.js: ok');
