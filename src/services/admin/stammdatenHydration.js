/**
 * Stammdaten vom Server laden und lokal cachen (Admin + Dealer).
 */
import {
  fetchOpenCustomerQuestions,
  fetchStammdatenOverrides,
  putStammdatenOverridesApi,
} from './stammdatenApi.js';
import { setOpenQuestionsCache } from './openCustomerQuestionsService.js';
import { setStammdatenOverridesCache } from './vehicleStammdatenOverrideService.js';

let hydratePromise = null;

/**
 * Server-Daten laden; bei Erfolg lokalen Cache überschreiben.
 * Bei Fehler: lokaler Cache bleibt aktiv.
 */
export function hydrateStammdatenFromServer() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const [overrides, openItems] = await Promise.all([
        fetchStammdatenOverrides(),
        fetchOpenCustomerQuestions(),
      ]);

      setStammdatenOverridesCache(overrides);
      setOpenQuestionsCache(openItems);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clever-stammdaten-overrides-changed'));
        window.dispatchEvent(new CustomEvent('clever-open-questions-changed'));
      }

      return { ok: true, overrides, openItems };
    } catch (err) {
      console.warn('[stammdatenHydration] Server nicht erreichbar, nutze lokalen Cache.', err.message);
      return { ok: false, error: err.message };
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

/**
 * Lokale Overrides zum Server hochladen (Merge auf Server via einzelne Patches nicht nötig – PUT ersetzt).
 */
export async function syncLocalOverridesToServer(localOverrides) {
  return putStammdatenOverridesApi(localOverrides);
}
