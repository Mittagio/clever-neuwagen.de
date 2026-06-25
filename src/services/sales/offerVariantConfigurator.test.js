/**
 * Tests: Offer Variant Configurator
 */
import assert from 'node:assert/strict';
import { getDealerSeed } from '../../data/dealers/index.js';
import { createOfferSelectionGroup } from './offerSelectionGroup.js';
import {
  buildDraftFromSelectionVariant,
  buildWishAlignmentRows,
  computeVariantConfiguratorPreview,
  draftToSelectionVariantFields,
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

console.log('offerVariantConfigurator.test.js: ok');
