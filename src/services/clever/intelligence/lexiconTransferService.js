/**
 * Lexikon → Kundenakte Übernahme (nur nach Bestätigung, bestehende Schreibpfade).
 */
import { appendSellerInsightToLead } from '../../dealer/sellerInsights.js';
import { applyNeedProfilePatch, sanitizeNeedProfilePatch } from '../openai/needProfilePatch.js';

export const LEXICON_TRANSFER_MODES = {
  DISCUSSED_INFO: 'discussed_information',
  CUSTOMER_INTEREST: 'customer_interest',
  HARD_REQUIREMENT: 'hard_requirement',
  VEHICLE_DIRECTION: 'vehicle_direction',
  NOTE_ONLY: 'note_only',
};

/**
 * @param {object} params
 * @param {object} params.lexiconResult
 * @param {string} params.mode
 * @param {string} [params.query]
 */
export function buildLexiconTransferPreview({ lexiconResult, mode, query = '' } = {}) {
  const answer = lexiconResult?.answer ?? '';
  const models = (lexiconResult?.vehicleDirections ?? []).map((d) => d.modelKey).filter(Boolean);
  const facts = (lexiconResult?.facts ?? []).map((f) => `${f.label}: ${f.value}`);

  const preview = {
    mode,
    noteText: null,
    needProfilePatch: {},
    sellerInsightText: null,
    linkModels: models,
  };

  switch (mode) {
    case LEXICON_TRANSFER_MODES.DISCUSSED_INFO:
      preview.noteText = `Besprochen: ${answer}`;
      preview.sellerInsightText = `Lexikon · besprochen: ${query || answer}`.slice(0, 500);
      break;
    case LEXICON_TRANSFER_MODES.CUSTOMER_INTEREST:
      preview.sellerInsightText = `Kundeninteresse: ${answer}`.slice(0, 500);
      if (models[0]) {
        preview.needProfilePatch = { modelHint: models[0], selectedModelKey: models[0] };
      }
      break;
    case LEXICON_TRANSFER_MODES.HARD_REQUIREMENT:
      preview.sellerInsightText = `Zwingender Wunsch: ${answer}`.slice(0, 500);
      if (facts.some((f) => /sitz/i.test(f))) {
        const match = answer.match(/(\d)\s*sitz/i);
        if (match) preview.needProfilePatch = { persons: Number(match[1]) };
      }
      break;
    case LEXICON_TRANSFER_MODES.VEHICLE_DIRECTION:
      preview.sellerInsightText = `Fahrzeugrichtung: ${models.join(', ') || answer}`.slice(0, 500);
      if (models[0]) {
        preview.needProfilePatch = { modelHint: models[0], selectedModelKey: models[0] };
      }
      break;
    case LEXICON_TRANSFER_MODES.NOTE_ONLY:
    default:
      preview.noteText = answer;
      preview.sellerInsightText = `Notiz: ${query || answer}`.slice(0, 500);
      break;
  }

  return preview;
}

/**
 * Persistiert nur nach Bestätigung über bestehende Schreibpfade.
 * @param {object} lead
 * @param {object} preview
 * @param {{ confirmed?: boolean }} options
 */
export function applyLexiconTransferToLead(lead, preview, options = {}) {
  if (options.confirmed !== true) {
    return {
      ok: false,
      error: 'confirmation_required',
      lead,
    };
  }

  let nextLead = lead;

  if (preview.sellerInsightText) {
    nextLead = appendSellerInsightToLead(nextLead, preview.sellerInsightText, {
      context: 'other',
    });
  }

  if (preview.needProfilePatch && Object.keys(preview.needProfilePatch).length) {
    const { patch, rejectedKeys } = sanitizeNeedProfilePatch(preview.needProfilePatch);
    if (rejectedKeys.length) {
      return { ok: false, error: `rejected_fields:${rejectedKeys.join(',')}`, lead: nextLead };
    }
    const needProfile = applyNeedProfilePatch(nextLead?.crm?.needProfile ?? {}, patch);
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead?.crm ?? {}),
        needProfile,
      },
    };
  }

  if (preview.noteText) {
    const existing = nextLead?.crm?.kundenhelfer?.conversationNotes ?? '';
    const notes = [existing, preview.noteText].filter(Boolean).join('\n');
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead?.crm ?? {}),
        kundenhelfer: {
          ...(nextLead?.crm?.kundenhelfer ?? {}),
          conversationNotes: notes,
        },
      },
    };
  }

  return { ok: true, lead: nextLead, preview };
}
