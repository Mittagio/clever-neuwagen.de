/**
 * Slice 17: Feature-Flag + Auflösung des OCR-Providers für Composer/Akte.
 */
import {
  createCleverContractOcrProvider,
  tryCreateTesseractOcrEngine,
} from './createCleverContractOcrProvider.js';

/**
 * @param {object} [env]
 * @returns {boolean}
 */
export function isCleverContractOcrEnabled(env = typeof import.meta !== 'undefined' ? import.meta.env : {}) {
  const raw = env?.VITE_CLEVER_CONTRACT_OCR ?? env?.CLEVER_CONTRACT_OCR ?? '';
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

/**
 * Liefert den aktiven OCR-Provider oder null.
 * Vorrang: window.__cleverOcrProvider → Default-Provider (Flag + Engine).
 *
 * @param {{
 *   env?: object,
 *   force?: boolean,
 *   engine?: object|null,
 *   windowRef?: object|null,
 * }} [options]
 * @returns {Promise<null|Function>}
 */
export async function resolveCleverOcrProvider(options = {}) {
  const win = options.windowRef
    ?? (typeof window !== 'undefined' ? window : null);
  if (win && typeof win.__cleverOcrProvider === 'function') {
    return win.__cleverOcrProvider;
  }

  const enabled = options.force === true || isCleverContractOcrEnabled(options.env);
  if (!enabled) return null;

  const engine = options.engine !== undefined
    ? options.engine
    : await tryCreateTesseractOcrEngine();
  if (!engine) {
    // Flag an, aber keine Engine → Provider der klar fehlschlägt (kein Fake-Text)
    return createCleverContractOcrProvider({ engine: null });
  }
  return createCleverContractOcrProvider({ engine });
}

/**
 * Registriert den Default-Provider einmalig an window (Browser).
 * @param {object} [options]
 * @returns {Promise<Function|null>}
 */
export async function ensureCleverOcrProviderRegistered(options = {}) {
  const win = options.windowRef
    ?? (typeof window !== 'undefined' ? window : null);
  if (!win) return null;
  if (typeof win.__cleverOcrProvider === 'function') {
    return win.__cleverOcrProvider;
  }
  const provider = await resolveCleverOcrProvider({
    ...options,
    windowRef: win,
  });
  if (provider) {
    win.__cleverOcrProvider = provider;
  }
  return provider;
}
