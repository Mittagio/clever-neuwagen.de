/**
 * MVP Golden Cases – Kia EV3 Earth + Sportage (Registry + Wish-Magic + CleverQuote)
 */
import assert from 'node:assert/strict';
import { resolveWishConfiguration } from '../services/configurator/wishPackageResolver.js';
import { analyzeSingleWish, buildWishRecommendation } from '../services/configurator/wishMagicService.js';
import { computeCleverQuote } from '../services/cleverQuote/cleverQuoteService.js';
import { getDisplayPrice } from '../services/pricing/pricingResolver.js';

const MVP_WISHES = ['heated_seats', 'rear_camera', 'heat_pump'];

// ── EV3 Earth ──
const ev3Earth360 = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishId: 'camera_360',
});
assert.equal(ev3Earth360.status, 'package', 'EV3 Earth · 360° → Technik Paket');
assert.equal(ev3Earth360.packageId, 'ev3-technik');

const ev3EarthHeatPump = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishId: 'heat_pump',
});
assert.equal(ev3EarthHeatPump.status, 'standard', 'EV3 Earth · Wärmepumpe serienmäßig');

const ev3EarthHeated = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishId: 'heated_seats',
});
assert.equal(ev3EarthHeated.status, 'standard', 'EV3 Earth · Sitzheizung serienmäßig');

const ev3Resolution = resolveWishConfiguration({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishFeatureIds: ['heated_seats', 'rear_camera', 'heat_pump', 'camera_360'],
});
assert.ok(ev3Resolution.matchedFeatures.includes('heated_seats'));
assert.ok(ev3Resolution.matchedFeatures.includes('camera_360'));
assert.equal(ev3Resolution.requiredPackages[0]?.id, 'ev3-technik');

const ev3Recommendation = buildWishRecommendation({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishFeatureIds: ['camera_360'],
  paymentType: 'leasing',
});
assert.ok(ev3Recommendation.packages?.length >= 1, 'Wish-Magic empfiehlt Technik Paket');
assert.ok(ev3Recommendation.newRateLabel, 'Preisänderung sichtbar');

const ev3CashPrice = getDisplayPrice(
  { paymentMode: 'cash', termMonths: 48, mileagePerYear: 10000, downPayment: 0 },
  null,
  {
    basePricing: {
      payment: 'cash',
      amount: 43690,
      cashPrice: 43690,
      monthlyRate: 349,
    },
  },
);
assert.equal(ev3CashPrice.type, 'cash');
assert.ok(!`${ev3CashPrice.label} ${ev3CashPrice.subtitle}`.includes('/Monat'), 'Kaufpreis ohne Monatsrate');

// ── Sportage Spirit ──
const sportageHeated = analyzeSingleWish({
  brand: 'Kia',
  model: 'Sportage',
  trimId: 'spirit',
  wishId: 'heated_seats',
});
assert.equal(sportageHeated.status, 'standard', 'Sportage Spirit · Sitzheizung serienmäßig');

const sportageTowbar = analyzeSingleWish({
  brand: 'Kia',
  model: 'Sportage',
  trimId: 'spirit',
  wishId: 'towbar',
});
assert.equal(sportageTowbar.status, 'accessory', 'Sportage Spirit · AHK als Zubehör');

const sportageGt360 = analyzeSingleWish({
  brand: 'Kia',
  model: 'Sportage',
  trimId: 'gt-line',
  wishId: 'camera_360',
});
assert.equal(sportageGt360.status, 'standard', 'Sportage GT-Line · 360° serienmäßig');

// ── CleverQuote MVP-Szenario ──
const ev3Quote = computeCleverQuote({
  vehicle: { brand: 'Kia', model: 'EV3', powertrain: 'elektro', bodyType: 'suv' },
  trimId: 'earth',
  wishes: {
    features: MVP_WISHES,
    budget: { maxMonthlyRate: 400 },
  },
});
assert.ok(ev3Quote, 'CleverQuote EV3 Earth liefert Ergebnis');
assert.ok(ev3Quote.percent >= 80, 'CleverQuote EV3 Earth MVP ≥ 80 %');
assert.ok(ev3Quote.items?.length > 0, 'CleverQuote mit Erklärung-Items');
assert.ok(ev3Quote.trustNote == null || typeof ev3Quote.trustNote === 'string');

// Panorama auf EV3 → missing, nicht geraten
const ev3Panorama = analyzeSingleWish({
  brand: 'Kia',
  model: 'EV3',
  trimId: 'earth',
  wishId: 'panorama_roof',
});
assert.equal(ev3Panorama.status, 'missing', 'EV3 Earth · Panorama nicht verfügbar (kein Raten)');

console.log('kiaEv3SportageMvp.test.js: ok');
