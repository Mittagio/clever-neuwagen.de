/**
 * Verkäufer-/Backend-App-Routen (ohne klassischen Website-Footer)
 */
const DEALER_APP_PREFIXES = [
  '/backend',
  '/verkaufsassistent',
  '/dealer-ai',
  '/communication',
  '/selbstauskunft',
];

const DEALER_APP_EXACT = new Set([
  '/offers',
  '/templates',
  '/sales',
  '/sales/smart',
  '/gespraech',
  '/dashboard',
]);

export function isDealerAppRoute(pathname = '') {
  const path = String(pathname).split('?')[0].split('#')[0];
  if (DEALER_APP_EXACT.has(path)) return true;
  return DEALER_APP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function getSiteFooterVariant(pathname = '') {
  return isDealerAppRoute(pathname) ? 'minimal' : 'full';
}
