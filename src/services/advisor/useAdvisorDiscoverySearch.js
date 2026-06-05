import { useEffect, useMemo, useState } from 'react';
import { matchAndRankDiscoveryFull } from '../search/discoveryAdvisorSearch.js';
import { resolveDiscoverySearch } from './advisorSearchClient.js';
import { PILOT_DEALER_ID } from '../../config/pilotLive.js';

/**
 * Discovery-Suche mit Backend-Sync (Berater + Kunde sehen dieselben Ergebnisse).
 */
export function useAdvisorDiscoverySearch({
  wishes,
  filters,
  vehicles,
  getDisplayRate,
  limit = 30,
  chipIds = [],
  dealerSlug = PILOT_DEALER_ID,
  enabled = true,
}) {
  const localResult = useMemo(
    () => matchAndRankDiscoveryFull({
      wishes,
      vehicles,
      filters,
      getDisplayRate,
      limit,
      chipIds,
    }),
    [wishes, vehicles, filters, getDisplayRate, limit, chipIds],
  );

  const [remoteResult, setRemoteResult] = useState(null);
  const [source, setSource] = useState('local');

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    resolveDiscoverySearch(
      { wishes, vehicles, filters, getDisplayRate, limit, chipIds },
      {
        query: filters?.query ?? wishes?.rawQuery ?? '',
        filters,
        wishes,
        chipIds,
        dealerSlug,
        limit,
      },
    ).then((result) => {
      if (cancelled) return;
      setRemoteResult(result);
      setSource(result.source ?? 'local');
    }).catch(() => {
      if (!cancelled) {
        setRemoteResult(null);
        setSource('local');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, wishes, vehicles, filters, getDisplayRate, limit, chipIds, dealerSlug]);

  const discoverySearch = remoteResult ?? localResult;

  return { discoverySearch, source, localResult, remoteResult };
}
