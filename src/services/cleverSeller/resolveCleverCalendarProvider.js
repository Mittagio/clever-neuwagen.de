/**
 * Feature-Flag + Auflösung des Kalender-Providers (analog OCR).
 * Default ohne Flag → null (availabilityStatus: not_checked).
 * Mit Flag → Local-Stub; mit window.__cleverCalendarProvider → Hook (Vorrang).
 */
import {
  createLocalCleverCalendarStub,
  normalizeCleverCalendarProvider,
} from './createCleverCalendarProvider.js';

/**
 * @param {object} [env]
 * @returns {boolean}
 */
export function isCleverCalendarEnabled(env = typeof import.meta !== 'undefined' ? import.meta.env : {}) {
  const raw = env?.VITE_CLEVER_CALENDAR ?? env?.CLEVER_CALENDAR ?? '';
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

/**
 * Liefert den aktiven Kalender-Provider oder null.
 * Vorrang: window.__cleverCalendarProvider → Local-Stub (nur mit Flag).
 *
 * @param {{
 *   env?: object,
 *   force?: boolean,
 *   windowRef?: object|null,
 *   stubOptions?: object,
 *   provider?: object|Function|null,
 * }} [options]
 * @returns {object|null} Provider mit checkAvailability / createDraftEvent
 */
export function resolveCleverCalendarProvider(options = {}) {
  if (options.provider !== undefined) {
    return normalizeCleverCalendarProvider(options.provider);
  }

  const win = options.windowRef
    ?? (typeof window !== 'undefined' ? window : null);
  if (win?.__cleverCalendarProvider) {
    const fromWindow = normalizeCleverCalendarProvider(win.__cleverCalendarProvider);
    if (fromWindow) return fromWindow;
  }

  const enabled = options.force === true || isCleverCalendarEnabled(options.env);
  if (!enabled) return null;

  return createLocalCleverCalendarStub(options.stubOptions || {});
}

/**
 * Registriert den Default-Provider einmalig an window (Browser).
 * @param {object} [options]
 * @returns {object|null}
 */
export function ensureCleverCalendarProviderRegistered(options = {}) {
  const win = options.windowRef
    ?? (typeof window !== 'undefined' ? window : null);
  if (!win) return null;
  if (win.__cleverCalendarProvider) {
    return normalizeCleverCalendarProvider(win.__cleverCalendarProvider);
  }
  const provider = resolveCleverCalendarProvider({
    ...options,
    windowRef: win,
  });
  if (provider) {
    win.__cleverCalendarProvider = provider;
  }
  return provider;
}
