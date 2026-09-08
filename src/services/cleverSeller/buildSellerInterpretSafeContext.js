/**
 * Schmaler Kontext für Seller-OpenAI-Interpretation.
 * Kein Full-Lead, keine Kontaktdaten; PDF nur als redacted Excerpts.
 * Working-State kompakt für Korrekturen („doch weiß“).
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
 *   currentOfferContext?: object|null,
 *   workingContext?: object|null,
 *   workingMemory?: object|null,
 *   conversationHistory?: object[],
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
  const wish = lead?.wish || {};
  const workingState = buildCompactWorkingState(lead, profile, wish, options);

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
      fuel: profile.fuel ?? null,
      colorPreference: profile.colorPreference ?? wish.preferredColor ?? null,
    },
    customerLabels: (understanding?.verstaendnis?.labels ?? []).slice(0, 10),
    workingState,
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
 * Kompakter Gesprächs-/Draft-Kontext für semantische Korrekturen.
 * Kein Full-Lead.
 */
export function buildCompactWorkingState(lead = {}, profile = {}, wish = {}, options = {}) {
  const crm = lead?.crm || {};
  const offerCtx = options.currentOfferContext || null;
  const memory = options.workingMemory || null;
  const draftId = memory?.currentOfferDraftId
    || crm?.cleverWorkingState?.currentOfferDraftId
    || offerCtx?.offerDraftId
    || null;
  const identity = memory?.currentOfferDraft?.vehicleIdentityDraft
    || crm?.cleverWorkingState?.currentOfferDraft?.vehicleIdentityDraft
    || null;
  const focusedTrackId = crm?.focusedVehicleTrackId
    || offerCtx?.vehicleTrackId
    || memory?.focusedVehicleTrackId
    || null;

  const lastTurn = pickLastSellerTurn(options.conversationHistory);

  return {
    vehicleInterest: profile.selectedModelKey || profile.modelHint || null,
    modelKey: profile.selectedModelKey || identity?.modelKey || offerCtx?.modelKey || null,
    colorPreference: profile.colorPreference || wish.preferredColor
      || identity?.color?.raw || identity?.color?.canonical || null,
    fuelPreference: profile.fuel || null,
    paymentType: wish.paymentType || null,
    termMonths: wish.termMonths ?? null,
    annualMileage: wish.mileagePerYear ?? profile.annualKm ?? null,
    downPayment: wish.downPayment ?? null,
    equipmentWishes: (profile.equipmentWishes || []).slice(0, 12),
    focusedVehicleTrackId: focusedTrackId,
    offerDraftId: draftId,
    identitySlots: identity
      ? {
        model: identity.model?.canonical || identity.model?.raw || null,
        trim: identity.trim?.canonical || identity.trim?.raw || null,
        color: identity.color?.canonical || identity.color?.raw || null,
      }
      : null,
    lastSellerTurn: lastTurn,
  };
}

function pickLastSellerTurn(history = []) {
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const row = list[i];
    const role = String(row?.role || row?.speaker || '').toLowerCase();
    const text = String(row?.content || row?.text || row?.sellerInput || '').trim();
    if (!text) continue;
    if (role && /assistant|clever|system/.test(role) && !/seller|user|human/.test(role)) {
      continue;
    }
    return text.slice(0, 240);
  }
  return null;
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
  return s.replace(/^.*[/\\]/, '') || null;
}
