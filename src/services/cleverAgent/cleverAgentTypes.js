/**
 * Clever Agent – gemeinsame Typen / Konstanten.
 */

export const CLEVER_AGENT_TOOL_KIND = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  EXTERNAL: 'external',
});

export const CLEVER_AGENT_MAX_TOOL_ROUNDS = 8;

export const CLEVER_AGENT_DEFAULT_MODEL = 'gpt-4.1';

/** @typedef {'read'|'write'|'external'} CleverAgentToolKind */

/**
 * @typedef {object} CleverAgentArtifact
 * @property {string} type
 * @property {string} [offerId]
 * @property {string} [label]
 * @property {object} [data]
 */

/**
 * @typedef {object} CleverAgentSuggestedAction
 * @property {string} action
 * @property {string} label
 */

/**
 * @typedef {object} CleverAgentMutation
 * @property {string} type
 * @property {object} [leadPatch]
 * @property {object} [offer]
 * @property {string} [messageDraft]
 * @property {object} [portfolio]
 */

/**
 * @typedef {object} CleverAgentResult
 * @property {boolean} ok
 * @property {string} message
 * @property {CleverAgentArtifact[]} artifacts
 * @property {CleverAgentSuggestedAction[]} suggestedActions
 * @property {CleverAgentMutation[]} mutations
 * @property {object|null} [debug]
 * @property {string|null} [error]
 * @property {string|null} [fallbackReason]
 */
