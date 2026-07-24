import { useEffect, useState } from 'react';
import { matchViewport, BREAKPOINTS } from './responsiveBreakpoints.js';

/**
 * Shared viewport tier for responsive composition (not business branching).
 */
export function useViewportTier() {
  const [tier, setTier] = useState(() => (
    typeof window === 'undefined' ? 'mobile' : matchViewport(window.innerWidth)
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const update = () => setTier(matchViewport(window.innerWidth));
    update();

    const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.desktop}px)`);
    const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINTS.tablet}px)`);
    const mqWide = window.matchMedia(`(min-width: ${BREAKPOINTS.wide}px)`);

    mqDesktop.addEventListener?.('change', update);
    mqTablet.addEventListener?.('change', update);
    mqWide.addEventListener?.('change', update);
    window.addEventListener('resize', update);

    return () => {
      mqDesktop.removeEventListener?.('change', update);
      mqTablet.removeEventListener?.('change', update);
      mqWide.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return {
    tier,
    isMobile: tier === 'mobile',
    isTablet: tier === 'tablet',
    isDesktop: tier === 'desktop' || tier === 'wide',
    isWide: tier === 'wide',
  };
}
