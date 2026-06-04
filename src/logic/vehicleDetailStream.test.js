import assert from 'node:assert/strict';
import { pickStreamUpgrade, pickStreamAlternatives } from './vehicleDetailStream.js';

const pkgRec = {
  requiredPackages: [{
    id: 'ev3-technik',
    name: 'Technik Paket',
    features: [
      { id: 'camera_360', label: '360° Kamera', reason: 'requested' },
      { id: 'hud', label: 'Head-up Display', reason: 'bonus' },
    ],
  }],
  magicSummary: 'Für 360° Kamera benötigen Sie das Technik Paket.',
  priceDeltaLabel: '+12 € / Monat',
  baselinePriceLabel: '318 € / Monat',
  newPriceLabelFull: '330 € / Monat',
  premiumTrim: { exists: true, trim: 'GT-Line' },
};

const pkgUpgrade = pickStreamUpgrade(pkgRec);
assert.equal(pkgUpgrade.kind, 'package');
assert.equal(pkgUpgrade.data.id, 'ev3-technik');
assert.ok(pkgUpgrade.gains.includes('360° Kamera'));

const noDup = pickStreamUpgrade(pkgRec, { selectedPackageIds: ['ev3-technik'] });
assert.equal(noDup.kind, 'trim', 'Paket schon gewählt → Trim-Upgrade');
assert.equal(noDup.direction, 'up');

const trimOnly = pickStreamUpgrade({
  requiredPackages: [],
  betterTrim: { exists: true, trim: 'Air', reason: 'Günstiger' },
});
assert.equal(trimOnly.kind, 'trim');
assert.equal(trimOnly.direction, 'down');

const alts = pickStreamAlternatives([
  { slug: 'a', title: 'A' },
  { slug: 'b', title: 'B' },
  { slug: 'c', title: 'C' },
  { slug: 'd', title: 'D' },
], 3, 'x');
assert.equal(alts.length, 3);

console.log('vehicleDetailStream.test.js: ok');
