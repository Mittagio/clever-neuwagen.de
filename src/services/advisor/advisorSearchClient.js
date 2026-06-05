/**
 * Berater-Suche: Backend bevorzugt, lokale Pipeline als Fallback.
 */

import { matchAndRankDiscoveryFull } from '../search/discoveryAdvisorSearch.js';
import { computeSalesAdvisorResults } from '../sales/salesAdvisorService.js';
import {
  fetchAdvisorDiscoverySearch,
  fetchSalesAdvisorSearch,
  isAdvisorServerAvailable,
} from './advisorApi.js';

let serverAvailableCache = null;
let serverCheckedAt = 0;
const SERVER_CHECK_MS = 30_000;

async function useServerApi() {
  const now = Date.now();
  if (serverAvailableCache != null && now - serverCheckedAt < SERVER_CHECK_MS) {
    return serverAvailableCache;
  }
  serverAvailableCache = await isAdvisorServerAvailable();
  serverCheckedAt = now;
  return serverAvailableCache;
}

export async function resolveDiscoverySearch(localParams, apiPayload) {
  if (await useServerApi()) {
    try {
      const remote = await fetchAdvisorDiscoverySearch(apiPayload);
      return { ...remote, source: 'server' };
    } catch {
      serverAvailableCache = false;
    }
  }

  const local = matchAndRankDiscoveryFull(localParams);
  return { ...local, source: 'local' };
}

export async function resolveSalesAdvisorSearch(localParams, apiPayload) {
  if (await useServerApi()) {
    try {
      const remote = await fetchSalesAdvisorSearch(apiPayload);
      return { ...remote, source: 'server' };
    } catch {
      serverAvailableCache = false;
    }
  }

  const local = computeSalesAdvisorResults(localParams.chipIds, localParams.options);
  return { ...local, source: 'local' };
}

export function invalidateAdvisorServerCache() {
  serverAvailableCache = null;
  serverCheckedAt = 0;
}
