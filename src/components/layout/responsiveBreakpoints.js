/**
 * JS mirror of CSS breakpoint tokens (src/styles/variables.css).
 * Use for layout composition hooks – never for duplicating business logic.
 */
export const BREAKPOINTS = {
  mobileMax: 767,
  tablet: 768,
  desktop: 1100,
  wide: 1440,
  phoneColumn: 480,
  sm: 640,
  md: 768,
  lg: 1024,
};

export const CONTENT_WIDTH = {
  reading: 720,
  workspace: 1200,
  wide: 1400,
  phone: 480,
  sidebarContext: 260,
  sidebarAssistant: 300,
  sidebarNav: 72,
};

/** Page types from Clever Responsive Product Law */
export const PAGE_TYPES = {
  conversational: 'A',
  intake: 'B',
  offerPrep: 'C',
  offerRoom: 'D',
  documents: 'E',
  admin: 'F',
  publicDealer: 'public',
};

export function matchViewport(width = typeof window !== 'undefined' ? window.innerWidth : 390) {
  const w = Number(width) || 0;
  if (w >= BREAKPOINTS.wide) return 'wide';
  if (w >= BREAKPOINTS.desktop) return 'desktop';
  if (w >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export function isDesktopViewport(width) {
  const tier = matchViewport(width);
  return tier === 'desktop' || tier === 'wide';
}

export function isTabletOrUp(width) {
  return matchViewport(width) !== 'mobile';
}
