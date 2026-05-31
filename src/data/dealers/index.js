import { autohausTrinkleSeed, AUTOHAUS_TRINKLE_ID } from './autohausTrinkle.js';

export const DEALER_REGISTRY = {
  [AUTOHAUS_TRINKLE_ID]: {
    id: AUTOHAUS_TRINKLE_ID,
    slug: AUTOHAUS_TRINKLE_ID,
    seed: autohausTrinkleSeed,
  },
};

export const DEFAULT_DEALER_ID = AUTOHAUS_TRINKLE_ID;

export function getDealerSeed(dealerId = DEFAULT_DEALER_ID) {
  return DEALER_REGISTRY[dealerId]?.seed ?? autohausTrinkleSeed;
}

export { AUTOHAUS_TRINKLE_ID, autohausTrinkleSeed };
