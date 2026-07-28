/**
 * Schmaler Kontext für Seller-OpenAI-Interpretation.
 * Kein Full-Lead, keine Kontaktdaten, keine Dokumente.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { buildUnderstoodLabels, getNeedProfileFromLead } from '../consultation/needProfileService.js';

/**
 * @param {object} lead
 * @param {{ sellerInput?: string, attachmentTypes?: string[], deterministic?: object }} [options]
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

  return {
    sellerInput,
    attachmentTypes: (options.attachmentTypes ?? []).slice(0, 6),
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
