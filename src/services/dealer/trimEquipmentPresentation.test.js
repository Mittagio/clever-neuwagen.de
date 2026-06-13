import assert from 'node:assert/strict';
import {
  buildSerialEquipmentSections,
  scoreTrimWithPackages,
} from './trimEquipmentPresentation.js';

const chipIds = ['heat_pump', 'heated_seats', 'camera_360'];

const withoutPackage = scoreTrimWithPackages({
  modelKey: 'ev5',
  trimId: 'earth',
  wishFeatureIds: ['heat_pump', 'heated_seats', 'camera_360'],
  wishChipIds: chipIds,
  packageIds: [],
});

const withTechPackage = scoreTrimWithPackages({
  modelKey: 'ev5',
  trimId: 'earth',
  wishFeatureIds: ['heat_pump', 'heated_seats', 'camera_360'],
  wishChipIds: chipIds,
  packageIds: ['ev5-tech'],
});

assert.ok(withoutPackage.cleverQuotePercent < 100);
assert.equal(withTechPackage.cleverQuotePercent, 100);
assert.ok(withTechPackage.wishChipLines.fulfilled.includes('360° Kamera'));
assert.ok(!withTechPackage.wishChipLines.missing.includes('360° Kamera'));

const sections = buildSerialEquipmentSections(
  {
    standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera'],
    notAvailable: [],
  },
  ['camera_360'],
);

assert.ok(sections.some((group) => group.title === 'Elektro'));
assert.ok(sections.some((group) => group.items.some((item) => /360/.test(item))));

console.log('trimEquipmentPresentation.test.js: ok');
