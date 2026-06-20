/**
 * Pilot LIVE – Autohaus Trinkle + nur Kia + echte Leads (keine Demo-Seeds)
 *
 * Aktivieren: VITE_PILOT_LIVE=true in .env.local
 * Dev: npm run dev:pilot
 *
 * Vite (Browser): import.meta.env · Node (Server): process.env
 */

const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

function readFlag(name, fallback = undefined) {
  if (viteEnv[name] != null && viteEnv[name] !== '') return viteEnv[name];
  if (typeof process !== 'undefined' && process.env?.[name] != null) return process.env[name];
  return fallback;
}

export const PILOT_LIVE = readFlag('VITE_PILOT_LIVE') === 'true';

export const PILOT_DEALER_ID = readFlag('VITE_PILOT_DEALER_ID', 'autohaus-trinkle');

export const PILOT_KIA_ONLY = readFlag('VITE_PILOT_KIA_ONLY', 'true') !== 'false';

export function isPilotLiveMode() {
  return PILOT_LIVE;
}
