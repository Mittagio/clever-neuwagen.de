/**
 * Kia EV4 Registry – Golden Cases (Paketlogik + Preisengine)
 */
import assert from 'node:assert/strict';
import { analyzeSingleWish } from '../services/configurator/wishMagicService.js';
import { resolveWishConfiguration } from '../services/configurator/wishPackageResolver.js';
import { priceConfiguration } from '../services/pricing/pricingEngine.js';
import { computeCleverQuote } from '../services/cleverQuote/cleverQuoteService.js';

const earth360 = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV4',
  trimId: 'earth',
  wishId: 'camera_360',
});
assert.equal(earth360.status, 'package', 'EV4 Earth · 360° → DriveWise ADAS');
assert.equal(earth360.packageId, 'ev4-technik-earth');

const earthHeatPump = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV4',
  trimId: 'earth',
  wishId: 'heat_pump',
});
assert.equal(earthHeatPump.status, 'package', 'EV4 Earth · Wärmepumpe → Winter-Paket');
assert.equal(earthHeatPump.packageId, 'ev4-winter');

const gtHarman = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV4',
  trimId: 'gt-line',
  wishId: 'harman_kardon',
});
assert.equal(gtHarman.status, 'standard', 'EV4 GT-Line · Harman serienmäßig');

const resolution = resolveWishConfiguration({
  brand: 'Kia',
  model: 'EV4',
  trimId: 'earth',
  wishFeatureIds: ['heated_seats', 'camera_360', 'heat_pump'],
  engineId: 'ev-long',
});
assert.ok(resolution.matchedFeatures.includes('heated_seats'));
assert.ok(resolution.matchedFeatures.includes('camera_360'));
assert.ok(resolution.packageIds.includes('ev4-technik-earth'));

const pricing = priceConfiguration({
  brand: 'Kia',
  model: 'EV4',
  trimId: 'earth',
  engineId: 'ev-long',
  wishFeatureIds: ['camera_360'],
  dealerId: 'autohaus-trinkle',
  paymentType: 'leasing',
});
assert.ok(pricing?.leasingRate > 0, 'EV4 Leasingrate berechenbar');
assert.ok(pricing.selectedPackages.length >= 1, 'Technik-Paket im Preis');

const quote = computeCleverQuote({
  vehicle: { brand: 'Kia', model: 'EV4 Earth', trim: 'Earth' },
  wishes: { features: ['heated_seats', 'camera_360', 'heat_pump'] },
});
assert.ok(quote?.items?.length >= 3, 'CleverQuote für EV4 Earth');

console.log('kiaEv4Registry tests OK');
