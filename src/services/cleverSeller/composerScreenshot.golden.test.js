/**
 * Screenshot / WhatsApp-Composer-Attach – Golden + Soft-Fallback (kein Live-API).
 * node --test src/services/cleverSeller/composerScreenshot.golden.test.js
 */
import assert from 'node:assert/strict';
import { extractScreenshotInquiryFacts } from './extractScreenshotInquiryFacts.js';
import { interpretComposerScreenshot } from './interpretComposerScreenshot.js';
import { prepareComposerScreenshotTurnInput } from './prepareComposerScreenshotTurnInput.js';
import {
  runComposerScreenshotAttachTurn,
  runComposerScreenshotAttachTurnWithInterpret,
} from './runComposerScreenshotAttachTurn.js';
import {
  isCleverScreenshotInterpretClientEnabled,
  isCleverScreenshotInterpretEnabled,
} from './isCleverScreenshotInterpretEnabled.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { isInboundLeadPaste } from './inboundLeadIntake.js';

const WHATSAPP_OCR = [
  'WhatsApp',
  'Heute 09:41',
  '+49 170 5544332',
  'AutoScout24',
  'Angebotsnummer: U5YPV81B5VL558434',
  'Kia Sportage GT-Line',
  'Interesse: Leasing 30 Monate',
  'KM?',
].join('\n');

const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// --- Deterministic extract (Golden) ---
{
  const extracted = extractScreenshotInquiryFacts(WHATSAPP_OCR);
  assert.equal(extracted.sourceKind, 'whatsapp_screenshot');
  assert.equal(extracted.sourceLabel, 'Aus WhatsApp-Screenshot');
  assert.ok(extracted.phone);
  assert.match(extracted.phone, /\+49|0170|170/);
  assert.equal(extracted.as24OfferId, 'U5YPV81B5VL558434');
  assert.equal(extracted.paymentType, 'leasing');
  assert.equal(extracted.termMonths, 30);
  assert.ok(extracted.openQuestions.includes('KM?'));
  assert.ok(/sportage/i.test(extracted.vehicleLabel || ''));
  assert.ok(extracted.facts.some((f) => f.field === 'phone'));
  assert.ok(extracted.facts.some((f) => f.field === 'as24OfferId'));
  assert.ok(extracted.facts.some((f) => f.field === 'termMonths' && f.value === 30));
}

// --- Flags ---
{
  assert.equal(isCleverScreenshotInterpretEnabled({
    CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'false',
  }), false);
  assert.equal(isCleverScreenshotInterpretEnabled({
    CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'true',
  }), true);
  assert.equal(isCleverScreenshotInterpretEnabled({
    CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
  }), true);
  assert.equal(isCleverScreenshotInterpretEnabled({
    CLEVER_CONTRACT_OCR: 'true',
  }), true);
  assert.equal(isCleverScreenshotInterpretEnabled({}), false);
  assert.equal(isCleverScreenshotInterpretClientEnabled({
    VITE_CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'false',
  }), false);
  assert.equal(isCleverScreenshotInterpretClientEnabled({
    VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
  }), true);
}

// --- Soft fallback when flag off / no key ---
{
  const disabled = await runComposerScreenshotAttachTurnWithInterpret({
    file: { name: 'wa.png', type: 'image/png' },
    dataUrl: TINY_PNG_DATA_URL,
    env: { CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'false' },
  });
  assert.equal(disabled.softAttach, true);
  assert.equal(disabled.skipped, true);
  assert.ok(disabled.prepared.draftSeed.includes('Foto angehängt'));

  const noKey = await interpretComposerScreenshot({
    dataUrl: TINY_PNG_DATA_URL,
    fileName: 'wa.png',
    env: { CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'true' },
    force: true,
  });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.softAttach, true);
}

// --- Mock Vision → facts + Review ---
{
  const result = await runComposerScreenshotAttachTurnWithInterpret({
    file: { name: 'whatsapp-as24.png', type: 'image/png' },
    dataUrl: TINY_PNG_DATA_URL,
    env: {
      CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'true',
      VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
      CLEVER_SELLER_ORCHESTRATOR: 'true',
    },
    force: true,
    createResponse: async () => ({
      responseId: 'mock_vision',
      parsed: {
        sourceKind: 'whatsapp_screenshot',
        phone: '+49 170 5544332',
        email: null,
        customerName: null,
        as24OfferId: 'U5YPV81B5VL558434',
        vehicleLabel: 'Kia Sportage GT-Line',
        paymentType: 'leasing',
        termMonths: 30,
        annualMileage: null,
        openQuestions: ['KM?'],
        transcript: WHATSAPP_OCR,
        confidence: 0.91,
      },
    }),
  });

  assert.equal(result.softAttach, false);
  assert.equal(result.skipped, false);
  assert.ok(result.interpreted?.ok);
  assert.equal(result.interpreted.as24OfferId, 'U5YPV81B5VL558434');
  assert.equal(result.interpreted.termMonths, 30);
  assert.ok(result.interpreted.phone);
  assert.equal(result.prepared.sourceLabel, 'Aus WhatsApp-Screenshot');
  assert.ok(isInboundLeadPaste(result.prepared.interpretSeed));
  assert.ok(result.turn?.ok);
  assert.ok(
    (result.turn.extractedFacts || []).some((f) => f.field === 'as24OfferId')
    || (result.turn.extractedFacts || []).some((f) => f.field === 'phone')
    || (result.turn.extractedFacts || []).some((f) => f.field === 'termMonths'),
  );
  assert.equal(shouldShowUniversalReview(result.turn), true);
  const review = result.turn.reviewModel || buildUniversalReviewModel(result.turn);
  assert.ok(review);
  assert.ok(
    review.reviewType === 'customer_intake_review'
    || review.kind === 'customer_intake'
    || (review.groups || []).length > 0
    || review.primaryCta,
  );
}

// --- OCR mock path ---
{
  const ocr = await interpretComposerScreenshot({
    dataUrl: TINY_PNG_DATA_URL,
    fileName: 'wa.png',
    env: { CLEVER_SCREENSHOT_INTERPRET_ENABLED: 'true' },
    force: true,
    ocrImage: async () => ({ text: WHATSAPP_OCR, confidence: 0.8 }),
  });
  assert.equal(ocr.ok, true);
  assert.equal(ocr.method, 'ocr');
  assert.equal(ocr.as24OfferId, 'U5YPV81B5VL558434');
  assert.equal(ocr.termMonths, 30);
  assert.ok(!('phone' in (ocr.diagnostics || {}) && typeof ocr.diagnostics.phone === 'string'));
  assert.equal(ocr.diagnostics.hasPhone, true);
  assert.equal(ocr.diagnostics.hasAs24OfferId, true);
}

// --- prepare seed ---
{
  const prepared = prepareComposerScreenshotTurnInput({
    interpreted: {
      ok: true,
      sourceKind: 'whatsapp_screenshot',
      sourceLabel: 'Aus WhatsApp-Screenshot',
      phone: '+49 170 5544332',
      as24OfferId: 'U5YPV81B5VL558434',
      vehicleLabel: 'Kia Sportage',
      paymentType: 'leasing',
      termMonths: 30,
      openQuestions: ['KM?'],
      transcript: WHATSAPP_OCR,
      method: 'openai_vision',
      facts: extractScreenshotInquiryFacts(WHATSAPP_OCR).facts,
    },
    fileName: 'wa.png',
  });
  assert.equal(prepared.ok, true);
  assert.match(prepared.interpretSeed, /Aus WhatsApp-Screenshot/);
  assert.match(prepared.interpretSeed, /U5YPV81B5VL558434/);
  assert.match(prepared.interpretSeed, /30 Monate/);
  assert.match(prepared.interpretSeed, /KM\?/);
}

// --- sync attach from interpreted ---
{
  const extracted = extractScreenshotInquiryFacts(WHATSAPP_OCR);
  const { prepared, turn, softAttach } = runComposerScreenshotAttachTurn({
    interpreted: {
      ok: true,
      ...extracted,
      transcript: WHATSAPP_OCR,
      method: 'ocr',
      fileName: 'wa.png',
    },
    file: { name: 'wa.png', type: 'image/png' },
    lead: {},
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    env: {
      VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
      CLEVER_SELLER_ORCHESTRATOR: 'true',
    },
  });
  assert.equal(softAttach, false);
  assert.ok(prepared.interpretSeed);
  assert.ok(turn?.ok);
}

console.log('composerScreenshot.golden.test.js: OK');
