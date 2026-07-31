/**
 * Slice 11: PDF Contract Intake (pre-extracted text, no pdfjs in turn)
 * node --test src/services/cleverSeller/globalComposer.slice11.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { extractCustomerContractFromText } from './extractCustomerContractFromText.js';
import { prepareCustomerContractImport } from './prepareCustomerContractImport.js';
import {
  resolveContractIntakeText,
  hasContractPdfAttachment,
} from './resolveContractIntakeText.js';
import { shouldEnrichSellerInputFromOfferPdf } from './mapMagicOfferIntentToSellerFacts.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN_BODY = `Leasingvertrag
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

const GOLDEN_PDF_COMPOSER = `PDF: vertrag-brandes.pdf

${GOLDEN_BODY}`;

// --- Resolve helpers ---
{
  assert.equal(hasContractPdfAttachment([{ kind: 'contract_pdf' }]), true);
  assert.equal(hasContractPdfAttachment([{ kind: 'configurator_pdf' }]), false);

  const fromAttach = resolveContractIntakeText({
    sellerInput: '',
    attachments: [{
      kind: 'contract_pdf',
      fileName: 'vertrag-brandes.pdf',
      extractedText: GOLDEN_BODY,
    }],
  });
  assert.equal(fromAttach.sourceType, 'contract_pdf');
  assert.equal(fromAttach.needsManualDescribe, false);
  assert.match(fromAttach.text, /Ford Kuga/);

  const prefixed = resolveContractIntakeText({ sellerInput: GOLDEN_PDF_COMPOSER });
  assert.equal(prefixed.sourceType, 'contract_pdf');
  assert.equal(prefixed.fileName, 'vertrag-brandes.pdf');
  assert.ok(!prefixed.text.startsWith('PDF:'));

  const emptyPdf = resolveContractIntakeText({
    attachments: [{ kind: 'contract_pdf', fileName: 'scan.pdf', extractedText: '' }],
  });
  assert.equal(emptyPdf.needsManualDescribe, true);
  assert.equal(emptyPdf.sourceType, 'contract_pdf');
}

// --- Evidence sourceType ---
{
  const extracted = extractCustomerContractFromText(GOLDEN_BODY, {
    sourceType: 'contract_pdf',
    sourceId: 'vertrag-brandes.pdf',
  });
  assert.equal(extracted.contractDraft.monthlyRate, 329);
  assert.ok(extracted.evidence.every((e) => e.sourceType === 'contract_pdf'));
  assert.equal(extracted.contractDraft.sourceDocument.sourceType, 'contract_pdf');
}

// --- Offer enrichment does not steal contract_pdf ---
{
  assert.equal(
    shouldEnrichSellerInputFromOfferPdf([{ kind: 'contract_pdf', mimeType: 'application/pdf' }], ''),
    false,
  );
  assert.equal(
    shouldEnrichSellerInputFromOfferPdf([{ kind: 'configurator_pdf' }], ''),
    true,
  );
}

// --- Prepare via attachment ---
{
  const prepared = prepareCustomerContractImport({
    sellerInput: '',
    customerName: 'Brandes',
    lead: createBrandesGoldenCaseLead({ phase: 'golden' }),
    attachments: [{
      kind: 'contract_pdf',
      fileName: 'vertrag-brandes.pdf',
      extractedText: GOLDEN_BODY,
    }],
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.contractDraft.monthlyRate, 329);
  assert.ok(prepared.evidence.some((e) => e.sourceType === 'contract_pdf'));
  assert.match(prepared.reviewBody || '', /vertrag-brandes\.pdf|QUELLE/i);
}

// --- Intent from attachment-only ---
{
  const interpreted = interpretSellerInput('', {
    attachments: [{
      kind: 'contract_pdf',
      fileName: 'vertrag-brandes.pdf',
      extractedText: GOLDEN_BODY,
    }],
  });
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT));
}

// --- Composer golden: PDF prefix ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_PDF_COMPOSER,
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.ok((turn.evidence || turn.extractedContractFacts || []).some((e) => (
    e.sourceType === 'contract_pdf'
  )) || turn.contractDraft?.sourceDocument?.sourceType === 'contract_pdf');
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');

  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.equal(applied.lead.crm.customerContracts[0].commercialTerms.monthlyRate, 329);
  assert.equal(applied.lead.wish?.leasingEndDate, '2026-11-30');
  assert.notEqual(applied.lead.wish?.desiredRate, 329);
}

// --- Attachment golden ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Lies den Vertrag ein.',
    customerName: 'Brandes',
    attachments: [{
      kind: 'contract_pdf',
      mimeType: 'application/pdf',
      fileName: 'vertrag-brandes.pdf',
      extractedText: GOLDEN_BODY,
    }],
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.equal(turn.contractDraft?.sourceDocument?.sourceType, 'contract_pdf');
}

// --- Empty PDF → needs_manual_describe, no invented fields ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: '',
    customerName: 'Brandes',
    attachments: [{
      kind: 'contract_pdf',
      fileName: 'scan.pdf',
      extractedText: '',
    }],
  });
  const action = turn.preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  ));
  assert.equal(action?.status, 'blocked');
  assert.equal(action?.payload?.warnings?.includes('needs_manual_describe')
    || action?.payload?.missingInformation?.some((m) => m.id === 'contract_pdf_text'), true);
  assert.equal(action?.payload?.contractDraft, null);
}

console.log('globalComposer.slice11.test.js: ok');
