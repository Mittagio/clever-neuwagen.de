/**
 * Shared Clever Intelligence – Feature-Flags und Oberflächen-Config.
 */
import { getCleverAiConfig } from '../openai/cleverConversationConfig.js';

export const CLEVER_SURFACES = {
  CUSTOMER: 'customer_conversation',
  LEXICON: 'lexicon',
  SELLER: 'seller_dashboard',
};

/**
 * @param {string} surface
 * @param {object} [env]
 */
export function getCleverIntelligenceConfig(surface, env = process.env) {
  const base = getCleverAiConfig(env);
  const surfaceEnabled = {
    [CLEVER_SURFACES.CUSTOMER]: env.CLEVER_AI_CONVERSATION_ENABLED === 'true',
    [CLEVER_SURFACES.LEXICON]: env.CLEVER_LEXICON_AI_ENABLED === 'true',
    [CLEVER_SURFACES.SELLER]: env.CLEVER_SELLER_COPILOT_ENABLED === 'true',
  }[surface] === true;

  return {
    ...base,
    surface,
    surfaceEnabled,
    enabled: surfaceEnabled && Boolean(base.apiKey),
  };
}

export function isCleverLexiconAiEnabled(env = process.env) {
  return getCleverIntelligenceConfig(CLEVER_SURFACES.LEXICON, env).enabled;
}

export function isCleverSellerCopilotEnabled(env = process.env) {
  return getCleverIntelligenceConfig(CLEVER_SURFACES.SELLER, env).enabled;
}
