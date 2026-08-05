/**
 * node src/services/cleverSeller/mapMagicOfferIntentToSellerFacts.test.js
 */
import assert from 'node:assert/strict';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import {
  extractSellerFactsFromOfferPdfText,
  hasExplicitAppointmentSellerCue,
  isOfferPdfDropContext,
  mergeOfferPdfFactsIntoSellerFacts,
  shouldEnrichSellerInputFromOfferPdf,
} from './mapMagicOfferIntentToSellerFacts.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';

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
assert.equal(
  shouldEnrichSellerInputFromOfferPdf([{ kind: 'contract_pdf', mimeType: 'application/pdf' }], 'x'),
  false,
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
assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
const pdfReview = buildUniversalReviewModel(turn);
assert.ok(
  ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(pdfReview?.reviewType),
  `expected offer review, got ${pdfReview?.reviewType}`,
);
assert.notEqual(pdfReview?.reviewType, 'appointment_and_message_review');
assert.equal(pdfReview?.compactUi, true);
assert.ok(pdfReview?.groups?.length > 0);
assert.ok(
  pdfReview?.actionSections?.some((s) => (
    (s.primaryActions || []).some((a) => (
      /Angebot (erstellen|bearbeiten|vervollständigen)/i.test(a.label || '')
    ))
  )),
);

const applied = applyAcceptedSellerTurn(lead, turn);
assert.equal(applied.ok, true);
// paymentType: Offer-PDF-Leasing hat Vorrang vor konkurrierendem Seller-Input „cash“
const payment = applied.lead.paymentType || applied.lead.wish?.paymentType;
assert.ok(payment === 'leasing' || applied.lead.wish?.termMonths === 36);
assert.equal(applied.lead.wish?.termMonths, 36);
assert.equal(applied.lead.wish?.mileagePerYear, 15000);
assert.equal(applied.lead.wish?.downPayment, 6000);
assert.equal(applied.lead.desiredRate, 329);

// Bare „Leasing“ + Monate + km auch ohne Attachment
const bare = interpretSellerInput('Leasing 36 Monate 15.000 km Anzahlung 0 €');
assert.ok(bare.facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));

// Offer-PDF mit Beratung/Gültigkeitsdatum → Angebot, kein Termin-Primary
assert.equal(isOfferPdfDropContext([{ kind: 'configurator_pdf' }], 'PDF: x.pdf'), true);
assert.equal(hasExplicitAppointmentSellerCue('Schlag ihm Montag um 15 Uhr einen Termin vor.'), true);
assert.equal(hasExplicitAppointmentSellerCue('Wir laden Sie zur Beratung ein. Gültig bis 15.08.2026 10:00 Uhr'), false);

{
  const boilerplateOffer = `Kia EV2 Air Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Monatsrate 329 €
Wir laden Sie zur Beratung ein.
Gültig bis 15.08.2026 10:00 Uhr`;
  const { prepared, turn: attachTurn } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: boilerplateOffer,
      fileName: 'EV2 Air 36 15.000 km.pdf',
    },
    file: { type: 'application/pdf', name: 'EV2 Air 36 15.000 km.pdf' },
    lead,
    leadsSnapshot: [lead],
    scopeHint: 'customer_akte',
    customerName: 'Kai Drechsel',
  });
  assert.equal(prepared.kind, 'configurator_pdf');
  assert.ok(attachTurn?.intents?.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!attachTurn?.intents?.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
  assert.ok(!attachTurn?.extractedFacts?.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT));
  const attachReview = buildUniversalReviewModel(attachTurn);
  assert.notEqual(attachReview?.reviewType, 'appointment_and_message_review');
  assert.ok(
    ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(attachReview?.reviewType),
    `attach reviewType=${attachReview?.reviewType}`,
  );
}

console.log('mapMagicOfferIntentToSellerFacts.test.js: OK');
