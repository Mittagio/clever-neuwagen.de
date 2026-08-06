/**
 * Deterministische Extraktion aus Screenshot-/WhatsApp-OCR oder Vision-Transcript.
 * Kein Modellaufruf – für Tests und OCR-Fallback.
 */
import { parseCustomerPhone } from '../dealerAiParser.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';

/** AutoScout24 Angebotsnummern (alphanumerisch, typ. 15–20 Zeichen) */
const AS24_OFFER_ID_RE = /\b([A-Z0-9]{12,22})\b/g;
const AS24_LABEL_RE = /(?:angebots(?:nummer|nr\.?)|as24(?:[-_\s]?id)?)\s*[:#.]\s*([A-Z0-9]{12,22})/i;
const WHATSAPP_CUE_RE = /\bwhats?app\b|\bwa\.me\b|gelesen\s+\d{1,2}:\d{2}|heute\s+\d{1,2}:\d{2}/i;
const OPEN_KM_RE = /(?:\bkm\s*\?|\?\s*km\b|\bkilometer\s*\?|\bjahresfahrleistung\s*\?)/i;
const TERM_MONTHS_RE = /\b(\d{2})\s*monate?\b/i;
const VEHICLE_CUE_RE = /\b((?:kia|suzuki)\s+)?(?:ev\s?[3469]|picanto|sportage|xceed|ceed|niro|sorento|soul|stonic|vitara|swift|s-?cross)(?:\s+[a-z0-9-]{2,20})?/i;

/**
 * @param {string} [text]
 * @returns {'whatsapp_screenshot'|'screenshot'}
 */
export function detectScreenshotSourceKind(text = '') {
  return WHATSAPP_CUE_RE.test(String(text || '')) ? 'whatsapp_screenshot' : 'screenshot';
}

/**
 * @param {'whatsapp_screenshot'|'screenshot'|string} [kind]
 * @returns {string}
 */
export function humanReadableScreenshotSource(kind = 'screenshot') {
  if (kind === 'whatsapp_screenshot') return 'Aus WhatsApp-Screenshot';
  return 'Aus Screenshot erkannt';
}

function isPlausibleAs24OfferId(id = '') {
  const value = String(id || '').toUpperCase();
  if (value.length < 14 || value.length > 20) return false;
  if (/^\d+$/.test(value)) return false;
  if (!/[A-Z]/.test(value) || !/\d/.test(value)) return false;
  // reine Wörter wie ANGEBOTSNUMMER ausschließen
  if (/^(?:ANGEBOTS?NUMMER|AUTOSCOUT|INTERESSE|WHATSAPP)/.test(value)) return false;
  return true;
}

/**
 * @param {string} [text]
 * @returns {string|null}
 */
export function extractAs24OfferId(text = '') {
  const raw = String(text || '');
  const labeled = raw.match(AS24_LABEL_RE);
  if (labeled?.[1] && isPlausibleAs24OfferId(labeled[1])) {
    return labeled[1].toUpperCase();
  }

  const candidates = [...raw.toUpperCase().matchAll(AS24_OFFER_ID_RE)]
    .map((m) => m[1])
    .filter(isPlausibleAs24OfferId);
  return candidates[0] || null;
}

/**
 * @param {string} [text]
 * @returns {string|null}
 */
export function extractScreenshotPhone(text = '') {
  const raw = String(text || '');
  return parseCustomerPhone(raw)
    || (() => {
      const m = raw.match(/(?:^|[^\d])(\+49[\s/-]?\d{2,5}[\s/-]?\d{3,10}|0\d{2,4}[\s/-]?\d{3,10})\b/m);
      if (!m) return null;
      const digits = m[1].replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13 ? m[1].trim() : null;
    })();
}

/**
 * @param {string} [text]
 * @returns {{
 *   sourceKind: string,
 *   sourceLabel: string,
 *   phone: string|null,
 *   as24OfferId: string|null,
 *   vehicleLabel: string|null,
 *   paymentType: 'leasing'|null,
 *   termMonths: number|null,
 *   openQuestions: string[],
 *   facts: object[],
 * }}
 */
export function extractScreenshotInquiryFacts(text = '', options = {}) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  const sourceKind = options.sourceKind || detectScreenshotSourceKind(raw);
  const sourceLabel = humanReadableScreenshotSource(sourceKind);
  const source = options.factSource || SELLER_FACT_SOURCE.DOCUMENT;
  const facts = [];

  const phone = extractScreenshotPhone(raw);
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'phone',
      value: digits || phone,
      label: phone,
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }

  const as24OfferId = extractAs24OfferId(raw);
  if (as24OfferId) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'as24OfferId',
      value: as24OfferId,
      label: `AutoScout24 ${as24OfferId}`,
      source,
      confidence: 0.93,
      needsConfirmation: true,
    }));
  }

  const vehicleMatch = raw.match(VEHICLE_CUE_RE);
  const vehicleLabel = vehicleMatch
    ? vehicleMatch[0].replace(/\s+/g, ' ').trim()
    : null;
  if (vehicleLabel) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: vehicleLabel,
      label: vehicleLabel,
      source,
      confidence: 0.82,
      needsConfirmation: true,
    }));
  }

  const hasLeasing = /\bleasing\b/i.test(raw);
  const termMatch = raw.match(TERM_MONTHS_RE);
  const termMonths = termMatch ? Number(termMatch[1]) : null;
  if (hasLeasing) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }
  if (termMonths != null && termMonths >= 12 && termMonths <= 72) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: termMonths,
      label: `${termMonths} Monate`,
      source,
      confidence: 0.9,
      needsConfirmation: true,
    }));
    if (!hasLeasing) {
      facts.push(createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'paymentType',
        value: 'leasing',
        label: 'Leasing',
        source,
        confidence: 0.75,
        needsConfirmation: true,
      }));
    }
  }

  const openQuestions = [];
  if (OPEN_KM_RE.test(raw)) {
    openQuestions.push('KM?');
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'openSellerQuestion',
      value: 'KM?',
      label: 'Offene Frage: KM?',
      source,
      confidence: 0.88,
      needsConfirmation: false,
    }));
  }

  facts.push(createExtractedFact({
    factClass: SELLER_FACT_CLASS.DOCUMENT_FACT,
    field: 'screenshotSource',
    value: sourceKind,
    label: sourceLabel,
    source,
    confidence: 0.95,
    needsConfirmation: false,
  }));

  return {
    sourceKind,
    sourceLabel,
    phone,
    as24OfferId,
    vehicleLabel,
    paymentType: hasLeasing || termMonths != null ? 'leasing' : null,
    termMonths: termMonths != null && termMonths >= 12 && termMonths <= 72 ? termMonths : null,
    openQuestions,
    facts,
  };
}

/**
 * Diagnose ohne Kundendaten (keine Telefonnummern / Offer-IDs).
 * @param {object} extracted
 */
export function buildScreenshotInterpretDiagnostics(extracted = {}) {
  return {
    sourceKind: extracted.sourceKind || null,
    method: extracted.method || null,
    factFields: (extracted.facts || []).map((f) => f.field).filter(Boolean),
    hasPhone: Boolean(extracted.phone),
    hasAs24OfferId: Boolean(extracted.as24OfferId),
    hasVehicle: Boolean(extracted.vehicleLabel),
    hasTermMonths: extracted.termMonths != null,
    openQuestionCount: (extracted.openQuestions || []).length,
    warning: extracted.warning || null,
  };
}
