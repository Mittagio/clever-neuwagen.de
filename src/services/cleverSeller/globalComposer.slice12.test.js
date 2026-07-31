/**
 * Slice 12: Akte/Composer PDF-Wiring (classify → contract_pdf | configurator_pdf)
 * node --test src/services/cleverSeller/globalComposer.slice12.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import {
  classifyComposerPdfKind,
  fileNameSuggestsCustomerContract,
  prepareComposerPdfTurnInput,
} from './prepareComposerPdfTurnInput.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

const OFFER_PDF = `Kia EV2 GT-Line Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Anzahlung 6.000 €
Monatsrate 329 €
Keine Schlussrate`;

// --- Classification ---
{
  assert.equal(fileNameSuggestsCustomerContract('vertrag-brandes.pdf'), true);
  assert.equal(fileNameSuggestsCustomerContract('GT-LINE.pdf'), false);
  assert.equal(classifyComposerPdfKind({ text: GOLDEN_CONTRACT, fileName: 'x.pdf' }), 'contract_pdf');
  assert.equal(classifyComposerPdfKind({ text: '', fileName: 'altvertrag-scan.pdf' }), 'contract_pdf');
  assert.equal(classifyComposerPdfKind({ text: OFFER_PDF, fileName: 'GT-LINE.pdf' }), 'configurator_pdf');
}

// --- prepareComposerPdfTurnInput: contract ---
{
  const prepared = prepareComposerPdfTurnInput({
    extracted: {
      ok: true,
      text: GOLDEN_CONTRACT,
      fileName: 'vertrag-brandes.pdf',
    },
    file: { type: 'application/pdf', name: 'vertrag-brandes.pdf' },
  });
  assert.equal(prepared.kind, 'contract_pdf');
  assert.equal(prepared.ok, true);
  assert.equal(prepared.attachment.kind, 'contract_pdf');
  assert.ok(prepared.attachment.extractedText.includes('Ford Kuga'));
  assert.match(prepared.interpretSeed, /PDF: vertrag-brandes\.pdf/);
  assert.match(prepared.feedbackOk, /Vertrag/i);
}

// --- prepareComposerPdfTurnInput: offer stays configurator ---
{
  const prepared = prepareComposerPdfTurnInput({
    extracted: { ok: true, text: OFFER_PDF, fileName: 'GT-LINE.pdf' },
    file: { type: 'application/pdf' },
  });
  assert.equal(prepared.kind, 'configurator_pdf');
  assert.equal(prepared.attachment.kind, 'configurator_pdf');
  assert.equal(prepared.attachment.extractedText, undefined);
}

// --- Empty contract PDF ---
{
  const prepared = prepareComposerPdfTurnInput({
    extracted: { ok: false, text: '', fileName: 'leasingvertrag-scan.pdf', needsManualDescribe: true },
    file: { name: 'leasingvertrag-scan.pdf' },
  });
  assert.equal(prepared.kind, 'contract_pdf');
  assert.equal(prepared.needsManualDescribe, true);
  assert.equal(prepared.attachment.extractedText, '');
  assert.match(prepared.feedbackManual, /manuell/i);
}

// --- End-to-end: prepared attachment → import review ---
{
  const prepared = prepareComposerPdfTurnInput({
    extracted: { ok: true, text: GOLDEN_CONTRACT, fileName: 'vertrag-brandes.pdf' },
  });
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: prepared.interpretSeed,
    attachments: [prepared.attachment],
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.equal(turn.contractDraft?.sourceDocument?.sourceType, 'contract_pdf');
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');
}

// --- Offer PDF does not become contract import ---
{
  const prepared = prepareComposerPdfTurnInput({
    extracted: { ok: true, text: OFFER_PDF, fileName: 'GT-LINE.pdf' },
  });
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: prepared.interpretSeed,
    attachments: [prepared.attachment],
  });
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
}

console.log('globalComposer.slice12.test.js: ok');
