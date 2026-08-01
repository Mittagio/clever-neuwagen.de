/**
 * Slice 17: Produkt-OCR-Provider (pdfjs-Seiten + Engine-Hook)
 * node --test src/services/cleverSeller/globalComposer.slice17.test.js
 */
import assert from 'node:assert/strict';
import { createCleverContractOcrProvider } from './createCleverContractOcrProvider.js';
import {
  isCleverContractOcrEnabled,
  resolveCleverOcrProvider,
} from './resolveCleverOcrProvider.js';
import { runComposerPdfAttachTurnWithOcr } from './runComposerPdfAttachTurn.js';
import { OCR_PIPELINE_STATUS } from './runComposerScanOcrPipeline.js';
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

// --- Feature flag ---
{
  assert.equal(isCleverContractOcrEnabled({ VITE_CLEVER_CONTRACT_OCR: 'true' }), true);
  assert.equal(isCleverContractOcrEnabled({ VITE_CLEVER_CONTRACT_OCR: 'false' }), false);
  assert.equal(isCleverContractOcrEnabled({}), false);
}

// --- Flag aus → null Provider ---
{
  const provider = await resolveCleverOcrProvider({
    env: { VITE_CLEVER_CONTRACT_OCR: 'false' },
    windowRef: {},
  });
  assert.equal(provider, null);
}

// --- window.__cleverOcrProvider hat Vorrang ---
{
  const custom = async () => ({ text: 'custom', confidence: 1 });
  const provider = await resolveCleverOcrProvider({
    env: { VITE_CLEVER_CONTRACT_OCR: 'false' },
    windowRef: { __cleverOcrProvider: custom },
  });
  assert.equal(provider, custom);
}

// --- Default Provider + Mock-Engine: Scan → Contract Intake ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const engine = {
    id: 'mock-engine',
    async recognize() {
      return { text: GOLDEN_CONTRACT, confidence: 0.88 };
    },
  };
  const provider = createCleverContractOcrProvider({
    engine,
    renderPages: async () => ([
      { page: 1, dataUrl: 'data:image/png;base64,AAA', width: 10, height: 10 },
    ]),
  });

  const { prepared, turn, skipped, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: {
      ok: false,
      text: '',
      needsManualDescribe: true,
      fileName: 'leasingvertrag-scan.pdf',
    },
    file: { name: 'leasingvertrag-scan.pdf', type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) },
    lead: brandes,
    leadsSnapshot: [brandes],
    customerName: 'Brandes',
    ocrProvider: provider,
  });

  assert.equal(skipped, false);
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_COMPLETE);
  assert.equal(prepared.usedOcr, true);
  assert.equal(prepared.attachment.sourceType, 'contract_pdf_ocr');
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.equal(turn.contractDraft?.sourceDocument?.sourceType, 'contract_pdf_ocr');
}

// --- Engine fehlt → klarer Fehler, kein Fake-Text ---
{
  const provider = createCleverContractOcrProvider({ engine: null });
  const result = await provider({ file: { name: 'scan.pdf' } });
  assert.equal(result.error, 'ocr_engine_not_configured');
  assert.equal(result.text, '');

  const { prepared, ocr } = await runComposerPdfAttachTurnWithOcr({
    extracted: {
      ok: false,
      text: '',
      needsManualDescribe: true,
      fileName: 'leasingvertrag-scan.pdf',
    },
    file: { name: 'leasingvertrag-scan.pdf' },
    ocrProvider: provider,
  });
  assert.equal(ocr.status, OCR_PIPELINE_STATUS.OCR_FAILED);
  assert.equal(ocr.error, 'ocr_engine_not_configured');
  assert.equal(prepared.needsManualDescribe, true);
  assert.equal(prepared.ok, false);
}

// --- Flag an ohne Engine → Provider vorhanden, schlägt kontrolliert fehl ---
{
  const provider = await resolveCleverOcrProvider({
    env: { VITE_CLEVER_CONTRACT_OCR: 'true' },
    engine: null,
    windowRef: {},
  });
  assert.equal(typeof provider, 'function');
  const result = await provider({ file: { name: 'x.pdf' } });
  assert.equal(result.error, 'ocr_engine_not_configured');
}

console.log('globalComposer.slice17.test.js: ok');
