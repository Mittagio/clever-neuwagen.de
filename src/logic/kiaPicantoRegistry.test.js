import assert from 'node:assert/strict';
import { analyzeSingleWish } from '../services/configurator/wishMagicService.js';
import { resolveWishConfiguration } from '../services/configurator/wishPackageResolver.js';
import { priceConfiguration } from '../services/pricing/pricingEngine.js';

const visionHeated = analyzeSingleWish({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'vision',
  wishId: 'heated_seats',
});
assert.equal(visionHeated.status, 'standard', 'Picanto Vision · Sitzheizung serienmäßig');

const coreHeated = analyzeSingleWish({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'core',
  wishId: 'heated_seats',
});
assert.equal(coreHeated.status, 'standard_other_trim', 'Picanto Core · Sitzheizung ab Vision');

const core360 = analyzeSingleWish({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'vision',
  wishId: 'camera_360',
});
assert.equal(core360.status, 'missing', 'Picanto · keine 360° Kamera');

const spiritBlind = analyzeSingleWish({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'spirit',
  wishId: 'blind_spot',
});
assert.equal(spiritBlind.status, 'package', 'Picanto Spirit · Totwinkel über DriveWise');
assert.equal(spiritBlind.packageId, 'picanto-drivewise');

const resolution = resolveWishConfiguration({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'spirit',
  wishFeatureIds: ['heated_seats', 'rear_camera', 'blind_spot'],
  engineId: 'mt5',
});
assert.ok(resolution.matchedFeatures.includes('heated_seats'));
assert.ok(resolution.packageIds.includes('picanto-drivewise'));

const pricing = priceConfiguration({
  brand: 'Kia',
  model: 'Picanto',
  trimId: 'spirit',
  engineId: 'mt5',
  wishFeatureIds: ['blind_spot'],
  dealerId: 'autohaus-trinkle',
});
assert.ok(pricing?.leasingRate > 0, 'Picanto Leasingrate');

console.log('kiaPicantoRegistry tests OK');
