import assert from 'node:assert/strict';
import { autohausTrinkleSeed } from '../../data/dealers/autohausTrinkle.js';
import { buildDealerJourneySnapshot } from './purchaseTypeOptions.js';
import { createDefaultConfiguration } from './modelConfiguratorCatalog.js';
import {
  buildJourneyOffers,
  resolveOfferPaymentModes,
  resolveTrimListPrice,
} from './journeyOfferService.js';

assert.ok(resolveTrimListPrice('sorento-hybrid', 'spirit') >= 60000);

assert.deepEqual(resolveOfferPaymentModes('open'), ['cash', 'finance', 'leasing']);
assert.deepEqual(resolveOfferPaymentModes('leasing'), ['leasing']);

const config = createDefaultConfiguration('sorento');
config.trimId = 'platinum';
config.packageIds = ['ahk', 'wartung'];

const snapshot = buildDealerJourneySnapshot({
  configSummary: {
    modelKey: 'sorento-hybrid',
    modelLabel: 'Sorento Hybrid',
    trimLabel: 'Platinum',
    colorLabel: 'Schwarz',
    powertrainLabel: 'Hybrid',
    packageLabels: ['AHK', 'Wartung'],
  },
  purchaseType: 'open',
  specialConditions: ['corporateBenefits'],
  configuration: config,
});

const bundle = buildJourneyOffers(snapshot, autohausTrinkleSeed);
assert.ok(bundle);
assert.equal(bundle.offers.length, 3);
assert.ok(bundle.pricing.cashPrice > 50000);
assert.ok(bundle.pricing.leasingRate > 200);
assert.ok(bundle.pricing.financeRate > 200);
assert.ok(bundle.pricing.finalPayment > 10000);

const cashOnly = buildJourneyOffers(
  { ...snapshot, purchaseType: 'cash' },
  autohausTrinkleSeed,
);
assert.equal(cashOnly.offers.length, 1);
assert.equal(cashOnly.offers[0].id, 'cash');

const ev4Snapshot = buildDealerJourneySnapshot({
  configSummary: {
    modelKey: 'ev4',
    modelLabel: 'EV4',
    trimLabel: 'Earth',
    colorLabel: null,
    powertrainLabel: 'Elektro',
    packageLabels: [],
  },
  purchaseType: 'leasing',
  specialConditions: [],
  configuration: {
    catalogId: 'ev4',
    modelKey: 'ev4',
    trimId: 'earth',
    packageIds: [],
    colorId: null,
    powertrainId: null,
  },
});

const ev4Bundle = buildJourneyOffers(ev4Snapshot, autohausTrinkleSeed);
assert.ok(ev4Bundle);
assert.equal(ev4Bundle.modelKey, 'ev4');
assert.ok(ev4Bundle.pricing.listPrice > 30000);
assert.ok(ev4Bundle.offers.length >= 1);

assert.ok(resolveTrimListPrice('ev4', 'earth') > 30000);

const ev9Snapshot = buildDealerJourneySnapshot({
  configSummary: {
    modelKey: 'ev9',
    modelLabel: 'EV9',
    trimLabel: 'Earth',
    powertrainLabel: 'Elektro',
    packageLabels: [],
  },
  purchaseType: 'leasing',
  configuration: {
    catalogId: 'ev9',
    modelKey: 'ev9',
    trimId: 'earth',
    packageIds: [],
  },
});

const ev9Bundle = buildJourneyOffers(ev9Snapshot, autohausTrinkleSeed);
assert.ok(ev9Bundle);
assert.equal(ev9Bundle.modelKey, 'ev9');
assert.ok(ev9Bundle.pricing.listPrice > 50000);

console.log('journeyOfferService.test.js: ok');
