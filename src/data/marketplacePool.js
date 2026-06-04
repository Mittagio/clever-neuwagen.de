import { MARKETPLACE_VEHICLES } from './marketplaceVehicles.js';
import { getKiaMarketplaceVehicles } from './kia/kiaPartnerHub.js';
import { PILOT_DEALER_ID, PILOT_KIA_ONLY, PILOT_LIVE } from '../config/pilotLive.js';

/**
 * Kunden-Marktplatz-Pool: im Pilot nur Kia @ Autohaus Trinkle.
 */
export function getMarketplaceVehiclePool(source = MARKETPLACE_VEHICLES) {
  if (!PILOT_LIVE) return source;

  let pool = source;
  if (PILOT_KIA_ONLY) {
    pool = getKiaMarketplaceVehicles(pool);
  }
  if (PILOT_DEALER_ID) {
    pool = pool.filter(
      (v) => (v.dealerSlug ?? PILOT_DEALER_ID) === PILOT_DEALER_ID,
    );
  }
  return pool;
}

export { MARKETPLACE_VEHICLES };
