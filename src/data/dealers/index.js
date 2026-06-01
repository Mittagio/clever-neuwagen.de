import { autohausTrinkleSeed, AUTOHAUS_TRINKLE_ID } from './autohausTrinkle.js';
import { autohausMuellerSeed, AUTOHAUS_MUELLER_ID } from './autohausMueller.js';

export const DEALER_REGISTRY = {
  [AUTOHAUS_TRINKLE_ID]: {
    id: AUTOHAUS_TRINKLE_ID,
    slug: AUTOHAUS_TRINKLE_ID,
    subdomain: 'autohaus-trinkle.clever-neuwagen.de',
    seed: autohausTrinkleSeed,
  },
  [AUTOHAUS_MUELLER_ID]: {
    id: AUTOHAUS_MUELLER_ID,
    slug: AUTOHAUS_MUELLER_ID,
    subdomain: 'autohaus-mueller.clever-neuwagen.de',
    seed: autohausMuellerSeed,
  },
};

export const DEFAULT_DEALER_ID = AUTOHAUS_TRINKLE_ID;

export function getDealerSeed(dealerId = DEFAULT_DEALER_ID) {
  return DEALER_REGISTRY[dealerId]?.seed ?? autohausTrinkleSeed;
}

export function getDealerRegistryEntry(dealerId) {
  return DEALER_REGISTRY[dealerId] ?? null;
}

export function listDealerRegistry() {
  return Object.values(DEALER_REGISTRY);
}

export { AUTOHAUS_TRINKLE_ID, autohausTrinkleSeed, AUTOHAUS_MUELLER_ID, autohausMuellerSeed };
