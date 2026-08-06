/**
 * Composer Foto/Screenshot-Attach → Interpret → Seller-Turn → Review (kein Auto-Persist).
 * Surfaces: scopeHint `dashboard` | `customer_akte` – gleicher Service wie PDF-Attach.
 */
import { runCleverSellerTurn, runCleverSellerTurnAsync } from './runCleverSellerTurn.js';
import { interpretComposerScreenshot } from './interpretComposerScreenshot.js';
import { prepareComposerScreenshotTurnInput } from './prepareComposerScreenshotTurnInput.js';
import { isCleverScreenshotInterpretEnabled } from './isCleverScreenshotInterpretEnabled.js';

/**
 * @param {object} params
 * @param {object} [params.interpreted] – bereits interpretiert
 * @param {object} [params.file]
 * @param {object} [params.lead]
 * @param {object[]} [params.leadsSnapshot]
 * @param {string} [params.scopeHint]
 * @param {object[]} [params.workingContextItems]
 * @param {object|null} [params.appContext]
 * @param {boolean} [params.asyncTurn]
 */
export function runComposerScreenshotAttachTurn(params = {}) {
  const prepared = prepareComposerScreenshotTurnInput({
    interpreted: params.interpreted,
    file: params.file,
    fileName: params.fileName,
  });

  if (!prepared.ok || prepared.softAttach || !prepared.interpretSeed) {
    return {
      prepared,
      turn: null,
      skipped: true,
      softAttach: true,
      reason: prepared.diagnostics?.warning || 'needs_manual_describe',
    };
  }

  const turnParams = {
    lead: params.lead || {},
    sellerInput: prepared.interpretSeed,
    leadsSnapshot: Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [],
    scopeHint: params.scopeHint || 'dashboard',
    attachments: prepared.attachment ? [prepared.attachment] : [],
    customerName: params.customerName || '',
    workingContextItems: params.workingContextItems || [],
    currentOfferContext: params.currentOfferContext || null,
    appContext: params.appContext || null,
    env: params.env,
  };

  const turn = runCleverSellerTurn(turnParams);

  // Screenshot-Facts ergänzen, falls Inbound sie nicht alle übernommen hat
  if (turn && Array.isArray(prepared.facts) && prepared.facts.length) {
    const existingFields = new Set((turn.extractedFacts || []).map((f) => f.field));
    const extras = prepared.facts.filter((f) => f.field && !existingFields.has(f.field));
    if (extras.length) {
      turn.extractedFacts = [...(turn.extractedFacts || []), ...extras];
      turn.sellerFacts = [...(turn.sellerFacts || []), ...extras];
    }
    if (!turn.uiEffects) turn.uiEffects = {};
    const progress = [
      `✓ ${prepared.sourceLabel || 'Aus Screenshot erkannt'}`,
      ...(turn.uiEffects.progressLines || []).slice(0, 4),
    ];
    turn.uiEffects.progressLines = [...new Set(progress)];
  }

  return {
    prepared,
    turn,
    skipped: false,
    softAttach: false,
    reason: null,
  };
}

/**
 * Async: Bild lesen → Vision/OCR → Turn (optional async OpenAI-Eskalation).
 */
export async function runComposerScreenshotAttachTurnWithInterpret(params = {}) {
  const env = params.env
    || (typeof process !== 'undefined' ? process.env : {});

  if (!isCleverScreenshotInterpretEnabled(env) && !params.force) {
    const prepared = prepareComposerScreenshotTurnInput({
      interpreted: {
        ok: false,
        softAttach: true,
        warning: 'Screenshot-Interpret ist deaktiviert – bitte beschreiben.',
        fileName: params.file?.name || params.fileName,
      },
      file: params.file,
      fileName: params.fileName,
    });
    return {
      prepared,
      turn: null,
      skipped: true,
      softAttach: true,
      reason: 'screenshot_interpret_disabled',
      interpreted: null,
    };
  }

  const interpreted = params.interpreted || await interpretComposerScreenshot({
    file: params.file,
    dataUrl: params.dataUrl,
    mimeType: params.mimeType,
    fileName: params.fileName || params.file?.name,
    env,
    apiKey: params.apiKey,
    runStructured: params.runStructured,
    createResponse: params.createResponse,
    requestVision: params.requestVision,
    ocrImage: params.ocrImage,
    ocrEngine: params.ocrEngine,
    readAsDataUrl: params.readAsDataUrl,
    OpenAI: params.OpenAI,
    timeoutMs: params.timeoutMs,
    force: params.force,
  });

  if (!interpreted?.ok || interpreted.softAttach) {
    const prepared = prepareComposerScreenshotTurnInput({
      interpreted: {
        ...interpreted,
        ok: false,
        softAttach: true,
        warning: interpreted?.warning
          || interpreted?.error
          || 'Screenshot konnte nicht gelesen werden – bitte kurz beschreiben.',
      },
      file: params.file,
      fileName: params.fileName,
    });
    return {
      prepared,
      turn: null,
      skipped: true,
      softAttach: true,
      reason: interpreted?.error || 'interpret_failed',
      interpreted,
    };
  }

  const syncResult = runComposerScreenshotAttachTurn({
    ...params,
    interpreted,
  });

  if (params.asyncTurn && syncResult.turn && typeof runCleverSellerTurnAsync === 'function') {
    try {
      const asyncTurn = await runCleverSellerTurnAsync({
        lead: params.lead || {},
        sellerInput: syncResult.prepared.interpretSeed,
        leadsSnapshot: Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [],
        scopeHint: params.scopeHint || 'dashboard',
        attachments: syncResult.prepared.attachment
          ? [syncResult.prepared.attachment]
          : [],
        customerName: params.customerName || '',
        workingContextItems: params.workingContextItems || [],
        currentOfferContext: params.currentOfferContext || null,
        appContext: params.appContext || null,
        env: params.env,
      });
      if (asyncTurn?.ok) {
        return {
          ...syncResult,
          turn: asyncTurn,
          interpreted,
        };
      }
    } catch {
      // sync Turn behalten
    }
  }

  return {
    ...syncResult,
    interpreted,
  };
}
