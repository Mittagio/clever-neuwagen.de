/**
 * Tests: Wunschkonditionen ↔ Clever Auswahl
 */
import assert from 'node:assert/strict';
import { createOfferSelectionGroupFromWish } from './offerSelectionGroup.js';
import { buildDraftFromSelectionVariant } from './offerVariantConfigurator.js';
import {
  buildWishConditionsFromSources,
  formatWishConditionsBanner,
  hasMeaningfulWishConditions,
  mergeOfferCommercialIntoWish,
  syncOfferSelectionGroupsWithWish,
} from './wishConditionsSync.js';
import { getDealerSeed } from '../../data/dealers/index.js';

const wish = buildWishConditionsFromSources({
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  downPayment: 3000,
  desiredRate: 399,
});

assert.ok(hasMeaningfulWishConditions(wish));
assert.ok(formatWishConditionsBanner(wish).includes('48 Monate'));
assert.ok(formatWishConditionsBanner(wish).includes('3.000'));

const group = createOfferSelectionGroupFromWish({
  lead: { id: 'lead-1', wish: { downPayment: 3000 } },
  wishFields: {
    model: 'EV4',
    modelKey: 'ev4',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    desiredRate: 399,
    downPayment: 3000,
  },
});
assert.ok(group);
assert.equal(group.wishConditions.downPayment, 3000);
assert.equal(group.variants[0].payment.downPayment, 3000);
assert.equal(group.variants[0].payment.termMonths, 48);

const conditions = getDealerSeed('autohaus-trinkle');
const draft = buildDraftFromSelectionVariant({ group, variant: group.variants[0], conditions });
assert.equal(draft.termMonths, 48);
assert.equal(draft.downPayment, 3000);
assert.equal(draft.desiredRate, 399);
assert.ok(draft.wishSummaryLine);
assert.equal(draft.conditionsFromWish, true);

const synced = syncOfferSelectionGroupsWithWish([group], {
  termMonths: 36,
  desiredRate: 350,
});
assert.equal(synced[0].wishConditions.termMonths, 36);
assert.equal(synced[0].variants[0].payment.termMonths, 36);
assert.equal(synced[0].variants[0].payment.desiredRate, 350);

const lockedVariant = {
  ...group.variants[0],
  conditionsLocked: true,
  payment: { ...group.variants[0].payment, termMonths: 48 },
};
const lockedGroup = { ...group, variants: [lockedVariant, ...group.variants.slice(1)] };
const syncedLocked = syncOfferSelectionGroupsWithWish([lockedGroup], { termMonths: 24 });
assert.equal(syncedLocked[0].variants[0].payment.termMonths, 48, 'Gesperrte Variante bleibt');
assert.equal(syncedLocked[0].variants[1].payment.termMonths, 24, 'Offene Variante wird aktualisiert');

const mergedEmpty = mergeOfferCommercialIntoWish({}, {
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 35000,
  downPayment: 2000,
});
assert.equal(mergedEmpty.termMonths, 48);
assert.equal(mergedEmpty.mileagePerYear, 35000);
assert.equal(mergedEmpty.downPayment, 2000);
assert.equal(mergedEmpty.paymentType, 'leasing');

const keepManual = mergeOfferCommercialIntoWish(
  { termMonths: 36, mileagePerYear: 10000, paymentType: 'leasing' },
  { termMonths: 48, mileagePerYear: 35000, downPayment: 2000 },
);
assert.equal(keepManual.termMonths, 36, 'manuelle Laufzeit bleibt ohne force');
assert.equal(keepManual.mileagePerYear, 10000, 'manuelle km bleiben ohne force');
assert.equal(keepManual.downPayment, 2000, 'leere AZ wird gefüllt');

const forced = mergeOfferCommercialIntoWish(
  { termMonths: 36, mileagePerYear: 10000 },
  { termMonths: 48, mileagePerYear: 35000, downPayment: 2000, paymentType: 'leasing' },
  { forceFromActiveOffer: true },
);
assert.equal(forced.termMonths, 48, 'aktives Angebot überschreibt Laufzeit');
assert.equal(forced.mileagePerYear, 35000);
assert.equal(forced.downPayment, 2000);

console.log('wishConditionsSync.test.js: ok');
