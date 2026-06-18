/**
 * Interne Testumgebung – Kennzeichnung, SEO-Ausschluss, Warnungen bei Kundenlinks.
 *
 * Aktivieren: VITE_INTERNAL_TEST_ENV=true in .env.local oder beim Build
 * Dev: npm run dev:test
 * Build: npm run build:test
 *
 * Hinweis: Direkt import.meta.env nutzen, damit Vite Flags beim Build einbettet.
 */

export const INTERNAL_TEST_ENV = import.meta.env.VITE_INTERNAL_TEST_ENV === 'true';

export const INTERNAL_TEST_BADGE_LABEL = 'Interne Testversion';

export function isInternalTestEnv() {
  return INTERNAL_TEST_ENV;
}
