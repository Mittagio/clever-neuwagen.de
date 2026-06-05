/**
 * Fahrzeugdetail: Backend-Slug als Single Source of Truth, lokaler Pool als Fallback.
 */

import { getMarketplaceVehiclePool } from '../../data/marketplacePool.js';
import { PILOT_DEALER_ID } from '../../config/pilotLive.js';
import { fetchAdvisorVehicle, isAdvisorServerAvailable } from './advisorApi.js';

let serverAvailableCache = null;
let serverCheckedAt = 0;
const SERVER_CHECK_MS = 30_000;

async function preferServerApi() {
  const now = Date.now();
  if (serverAvailableCache != null && now - serverCheckedAt < SERVER_CHECK_MS) {
    return serverAvailableCache;
  }
  serverAvailableCache = await isAdvisorServerAvailable();
  serverCheckedAt = now;
  return serverAvailableCache;
}

function findLocalVehicle(slug) {
  if (!slug) return null;
  return getMarketplaceVehiclePool().find((item) => item.slug === slug) ?? null;
}

function listingFromMatch(match) {
  if (!match) return null;
  const v = match.vehicle ?? {};
  return {
    ...v,
    slug: match.slug ?? v.slug,
    title: v.title ?? match.title,
    monthlyRate: match.monthlyRate ?? v.monthlyRate,
    financeRate: match.financeRate ?? v.financeRate,
    cashPrice: match.cashPrice ?? v.cashPrice,
    deliveryTime: match.deliveryTime ?? v.deliveryTime,
    availability: match.availability ?? v.availability,
    discountPercent: match.discountPercent ?? v.discountPercent ?? 0,
  };
}

/**
 * @returns {Promise<{ vehicle: object|null, match: object|null, source: 'server'|'local'|'none' }>}
 */
export async function resolveVehicleBySlug(slug, dealerSlug = PILOT_DEALER_ID, context = {}) {
  if (!slug) {
    return { vehicle: null, match: null, source: 'none' };
  }

  if (await preferServerApi()) {
    try {
      const remote = await fetchAdvisorVehicle(slug, dealerSlug, context);
      const vehicle = remote.vehicle ?? listingFromMatch(remote.match);
      if (vehicle) {
        return {
          vehicle,
          match: remote.match ?? null,
          source: 'server',
        };
      }
    } catch {
      serverAvailableCache = false;
    }
  }

  const local = findLocalVehicle(slug);
  return {
    vehicle: local,
    match: null,
    source: local ? 'local' : 'none',
  };
}

export function invalidateVehicleServerCache() {
  serverAvailableCache = null;
  serverCheckedAt = 0;
}
