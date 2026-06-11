import assert from 'node:assert/strict';
import {
  buildDealerJourneySnapshot,
  getPurchaseTypeLabel,
  shouldShowAllPaymentVariants,
} from './purchaseTypeOptions.js';

assert.equal(getPurchaseTypeLabel('leasing'), 'Leasing');
assert.equal(getPurchaseTypeLabel('open'), 'Noch offen');
assert.equal(shouldShowAllPaymentVariants('open'), true);
assert.equal(shouldShowAllPaymentVariants('cash'), false);

const snapshot = buildDealerJourneySnapshot({
  configSummary: {
    modelKey: 'sorento-hybrid',
    modelLabel: 'Sorento Hybrid',
    trimLabel: 'Platinum',
    colorLabel: 'Schwarz',
    powertrainLabel: 'Hybrid',
    packageLabels: ['AHK'],
  },
  purchaseType: 'leasing',
});

assert.equal(snapshot.purchaseTypeLabel, 'Leasing');
assert.equal(snapshot.vehicle.trimLabel, 'Platinum');
assert.equal(snapshot.showAllPaymentVariants, false);

const openSnap = buildDealerJourneySnapshot({
  configSummary: { modelLabel: 'Sorento', trimLabel: 'Spirit' },
  purchaseType: 'open',
});
assert.equal(openSnap.showAllPaymentVariants, true);

const withConditions = buildDealerJourneySnapshot({
  configSummary: { modelLabel: 'Sorento', trimLabel: 'Spirit' },
  purchaseType: 'finance',
  specialConditions: ['schwerbehindert'],
});
assert.equal(withConditions.discountGroup, 'schwerbehindert');

console.log('purchaseTypeOptions.test.js: ok');
