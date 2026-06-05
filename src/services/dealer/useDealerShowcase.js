import { useEffect, useMemo, useState } from 'react';
import { computeSalesAdvisorResults } from '../sales/salesAdvisorService.js';
import { resolveSalesAdvisorSearch } from '../advisor/advisorSearchClient.js';

/**
 * Händler-Showcase: Modelllinien aus Berater-Backend (Single Source of Truth).
 */
export function useDealerShowcase({ dealerSlug, limit = 12, chipIds = [] } = {}) {
  const localResult = useMemo(
    () => computeSalesAdvisorResults(chipIds, { limit, dealerSlug }),
    [chipIds, limit, dealerSlug],
  );

  const [remoteResult, setRemoteResult] = useState(null);
  const [source, setSource] = useState('local');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    resolveSalesAdvisorSearch(
      { chipIds, options: { limit, dealerSlug } },
      { chipIds, limit, dealerSlug },
    ).then((result) => {
      if (cancelled) return;
      setRemoteResult(result);
      setSource(result.source ?? 'server');
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setRemoteResult(null);
      setSource('local');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [chipIds, limit, dealerSlug]);

  const result = remoteResult ?? localResult;

  return {
    modelLineGroups: result.modelLineGroups ?? [],
    matches: result.matches ?? [],
    source,
    loading,
  };
}
