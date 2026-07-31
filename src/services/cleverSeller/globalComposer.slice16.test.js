/**
 * Slice 16: Scan-OCR-Pipeline (Provider-Hook, kein Fake-Text)
 * node --test src/services/cleverSeller/globalComposer.slice16.test.js
 */
import assert from 'node:assert/strict';
import { minimizeSensitiveOcrText } from './minimizeSensitiveOcrText.js';
import {
  OCR_PIPELINE_STATUS,
  isPdfScanCandidate,
  mergeExtractedWithOcrPass,
  runComposerScanOcrPipeline,
} from './runComposerScanOcrPipeline.js';
import { runComposerPdfAttachTurnWithOcr } from './runComposerPdfAttachTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
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

// --- Sensitive minimize ---
{
  const cleaned = minimizeSensitiveOcrText(
    `${GOLDEN_CONTRACT}\nIBAN DE89 3704 0044 0532 0130 00\nGehalt: 4.200 €`,
  );
  assert.match(cleaned.text, /Leasingvertrag/);
  assert.match(cleaned.text, /IBAN entfernt/);
  assert.match(cleaned.text, /Gehalt entfernt/);
  assert.ok(cleaned.redacted.includes('IBAN'));
  assert.ok(cleaned.redacted.includes('Gehalt'));
  assert.doesNotMatch(cleaned.text, /3704 0044/);
}

// --- Scan candidate ---
{
  assert.equal(isPdfScanCandidate({ text: '', needsManualDescribe: true }), true);
  assert.equal(isPdfScanCandidate({ ok: true, text: GOLDEN_CONTRACT }), false);
}

// --- Native text: kein OCR ---
{
  const pass = await runComposerScanOcrPipeline({
    extracted: { ok: true, text: GOLDEN_CONTRACT, fileName: 'vertrag.pdf' },
  });
  assert.equal(pass.status, OCR_PIPELINE_STATUS.NATIVE_TEXT);
  assert.equal(pass.usedOcr, false);
  assert.equal(pass.needsManualDescribe, false);
}

// --- Scan ohne Provider → unavailable, kein Fake-Text ---
{
  const pass = await runComposerScanOcrPipeline({
    extracted: {
      ok: false,
      text: '',
      needsManualDescribe: true,
      fileName: 'leasingvertrag-scan.pdf',
    },
  });
  assert.equal(pass.status, OCR_PIPELINE_STATUS.OCR_UNAVAILABLE);
  assert.equal(pass.usedOcr, false);
  assert.equal(pass.text, '');
  assert.equal(pass.needsManualDescribe, true);
  assert.match(pass.message, /OCR nicht angebunden|manuell/i);
}

// --- Injected OCR Provider → Contract Intake ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const { prepared, turn, skipped, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: {
      ok: false,
      text: '',
      needsManualDescribe: true,
      fileName: 'leasingvertrag-scan.pdf',
    },
    file: { name: 'leasingvertrag-scan.pdf', type: 'application/pdf' },
    lead: brandes,
    leadsSnapshot: [brandes],
    customerName: 'Brandes',
    scopeHint: 'dashboard',
    ocrProvider: async () => ({
      text: `${GOLDEN_CONTRACT}\nIBAN DE89 3704 0044 0532 0130 00`,
      confidence: 0.91,
    }),
  });
  assert.equal(skipped, false);
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_COMPLETE);
  assert.equal(prepared.usedOcr, true);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.attachment.sourceType, 'contract_pdf_ocr');
  assert.doesNotMatch(prepared.attachment.extractedText, /3704 0044/);
  assert.ok(turn);
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.sourceDocument?.sourceType, 'contract_pdf_ocr');
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');

  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.equal(applied.lead.crm.customerContracts[0].commercialTerms.monthlyRate, 329);
}

// --- OCR empty → manual, kein Import-Draft ---
{
  const { prepared, turn } = await runComposerPdfAttachTurnWithOcr({
    extracted: {
      ok: false,
      text: '',
      needsManualDescribe: true,
      fileName: 'leasingvertrag-scan.pdf',
    },
    file: { name: 'leasingvertrag-scan.pdf' },
    lead: createBrandesGoldenCaseLead({ phase: 'golden' }),
    ocrProvider: async () => ({ text: '   ' }),
  });
  assert.equal(prepared.needsManualDescribe, true);
  assert.equal(prepared.ok, false);
  assert.ok(
    turn?.preparedActions?.some((a) => (
      a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'blocked'
    ))
    || turn?.missingInformation?.some((m) => m.id === 'contract_pdf_text'),
  );
}

// --- merge helper ---
{
  const merged = mergeExtractedWithOcrPass(
    { ok: false, text: '', fileName: 'scan.pdf' },
    { status: OCR_PIPELINE_STATUS.OCR_COMPLETE, text: GOLDEN_CONTRACT },
  );
  assert.equal(merged.ok, true);
  assert.equal(merged.extractionMethod, 'ocr');
}

console.log('globalComposer.slice16.test.js: ok');
