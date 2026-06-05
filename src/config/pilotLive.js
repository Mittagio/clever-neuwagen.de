/**
 * Pilot LIVE – Autohaus Trinkle + nur Kia + echte Leads (keine Demo-Seeds)
 *
 * Aktivieren: VITE_PILOT_LIVE=true in .env.local
 * Dev: npm run dev:pilot
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const PILOT_LIVE = env?.VITE_PILOT_LIVE === 'true';

export const PILOT_DEALER_ID = env?.VITE_PILOT_DEALER_ID || 'autohaus-trinkle';

export const PILOT_KIA_ONLY = env?.VITE_PILOT_KIA_ONLY !== 'false';

export function isPilotLiveMode() {
  return PILOT_LIVE;
}
