/**
 * node src/services/cleverSeller/mapMagicOfferIntentToSellerFacts.test.js
 */
import assert from 'node:assert/strict';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { shouldShowUniversalReview } from './buildUniversalReviewModel.js';
import {
  extractSellerFactsFromOfferPdfText,
  mergeOfferPdfFactsIntoSellerFacts,
  shouldEnrichSellerInputFromOfferPdf,
} from './mapMagicOfferIntentToSellerFacts.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';

const leasingPdfText = `
PDF: GT LINE.pdf

Kia EV2 GT-Line Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Anzahlung 6.000 €
Monatsrate 329 €
Keine Schlussrate
`;

const pdfFacts = extractSellerFactsFromOfferPdfText(leasingPdfText);
assert.ok(pdfFacts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
assert.ok(pdfFacts.some((f) => f.field === 'termMonths' && f.value === 36));
assert.ok(pdfFacts.some((f) => f.field === 'annualMileage' && f.value === 15000));
assert.ok(pdfFacts.some((f) => f.field === 'downPayment' && f.value === 6000));
assert.ok(pdfFacts.some((f) => f.field === 'monthlyBudget' && f.value === 329));
assert.ok(pdfFacts.some((f) => f.field === 'vehicleInterest'));
assert.ok(pdfFacts.every((f) => f.source === SELLER_FACT_SOURCE.OFFER_PDF));

assert.equal(
  shouldEnrichSellerInputFromOfferPdf([{ kind: 'configurator_pdf' }], 'x'),
  true,
);
assert.equal(shouldEnrichSellerInputFromOfferPdf([], 'PDF: foo.pdf\nLeasing'), true);
assert.equal(shouldEnrichSellerInputFromOfferPdf([], 'nur text'), false);

const merged = mergeOfferPdfFactsIntoSellerFacts(
  [{
    factClass: SELLER_FACT_CLASS.SELLER_FACT,
    field: 'termMonths',
    value: 48,
    label: '48 Monate',
    source: 'seller_input',
    confidence: 0.8,
  }],
  pdfFacts,
);
assert.equal(merged.find((f) => f.field === 'termMonths')?.value, 36);
assert.equal(merged.find((f) => f.field === 'termMonths')?.source, SELLER_FACT_SOURCE.OFFER_PDF);

const interpreted = interpretSellerInput(leasingPdfText, {
  attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf' }],
});
assert.ok(interpreted.facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
assert.ok(interpreted.facts.some((f) => f.field === 'downPayment' && f.value === 6000));
assert.ok(interpreted.facts.some((f) => f.field === 'termMonths' && f.value === 36));
assert.ok(interpreted.facts.some((f) => f.field === 'annualMileage' && f.value === 15000));

const lead = {
  id: 'lead-pdf-1',
  name: 'Kai Drechsel',
  wish: {},
  crm: { needProfile: createEmptyNeedProfile() },
};
const turn = runCleverSellerTurn({
  lead,
  sellerInput: leasingPdfText,
  attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf' }],
});
assert.ok(shouldShowUniversalReview(turn));
assert.ok(turn.extractedFacts.some((f) => f.field === 'downPayment'));

const applied = applyAcceptedSellerTurn(lead, turn);
assert.equal(applied.ok, true);
assert.equal(applied.lead.paymentType, 'leasing');
assert.equal(applied.lead.wish?.paymentType, 'leasing');
assert.equal(applied.lead.wish?.termMonths, 36);
assert.equal(applied.lead.wish?.mileagePerYear, 15000);
assert.equal(applied.lead.wish?.downPayment, 6000);
assert.equal(applied.lead.desiredRate, 329);

// Bare „Leasing“ + Monate + km auch ohne Attachment
const bare = interpretSellerInput('Leasing 36 Monate 15.000 km Anzahlung 0 €');
assert.ok(bare.facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));

console.log('mapMagicOfferIntentToSellerFacts.test.js: OK');
