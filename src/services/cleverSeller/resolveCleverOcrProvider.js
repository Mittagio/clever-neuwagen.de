/**
 * Slice 17/19: Feature-Flag + Auflösung des OCR-Providers für Composer/Akte.
 * Default ohne Flag → null (Manual-Fallback). Mit Flag → Tesseract bzw. Cloud-Hook.
 */
import {
  createCleverContractOcrProvider,
  createCloudOcrEnginePlaceholder,
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
 * Engine-Wahl: tesseract (Default) | cloud
 * @param {object} [env]
 * @returns {'tesseract'|'cloud'}
 */
export function resolveCleverOcrEnginePreference(env = typeof import.meta !== 'undefined' ? import.meta.env : {}) {
  const raw = String(
    env?.VITE_CLEVER_CONTRACT_OCR_ENGINE
    ?? env?.CLEVER_CONTRACT_OCR_ENGINE
    ?? 'tesseract',
  ).trim().toLowerCase();
  if (raw === 'cloud') return 'cloud';
  return 'tesseract';
}

/**
 * @param {object} [env]
 * @returns {string}
 */
export function resolveCleverOcrLang(env = typeof import.meta !== 'undefined' ? import.meta.env : {}) {
  const raw = env?.VITE_CLEVER_CONTRACT_OCR_LANG ?? env?.CLEVER_CONTRACT_OCR_LANG ?? 'deu';
  return String(raw).trim() || 'deu';
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
 *   createWorker?: Function,
 *   importTesseract?: () => Promise<object>,
 *   renderPages?: Function,
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

  if (options.engine !== undefined) {
    return createCleverContractOcrProvider({
      engine: options.engine,
      renderPages: options.renderPages,
    });
  }

  const preference = resolveCleverOcrEnginePreference(options.env);
  if (preference === 'cloud') {
    // Keine eingebaute Cloud-API – voller Provider muss via window.__cleverOcrProvider kommen.
    // (window-Hook hat oben bereits Vorrang; hier nur klarer Fehler.)
    return createCleverContractOcrProvider({
      engine: createCloudOcrEnginePlaceholder(),
      renderPages: options.renderPages,
    });
  }

  const engine = await tryCreateTesseractOcrEngine({
    lang: resolveCleverOcrLang(options.env),
    createWorker: options.createWorker,
    importTesseract: options.importTesseract,
  });
  if (!engine) {
    // Flag an, aber keine Engine → Provider der klar fehlschlägt (kein Fake-Text)
    return createCleverContractOcrProvider({
      engine: null,
      renderPages: options.renderPages,
    });
  }
  return createCleverContractOcrProvider({
    engine,
    renderPages: options.renderPages,
  });
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
