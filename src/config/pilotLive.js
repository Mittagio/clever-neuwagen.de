/**
 * Pilot LIVE – Autohaus Trinkle + nur Kia + echte Leads (keine Demo-Seeds)
 *
 * Aktivieren: VITE_PILOT_LIVE=true in .env.local
 * Dev: npm run dev:pilot
 *
 * Hinweis: Direkt import.meta.env nutzen, damit Vite Flags beim Build einbettet.
 */

export const PILOT_LIVE = import.meta.env.VITE_PILOT_LIVE === 'true';

export const PILOT_DEALER_ID = import.meta.env.VITE_PILOT_DEALER_ID || 'autohaus-trinkle';

export const PILOT_KIA_ONLY = import.meta.env.VITE_PILOT_KIA_ONLY !== 'false';

export function isPilotLiveMode() {
  return PILOT_LIVE;
}
