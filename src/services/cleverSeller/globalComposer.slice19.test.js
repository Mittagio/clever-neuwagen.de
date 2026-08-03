/**
 * Slice 19: Tesseract/Cloud OCR produktiv (Flag + Dependency + Fallback)
 * node --test src/services/cleverSeller/globalComposer.slice19.test.js
 */
import assert from 'node:assert/strict';
import {
  createCloudOcrEnginePlaceholder,
  tryCreateTesseractOcrEngine,
} from './createCleverContractOcrProvider.js';
import {
  isCleverContractOcrEnabled,
  resolveCleverOcrEnginePreference,
  resolveCleverOcrLang,
  resolveCleverOcrProvider,
} from './resolveCleverOcrProvider.js';
import { runComposerPdfAttachTurnWithOcr } from './runComposerPdfAttachTurn.js';
import { OCR_PIPELINE_STATUS } from './runComposerScanOcrPipeline.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
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

const SCAN_EXTRACTED = {
  ok: false,
  text: '',
  needsManualDescribe: true,
  fileName: 'leasingvertrag-scan.pdf',
};

function mockRenderPages() {
  return async () => ([
    { page: 1, dataUrl: 'data:image/png;base64,AAA', width: 10, height: 10 },
  ]);
}

// --- Flags / Prefs ---
{
  assert.equal(isCleverContractOcrEnabled({}), false);
  assert.equal(isCleverContractOcrEnabled({ VITE_CLEVER_CONTRACT_OCR: 'true' }), true);
  assert.equal(isCleverContractOcrEnabled({ CLEVER_CONTRACT_OCR: '1' }), true);
  assert.equal(resolveCleverOcrEnginePreference({}), 'tesseract');
  assert.equal(resolveCleverOcrEnginePreference({
    VITE_CLEVER_CONTRACT_OCR_ENGINE: 'cloud',
  }), 'cloud');
  assert.equal(resolveCleverOcrLang({ VITE_CLEVER_CONTRACT_OCR_LANG: 'eng' }), 'eng');
}

// --- Provider aus → Manual-Fallback (kein Breaking Change) ---
{
  const provider = await resolveCleverOcrProvider({
    env: { VITE_CLEVER_CONTRACT_OCR: 'false' },
    windowRef: {},
  });
  assert.equal(provider, null);

  const { prepared, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: SCAN_EXTRACTED,
    file: { name: 'leasingvertrag-scan.pdf' },
    ocrProvider: provider,
  });
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_UNAVAILABLE);
  assert.equal(prepared.needsManualDescribe, true);
  assert.equal(prepared.ok, false);
  assert.equal(prepared.usedOcr, false);
}

// --- Flag an + gemocktes Tesseract → Contract Intake Review, kein Auto-Persist ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const mockWorker = {
    async recognize() {
      return { data: { text: GOLDEN_CONTRACT, confidence: 91 } };
    },
    async terminate() {},
  };
  const provider = await resolveCleverOcrProvider({
    env: { VITE_CLEVER_CONTRACT_OCR: 'true' },
    windowRef: {},
    createWorker: async () => mockWorker,
    renderPages: mockRenderPages(),
  });
  assert.equal(typeof provider, 'function');

  const { prepared, turn, skipped, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: SCAN_EXTRACTED,
    file: {
      name: 'leasingvertrag-scan.pdf',
      type: 'application/pdf',
      arrayBuffer: async () => new ArrayBuffer(8),
    },
    lead: brandes,
    leadsSnapshot: [brandes],
    customerName: 'Brandes',
    ocrProvider: provider,
  });

  assert.equal(skipped, false);
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_COMPLETE);
  assert.equal(prepared.attachment.sourceType, 'contract_pdf_ocr');
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  // Persist nur nach Confirm
  assert.equal(brandes.crm?.customerContracts?.length || 0, 0);
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.equal(applied.lead.crm.customerContracts[0].commercialTerms.monthlyRate, 329);
}

// --- tryCreateTesseractOcrEngine mit DI ---
{
  const engine = await tryCreateTesseractOcrEngine({
    createWorker: async () => ({
      recognize: async () => ({ data: { text: 'x', confidence: 80 } }),
      terminate: async () => {},
    }),
  });
  assert.equal(engine.id, 'tesseract.js');
  const page = await engine.recognize({ dataUrl: 'data:image/png;base64,AA', page: 1 });
  assert.equal(page.text, 'x');
  assert.equal(page.confidence, 0.8);
  await engine.terminate();
}

// --- Cloud ohne Hook → kontrollierter Fehler, Manual ---
{
  const provider = await resolveCleverOcrProvider({
    env: {
      VITE_CLEVER_CONTRACT_OCR: 'true',
      VITE_CLEVER_CONTRACT_OCR_ENGINE: 'cloud',
    },
    windowRef: {},
  });
  assert.equal(typeof provider, 'function');
  const result = await provider({ file: { name: 'scan.pdf' } });
  assert.equal(result.error, 'ocr_cloud_provider_not_configured');
  assert.equal(result.text, '');

  const placeholder = createCloudOcrEnginePlaceholder();
  assert.equal(placeholder.error, 'ocr_cloud_provider_not_configured');
  assert.equal(typeof placeholder.recognize, 'undefined');

  const { prepared, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: SCAN_EXTRACTED,
    file: { name: 'leasingvertrag-scan.pdf' },
    ocrProvider: provider,
  });
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_FAILED);
  assert.equal(ocr.error, 'ocr_cloud_provider_not_configured');
  assert.match(ocr.message, /Cloud-OCR|manuell/i);
  assert.equal(prepared.needsManualDescribe, true);
}

// --- Cloud via window.__cleverOcrProvider (produktiv-Hook) ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const cloudProvider = async () => ({
    text: GOLDEN_CONTRACT,
    confidence: 0.95,
    engine: 'cloud-mock',
  });
  const provider = await resolveCleverOcrProvider({
    env: {
      VITE_CLEVER_CONTRACT_OCR: 'false',
      VITE_CLEVER_CONTRACT_OCR_ENGINE: 'cloud',
    },
    windowRef: { __cleverOcrProvider: cloudProvider },
  });
  assert.equal(provider, cloudProvider);

  const { prepared, turn, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: SCAN_EXTRACTED,
    file: { name: 'leasingvertrag-scan.pdf' },
    lead: brandes,
    leadsSnapshot: [brandes],
    customerName: 'Brandes',
    ocrProvider: provider,
  });
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_COMPLETE);
  assert.equal(prepared.attachment.sourceType, 'contract_pdf_ocr');
  assert.equal(turn.contractDraft?.monthlyRate, 329);
}

// --- Package tesseract.js ist importierbar (Produktiv-Dependency) ---
{
  const mod = await import('tesseract.js');
  assert.equal(typeof (mod.createWorker || mod.default?.createWorker), 'function');
}

console.log('globalComposer.slice19.test.js: ok');
