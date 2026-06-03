import assert from 'node:assert/strict';
import {
  analyzeSingleWish,
  buildPackageInsight,
  buildWishInsight,
  buildWishRecommendation,
  trimIdFromVehicle,
} from './wishMagicService.js';

function testEarth360NeedsTechnik() {
  const result = analyzeSingleWish({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'camera_360',
  });
  assert.equal(result.status, 'package');
  assert.equal(result.packageName, 'Technik Paket');
}

function testEarthHeatPumpStandard() {
  const result = analyzeSingleWish({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'heat_pump',
  });
  assert.equal(result.status, 'standard');
}

function testTrimFromVehicle() {
  assert.equal(trimIdFromVehicle({ trim: 'Earth', model: 'EV3' }), 'earth');
}

function testMultiWishPackages() {
  const rec = buildWishRecommendation({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishFeatureIds: ['camera_360', 'power_tailgate', 'heated_rear_seats'],
    paymentType: 'leasing',
  });
  assert.ok(rec.packages.length >= 2);
  assert.ok(rec.newRateLabel?.includes('/Monat'));
}

testEarth360NeedsTechnik();
testEarthHeatPumpStandard();
testTrimFromVehicle();
testMultiWishPackages();

function testHarmanOnEarthNeedsPremiumOnGtLine() {
  const result = analyzeSingleWish({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'harman_kardon',
  });
  assert.equal(result.status, 'package_other_trim');
  assert.equal(result.packageName, 'Premium Paket');
  assert.equal(result.suggestedTrimId, 'gt-line');
  assert.ok(result.featureLabels.includes('Harman Kardon'));
}

testHarmanOnEarthNeedsPremiumOnGtLine();

function testTechnikPackageBonusItems() {
  const pkg = buildPackageInsight('Kia', 'EV3', 'ev3-technik', ['camera_360']);
  assert.ok(pkg.wishItems.some((i) => i.label.includes('360')));
  assert.ok(pkg.bonusItems.length >= 1);
  assert.equal(pkg.bonusItems[0].badge, 'zusätzlich');
}

function testWishInsightStatuses() {
  const insight = buildWishInsight({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'gt-line',
    wishFeatureIds: ['heated_seats', 'camera_360', 'power_tailgate'],
  });
  const heated = insight.wishStatuses.find((w) => w.id === 'heated_seats');
  const camera = insight.wishStatuses.find((w) => w.id === 'camera_360');
  const tailgate = insight.wishStatuses.find((w) => w.id === 'power_tailgate');
  assert.equal(heated.variant, 'standard');
  assert.equal(camera.variant, 'wish');
  assert.ok(insight.packageInsights.length >= 1);
}

testTechnikPackageBonusItems();
testWishInsightStatuses();

function testCashModeNoMonthlySuffix() {
  const insight = buildWishInsight({
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishFeatureIds: ['camera_360'],
    paymentType: 'cash',
  });
  assert.ok(insight.newRateLabel);
  assert.ok(!insight.newRateLabel.includes('/Monat'));
}

testCashModeNoMonthlySuffix();

console.log('✓ wishMagicService Tests bestanden.');
