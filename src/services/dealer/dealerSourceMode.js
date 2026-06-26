/**
 * Herkunft der Kundenanfrage – Beratung (oben) vs. bekanntes Modell (unten).
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

export const SOURCE_MODES = {
  ADVISOR: 'advisor_mode',
  KNOWN_MODEL: 'known_model_mode',
};

/** @typedef {typeof SOURCE_MODES[keyof typeof SOURCE_MODES]|null} SourceMode */

/**
 * @param {'clever'|'classic'|null|undefined} entryMode
 * @returns {SourceMode}
 */
export function resolveSourceModeFromEntry(entryMode) {
  if (entryMode === 'classic') return SOURCE_MODES.KNOWN_MODEL;
  if (entryMode === 'clever') return SOURCE_MODES.ADVISOR;
  return null;
}

/**
 * @param {object} params
 * @param {'clever'|'classic'|null|undefined} params.entryMode
 * @param {boolean} [params.isClassicEntry]
 * @param {boolean} [params.isCleverEntry]
 * @param {boolean} [params.hasSearch]
 * @param {string|null} [params.modelKey]
 */
export function resolveLeadSourceMode({
  entryMode = null,
  isClassicEntry = false,
  isCleverEntry = false,
  hasSearch = false,
  modelKey = null,
} = {}) {
  if (isClassicEntry || entryMode === 'classic') {
    return {
      sourceMode: SOURCE_MODES.KNOWN_MODEL,
      sourceModelKey: modelKey ?? null,
    };
  }
  if (isCleverEntry || entryMode === 'clever' || hasSearch) {
    return {
      sourceMode: SOURCE_MODES.ADVISOR,
      sourceModelKey: null,
    };
  }
  return { sourceMode: null, sourceModelKey: null };
}

/**
 * @param {string} modelKey
 */
export function resolveModelDisplayLabel(modelKey) {
  if (!modelKey) return '';
  const key = String(modelKey).toLowerCase();
  return KIA_MODEL_ATTRIBUTES[key]?.label ?? key.toUpperCase();
}

/**
 * @param {object} lead
 */
export function getLeadSourceMode(lead = {}) {
  return lead?.crm?.sourceMode ?? null;
}

/**
 * @param {object} lead
 * @returns {string|null}
 */
export function getSourceModeChipLabel(lead = {}) {
  const mode = getLeadSourceMode(lead);
  if (!mode) return null;

  if (mode === SOURCE_MODES.ADVISOR) {
    return 'kam über Beratung';
  }

  if (mode === SOURCE_MODES.KNOWN_MODEL) {
    const modelKey = lead?.crm?.sourceModelKey ?? lead?.inquiryBrief?.recommended?.modelKey ?? null;
    const label = resolveModelDisplayLabel(modelKey);
    return label ? `${label} gezielt angefragt` : 'Modell gezielt angefragt';
  }

  return null;
}

/**
 * @param {object} params
 */
export function buildCrmSourceModePatch({
  entryMode = null,
  isClassicEntry = false,
  isCleverEntry = false,
  hasSearch = false,
  modelKey = null,
} = {}) {
  const { sourceMode, sourceModelKey } = resolveLeadSourceMode({
    entryMode,
    isClassicEntry,
    isCleverEntry,
    hasSearch,
    modelKey,
  });
  if (!sourceMode) return {};
  return {
    sourceMode,
    sourceModelKey: sourceModelKey ?? null,
  };
}
