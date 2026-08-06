/**
 * Screenshot/Foto → Vision (OpenAI) oder OCR → strukturierte Inquiry-Facts.
 * Privacy: keine Full-Bild-Logs; Diagnose ohne Kundendaten.
 */
import {
  CLEVER_SCREENSHOT_INTERPRET_SCHEMA,
  SCREENSHOT_VISION_INSTRUCTIONS,
} from './cleverScreenshotInterpretSchema.js';
import {
  buildScreenshotInterpretDiagnostics,
  detectScreenshotSourceKind,
  extractScreenshotInquiryFacts,
  humanReadableScreenshotSource,
} from './extractScreenshotInquiryFacts.js';
import { minimizeSensitiveOcrText } from './minimizeSensitiveOcrText.js';
import { isCleverScreenshotInterpretEnabled } from './isCleverScreenshotInterpretEnabled.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { SELLER_FACT_CLASS } from './sellerFactTypes.js';

const ENV = typeof process !== 'undefined' && process.env ? process.env : {};

function resolveModel(options = {}) {
  return options.model
    || ENV.OPENAI_QUERY_MODEL
    || ENV.OPENAI_CLEVER_MODEL
    || ENV.OPENAI_MODEL
    || 'gpt-4o-mini';
}

/**
 * @param {Blob|File|{ arrayBuffer?: Function, type?: string, name?: string }} file
 * @returns {Promise<{ dataUrl: string, mimeType: string, base64: string }|null>}
 */
export async function readImageAsDataUrl(file, options = {}) {
  if (!file) return null;
  if (typeof options.readAsDataUrl === 'function') {
    return options.readAsDataUrl(file);
  }
  if (typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:')) {
    const mimeType = file.mimeType || file.type || 'image/jpeg';
    const base64 = file.dataUrl.split(',')[1] || '';
    return { dataUrl: file.dataUrl, mimeType, base64 };
  }
  if (typeof Buffer !== 'undefined' && typeof file.arrayBuffer === 'function') {
    const buf = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/jpeg';
    const base64 = buf.toString('base64');
    return {
      dataUrl: `data:${mimeType};base64,${base64}`,
      mimeType,
      base64,
    };
  }
  if (typeof FileReader !== 'undefined' && typeof Blob !== 'undefined' && file instanceof Blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read_failed'));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith('data:')) return null;
    const mimeType = file.type || 'image/jpeg';
    return {
      dataUrl,
      mimeType,
      base64: dataUrl.split(',')[1] || '',
    };
  }
  return null;
}

/**
 * Vision-Parsed → Facts mergen (Vision-Felder + deterministischer Transcript-Pass).
 */
export function mergeVisionWithDeterministicExtract(parsed = {}, options = {}) {
  const transcript = String(parsed.transcript || options.transcript || '').trim();
  const sourceKind = parsed.sourceKind && parsed.sourceKind !== 'unknown'
    ? parsed.sourceKind
    : detectScreenshotSourceKind(transcript);
  const fromText = extractScreenshotInquiryFacts(transcript, {
    sourceKind,
    factSource: options.factSource || SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
  });

  const facts = [...fromText.facts];
  const ensure = (field, builder) => {
    if (facts.some((f) => f.field === field)) return;
    const fact = builder();
    if (fact) facts.push(fact);
  };

  const source = options.factSource || SELLER_FACT_SOURCE.OPENAI_INTERPRETATION;
  if (parsed.phone) {
    ensure('phone', () => createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'phone',
      value: String(parsed.phone).replace(/\D/g, '') || parsed.phone,
      label: String(parsed.phone).trim(),
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }
  if (parsed.as24OfferId) {
    ensure('as24OfferId', () => createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'as24OfferId',
      value: String(parsed.as24OfferId).toUpperCase(),
      label: `AutoScout24 ${String(parsed.as24OfferId).toUpperCase()}`,
      source,
      confidence: 0.93,
      needsConfirmation: true,
    }));
  }
  if (parsed.vehicleLabel) {
    ensure('vehicleInterest', () => createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: parsed.vehicleLabel,
      label: parsed.vehicleLabel,
      source,
      confidence: 0.85,
      needsConfirmation: true,
    }));
  }
  if (parsed.paymentType === 'leasing') {
    ensure('paymentType', () => createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }
  if (parsed.termMonths != null) {
    ensure('termMonths', () => createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: Number(parsed.termMonths),
      label: `${Number(parsed.termMonths)} Monate`,
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }
  for (const q of parsed.openQuestions || []) {
    if (!String(q || '').trim()) continue;
    if (facts.some((f) => f.field === 'openSellerQuestion' && f.value === q)) continue;
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'openSellerQuestion',
      value: String(q).trim(),
      label: `Offene Frage: ${String(q).trim()}`,
      source,
      confidence: 0.86,
      needsConfirmation: false,
    }));
  }

  const phone = fromText.phone || parsed.phone || null;
  const as24OfferId = fromText.as24OfferId
    || (parsed.as24OfferId ? String(parsed.as24OfferId).toUpperCase() : null);
  const openQuestions = [
    ...new Set([...(fromText.openQuestions || []), ...(parsed.openQuestions || []).map(String)]),
  ].filter(Boolean);

  return {
    sourceKind,
    sourceLabel: humanReadableScreenshotSource(sourceKind),
    phone,
    email: parsed.email || null,
    customerName: parsed.customerName || null,
    as24OfferId,
    vehicleLabel: fromText.vehicleLabel || parsed.vehicleLabel || null,
    paymentType: fromText.paymentType || parsed.paymentType || null,
    termMonths: fromText.termMonths ?? parsed.termMonths ?? null,
    annualMileage: parsed.annualMileage ?? null,
    openQuestions,
    transcript,
    facts,
    confidence: Number(parsed.confidence) || 0.8,
  };
}

/**
 * @param {{
 *   file?: object,
 *   dataUrl?: string,
 *   mimeType?: string,
 *   fileName?: string,
 *   env?: object,
 *   apiKey?: string|null,
 *   runStructured?: Function,
 *   createResponse?: Function,
 *   ocrImage?: Function,
 *   ocrEngine?: { recognize: Function },
 *   requestVision?: Function,
 *   readAsDataUrl?: Function,
 *   timeoutMs?: number,
 *   model?: string,
 * }} [params]
 */
export async function interpretComposerScreenshot(params = {}) {
  const started = Date.now();
  const env = params.env || ENV;
  const fileName = params.fileName || params.file?.name || 'screenshot.jpg';

  const fail = (error, extra = {}) => ({
    ok: false,
    error,
    softAttach: true,
    method: extra.method || null,
    sourceKind: 'screenshot',
    sourceLabel: humanReadableScreenshotSource('screenshot'),
    facts: [],
    transcript: '',
    fileName,
    diagnostics: buildScreenshotInterpretDiagnostics({
      sourceKind: 'screenshot',
      method: extra.method || null,
      warning: error,
      facts: [],
    }),
    latencyMs: Date.now() - started,
    ...extra,
  });

  if (!isCleverScreenshotInterpretEnabled(env) && !params.force) {
    return fail('screenshot_interpret_disabled');
  }

  let image = null;
  try {
    image = params.dataUrl
      ? {
        dataUrl: params.dataUrl,
        mimeType: params.mimeType || 'image/jpeg',
        base64: String(params.dataUrl).split(',')[1] || params.base64 || '',
      }
      : await readImageAsDataUrl(params.file, { readAsDataUrl: params.readAsDataUrl });
  } catch {
    return fail('image_read_failed');
  }
  if (!image?.dataUrl && !image?.base64) {
    return fail('image_read_failed');
  }

  const mimeType = image.mimeType || params.mimeType || 'image/jpeg';
  const apiKey = params.apiKey ?? env.OPENAI_API_KEY ?? null;
  const model = resolveModel(params);

  // 1) OpenAI Vision (direkt oder via requestVision / createResponse Mock)
  if (params.createResponse || params.runStructured || params.requestVision || apiKey) {
    try {
      let parsed = null;
      let responseId = null;
      let method = 'openai_vision';

      if (typeof params.createResponse === 'function') {
        const mocked = await params.createResponse({
          schema: CLEVER_SCREENSHOT_INTERPRET_SCHEMA,
          model,
          fileName,
        });
        parsed = mocked?.parsed ?? mocked;
        responseId = mocked?.responseId || 'mock_response';
      } else if (typeof params.requestVision === 'function') {
        const remote = await params.requestVision({
          imageBase64: image.base64,
          mimeType,
          fileName,
        });
        if (!remote?.ok) {
          // Vision fehlgeschlagen → OCR versuchen
          parsed = null;
          method = null;
        } else {
          parsed = remote.parsed || remote.extract || null;
          responseId = remote.responseId || null;
        }
      } else {
        const runStructured = params.runStructured || (async (req) => {
          const { runOpenAiStructuredJsonResponse } = await import(
            '../clever/openai/openAiResponsesClient.js'
          );
          return runOpenAiStructuredJsonResponse(req, { OpenAI: params.OpenAI });
        });

        const result = await runStructured({
          instructions: SCREENSHOT_VISION_INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({
                    task: 'screenshot_inquiry_extract',
                    fileName,
                  }),
                },
                {
                  type: 'input_image',
                  image_url: image.dataUrl.startsWith('data:')
                    ? image.dataUrl
                    : `data:${mimeType};base64,${image.base64}`,
                },
              ],
            },
          ],
          model,
          apiKey,
          timeoutMs: params.timeoutMs ?? 25000,
          jsonSchema: CLEVER_SCREENSHOT_INTERPRET_SCHEMA,
          store: false,
        });

        if (!result?.ok) {
          parsed = null;
          method = null;
        } else {
          parsed = result.parsed;
          responseId = result.responseId || null;
        }
      }

      if (parsed && typeof parsed === 'object') {
        const minimized = minimizeSensitiveOcrText(String(parsed.transcript || ''));
        const merged = mergeVisionWithDeterministicExtract(
          { ...parsed, transcript: minimized.text },
          { factSource: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION },
        );
        const useful = Boolean(
          merged.phone
          || merged.as24OfferId
          || merged.vehicleLabel
          || merged.termMonths
          || (merged.facts || []).some((f) => (
            f.field !== 'screenshotSource' && f.field !== 'openSellerQuestion'
          )),
        );
        if (useful || (merged.transcript && merged.transcript.length > 40)) {
          return {
            ok: true,
            error: null,
            softAttach: false,
            method: method || 'openai_vision',
            responseId,
            model,
            fileName,
            ...merged,
            transcript: minimized.text,
            diagnostics: buildScreenshotInterpretDiagnostics({
              ...merged,
              method: method || 'openai_vision',
            }),
            latencyMs: Date.now() - started,
          };
        }
      }
    } catch {
      // Vision fail → OCR
    }
  }

  // 2) OCR-Fallback (Engine oder ocrImage-Hook)
  let ocrText = '';
  let ocrConfidence = null;
  try {
    if (typeof params.ocrImage === 'function') {
      const ocr = await params.ocrImage({
        file: params.file,
        dataUrl: image.dataUrl,
        mimeType,
        fileName,
      });
      ocrText = String(ocr?.text || '').trim();
      ocrConfidence = ocr?.confidence ?? null;
    } else if (params.ocrEngine && typeof params.ocrEngine.recognize === 'function') {
      const ocr = await params.ocrEngine.recognize({
        dataUrl: image.dataUrl,
        page: 1,
      });
      ocrText = String(typeof ocr === 'string' ? ocr : ocr?.text || '').trim();
      ocrConfidence = typeof ocr === 'object' ? ocr?.confidence ?? null : null;
    }
  } catch {
    ocrText = '';
  }

  if (ocrText.length >= 20) {
    const minimized = minimizeSensitiveOcrText(ocrText);
    const extracted = extractScreenshotInquiryFacts(minimized.text, {
      factSource: SELLER_FACT_SOURCE.DOCUMENT,
    });
    const useful = Boolean(
      extracted.phone
      || extracted.as24OfferId
      || extracted.vehicleLabel
      || extracted.termMonths
      || extracted.facts.length > 1,
    );
    if (useful) {
      return {
        ok: true,
        error: null,
        softAttach: false,
        method: 'ocr',
        responseId: null,
        model: null,
        fileName,
        ...extracted,
        transcript: minimized.text,
        confidence: ocrConfidence ?? 0.7,
        diagnostics: buildScreenshotInterpretDiagnostics({
          ...extracted,
          method: 'ocr',
        }),
        latencyMs: Date.now() - started,
      };
    }
  }

  return fail('interpret_failed', {
    method: apiKey || params.requestVision ? 'vision_then_ocr' : 'ocr',
    warning: 'Screenshot konnte nicht inhaltlich gelesen werden',
  });
}
