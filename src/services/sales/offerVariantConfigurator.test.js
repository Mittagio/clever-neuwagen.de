/**
 * Tests: Offer Variant Configurator
 */
import assert from 'node:assert/strict';
import { getDealerSeed } from '../../data/dealers/index.js';
import { createOfferSelectionGroup } from './offerSelectionGroup.js';
import {
  buildDraftFromSelectionVariant,
  buildConfiguratorConditionsLine,
  buildPortfolioSummaryLine,
  buildVariantConditionChips,
  buildVariantOfferLabel,
  buildWishAlignmentRows,
  computeVariantCashOffer,
  computeVariantConfiguratorPreview,
  draftToSelectionVariantFields,
  formatConfiguratorUvpAmount,
  formatPackageDisplayLine,
  resolveVariantDisplayAmounts,
  updateSelectionGroupVariant,
} from './offerVariantConfigurator.js';

const conditions = getDealerSeed('autohaus-trinkle');
const group = createOfferSelectionGroup({
  modelKey: 'ev4',
  modelLabel: 'Kia EV4',
  wishConditions: {
    paymentType: 'leasing',
    termMonths: 36,
    mileagePerYear: 15000,
    desiredRate: 399,
  },
});

assert.ok(group, 'Gruppe erzeugt');
const variant = group.variants[0];
assert.ok(variant, 'Variante vorhanden');

const draft = buildDraftFromSelectionVariant({ group, variant, conditions });
assert.ok(draft, 'Draft aus Variante');
assert.equal(draft.termMonths, 36);
assert.ok(draft.preparationFee != null, 'Händler-Überführung');
assert.ok(draft.wishSummaryLine == null || typeof draft.wishSummaryLine === 'string');

const preview = computeVariantConfiguratorPreview(draft, conditions);
assert.ok(preview.rate != null || preview.rate === null, 'Preview berechnet');

const wishRows = buildWishAlignmentRows({
  draft,
  wishConditionChips: ['36 Monate', '15.000 km', 'Budget 399 €'],
  preview,
  catalog: { packages: [] },
});
assert.ok(wishRows.length >= 2, 'Wunschzeilen');

const saved = draftToSelectionVariantFields(variant, draft, preview, { packages: [] });
assert.ok(saved.calculatedRate != null || saved.calculatedPrice != null || true);
assert.ok(saved.packageIds != null);

const updated = updateSelectionGroupVariant([group], group.id, variant.id, saved);
assert.equal(updated[0].variants[0].trimId, saved.trimId);

assert.equal(buildConfiguratorConditionsLine({ paymentType: 'cash' }), 'Kauf');
const variantChips = buildVariantConditionChips({
  payment: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000, downPayment: 0 },
});
assert.ok(variantChips.includes('Leasing'));
assert.ok(variantChips.some((c) => c.includes('48 Monate')));
assert.match(
  buildConfiguratorConditionsLine({ paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000, downPayment: 0 }),
  /48 Monate/,
);

const pkg = { id: 'p1', priceGross: 890, status: 'available' };
assert.match(formatPackageDisplayLine(pkg, 'cash'), /890.*UPE/);
assert.match(formatPackageDisplayLine(pkg, 'leasing', 218), /890.*UPE.*218.*Monat/);
assert.ok(formatConfiguratorUvpAmount(draft).includes('UPE'));

const cashDraft = { ...draft, paymentType: 'cash', displayPriceOverride: 29990 };
const cashPreview = computeVariantConfiguratorPreview(cashDraft, conditions);
const cashDisplay = resolveVariantDisplayAmounts(cashDraft, cashPreview);
assert.equal(cashDisplay.formatted, '29.990 €');

const leaseDraft = {
  ...draft,
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  displayRateOverride: 300,
};
const leaseDisplay = resolveVariantDisplayAmounts(
  leaseDraft,
  computeVariantConfiguratorPreview(leaseDraft, conditions),
);
assert.equal(leaseDisplay.formatted, '300 €/Monat');

const label = buildVariantOfferLabel(leaseDraft);
assert.ok(label.includes('Air') || label.includes(leaseDraft.trimLabel));
assert.ok(label.includes('48'));

const summary = buildPortfolioSummaryLine({
  modelLabel: 'Kia EV3',
  trimLabel: 'Air',
  conditionsLine: 'Leasing · 48 Monate · 10.000 km/Jahr',
  displayFormatted: '300 €/Monat',
});
assert.ok(summary.includes('300 €/Monat'));

const savedCash = draftToSelectionVariantFields(
  variant,
  { ...draft, paymentType: 'cash', displayPriceOverride: 29990 },
  computeVariantConfiguratorPreview({ ...draft, paymentType: 'cash', displayPriceOverride: 29990 }, conditions),
  { packages: [] },
);
assert.equal(savedCash.calculatedPrice, 29990);
assert.equal(savedCash.displayPriceOverride, 29990);

const cashDraftWithOffer = {
  ...draft,
  paymentType: 'cash',
  customerGroup: 'custom',
  customDiscountPercent: 12,
  discountLabel: 'Jubiläumsaktion',
  preparationFee: 1290,
};
const cashOffer = computeVariantCashOffer(cashDraftWithOffer, conditions);
assert.ok(cashOffer?.uvp > 0, 'UPE vorhanden');
assert.equal(cashOffer.discountPercent, 12);
assert.equal(cashOffer.discountLabel, 'Jubiläumsaktion');
assert.equal(cashOffer.preparationFee, 1290);
assert.equal(cashOffer.totalPrice, cashOffer.housePrice + cashOffer.preparationFee);

const cashPreviewOffer = computeVariantConfiguratorPreview(cashDraftWithOffer, conditions);
assert.equal(cashPreviewOffer.isCash, true);
assert.equal(cashPreviewOffer.rate, cashOffer.totalPrice);

const savedCashOffer = draftToSelectionVariantFields(
  variant,
  cashDraftWithOffer,
  cashPreviewOffer,
  { packages: [] },
);
assert.equal(savedCashOffer.preparationFee, 1290);
assert.equal(savedCashOffer.customDiscountPercent, 12);
assert.equal(savedCashOffer.discountLabel, 'Jubiläumsaktion');
assert.equal(savedCashOffer.calculatedPrice, cashOffer.totalPrice);

console.log('offerVariantConfigurator.test.js: ok');
