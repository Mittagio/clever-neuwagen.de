/**
 * Schmaler Kontext für Seller-OpenAI-Interpretation.
 * Kein Full-Lead, keine Kontaktdaten; PDF nur als redacted Excerpts.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { buildUnderstoodLabels, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { minimizeSensitiveOcrText } from './minimizeSensitiveOcrText.js';

const MAX_EXCERPT_CHARS = 3500;
const MAX_TOTAL_EXCERPT_CHARS = 10000;
const MAX_ATTACHMENTS = 4;

/**
 * @param {object} lead
 * @param {{
 *   sellerInput?: string,
 *   attachmentTypes?: string[],
 *   attachments?: object[],
 *   deterministic?: object,
 *   includeAttachmentExcerpts?: boolean,
 * }} [options]
 */
export function buildSellerInterpretSafeContext(lead = {}, options = {}) {
  let understanding = null;
  try {
    understanding = buildCustomerUnderstanding(lead);
  } catch {
    understanding = { verstaendnis: { labels: [] } };
  }

  const profile = getNeedProfileFromLead(lead) || {};
  const knownLabels = buildUnderstoodLabels(profile).slice(0, 12);
  const sellerInput = String(options.sellerInput ?? '').trim().slice(0, 2000);
  const deterministic = options.deterministic ?? {};
  const includeExcerpts = options.includeAttachmentExcerpts !== false;

  return {
    sellerInput,
    attachmentTypes: (options.attachmentTypes ?? []).slice(0, 6),
    attachmentExcerpts: includeExcerpts
      ? buildAttachmentExcerpts(options.attachments || [])
      : [],
    knownLabels,
    needProfileHints: {
      selectedModelKey: profile.selectedModelKey ?? null,
      modelHint: profile.modelHint ?? null,
      annualKm: profile.annualKm ?? null,
      budget: profile.budget ?? null,
      towbar: profile.towbar ?? null,
    },
    customerLabels: (understanding?.verstaendnis?.labels ?? []).slice(0, 10),
    deterministicHints: {
      facts: (deterministic.facts ?? []).slice(0, 12).map((f) => ({
        field: f.field ?? null,
        label: f.label ?? null,
        factClass: f.factClass ?? null,
        confidence: f.confidence ?? null,
      })),
      intents: (deterministic.intents ?? []).slice(0, 6).map((i) => ({
        type: i.type,
        confidence: i.confidence ?? null,
      })),
      inputMode: deterministic.inputMode ?? null,
      confidence: deterministic.confidence ?? null,
    },
  };
}

/**
 * Minimierte, redacted Attachment-Excerpts für OpenAI (kein Full-PDF).
 * @param {object[]} attachments
 */
export function buildAttachmentExcerpts(attachments = []) {
  const out = [];
  let total = 0;
  for (const att of (attachments || []).slice(0, MAX_ATTACHMENTS)) {
    if (total >= MAX_TOTAL_EXCERPT_CHARS) break;
    const raw = String(att?.extractedText || att?.text || '').trim();
    if (!raw) {
      out.push({
        kind: att?.kind || att?.sourceType || null,
        fileName: sanitizeFileName(att?.fileName),
        excerpt: '',
        redacted: [],
        truncated: false,
      });
      continue;
    }
    const minimized = minimizeSensitiveOcrText(raw);
    const budget = Math.min(MAX_EXCERPT_CHARS, MAX_TOTAL_EXCERPT_CHARS - total);
    const truncated = minimized.text.length > budget;
    const excerpt = minimized.text.slice(0, budget);
    total += excerpt.length;
    out.push({
      kind: att?.kind || att?.sourceType || null,
      fileName: sanitizeFileName(att?.fileName),
      excerpt,
      redacted: minimized.redacted || [],
      truncated,
      charCount: excerpt.length,
    });
  }
  return out;
}

function sanitizeFileName(name) {
  const s = String(name || '').trim().slice(0, 80);
  // Keine Pfade
  return s.replace(/^.*[/\\]/, '') || null;
}
