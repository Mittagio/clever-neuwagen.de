/**
 * Feature-Flag: Screenshot/WhatsApp-Bilder im Composer inhaltlich interpretieren.
 *
 * CLEVER_SCREENSHOT_INTERPRET_ENABLED / VITE_…:
 * - true/1 → an
 * - false/0 → aus (nur Soft-Attach)
 * - unset → Default an, wenn OpenAI-Interpret ODER Contract-OCR aktiv
 */
import { isCleverSellerOpenAiInterpretEnabled } from './cleverSellerOrchestratorConfig.js';
import { isCleverContractOcrEnabled } from './resolveCleverOcrProvider.js';

function resolveEnv(env) {
  if (env) return env;
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

function flagRaw(env) {
  return env?.CLEVER_SCREENSHOT_INTERPRET_ENABLED
    ?? env?.VITE_CLEVER_SCREENSHOT_INTERPRET_ENABLED
    ?? '';
}

/**
 * @param {object} [env]
 * @returns {boolean}
 */
export function isCleverScreenshotInterpretEnabled(env) {
  const resolved = resolveEnv(env);
  const raw = String(flagRaw(resolved) ?? '').trim();
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  return isCleverSellerOpenAiInterpretEnabled(resolved)
    || isCleverContractOcrEnabled(resolved);
}

/**
 * Browser-Client (Vite): kein OPENAI_API_KEY nötig – Server-Route bzw. OCR.
 * @param {object} [env]
 * @returns {boolean}
 */
export function isCleverScreenshotInterpretClientEnabled(
  env = typeof import.meta !== 'undefined' ? import.meta.env : {},
) {
  const raw = String(
    env?.VITE_CLEVER_SCREENSHOT_INTERPRET_ENABLED
    ?? env?.CLEVER_SCREENSHOT_INTERPRET_ENABLED
    ?? '',
  ).trim();
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  const openAi = env?.VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === 'true'
    || env?.VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === '1';
  return openAi || isCleverContractOcrEnabled(env);
}
