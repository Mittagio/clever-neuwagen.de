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

console.log('wishConditionsSync.test.js: ok');
