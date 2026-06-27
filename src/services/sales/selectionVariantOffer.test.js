/**
 * selectionVariantOffer.test.js
 */
import assert from 'node:assert/strict';
import {
  formatVariantOfferBadge,
  removePdfFromSelectionVariant,
  variantHasOfferPdf,
  VARIANT_OFFER_STATUS,
} from './selectionVariantOffer.js';

const variant = {
  id: 'variant-1',
  trimLabel: 'Earth',
  trimId: 'earth',
};

assert.equal(variantHasOfferPdf(variant), false);
assert.equal(formatVariantOfferBadge(variant), 'Noch kein PDF');

const withPdf = {
  ...variant,
  offerPdf: {
    fileName: 'ev6-leasing.pdf',
    uploadedAt: new Date().toISOString(),
    sizeBytes: 1200,
    dataUrl: 'data:application/pdf;base64,abc',
  },
  offerStatus: VARIANT_OFFER_STATUS.PDF_UPLOADED,
};

assert.equal(variantHasOfferPdf(withPdf), true);
assert.equal(formatVariantOfferBadge(withPdf), 'PDF hinterlegt');

const cleared = removePdfFromSelectionVariant(withPdf);
assert.equal(cleared.offerPdf, null);
assert.equal(cleared.offerStatus, VARIANT_OFFER_STATUS.DRAFT);

console.log('selectionVariantOffer.test.js: OK');
