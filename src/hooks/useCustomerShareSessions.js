import { useEffect, useMemo, useState } from 'react';
import { fetchCustomerShareSessions } from '../services/advisor/advisorApi.js';
import { readCachedShareSession } from '../services/sales/salesShareService.js';
import { dedupeShareSessions } from '../services/customer/customerShareAccountService.js';

/**
 * Lädt Berater-Vergleichslinks für das Kundenkonto (Server + lokal verknüpfte Tokens).
 */
export function useCustomerShareSessions(email, linkedShareTokens = []) {
  const [remoteSessions, setRemoteSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      setRemoteSessions([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    fetchCustomerShareSessions(email)
      .then((sessions) => {
        if (!cancelled) setRemoteSessions(sessions ?? []);
      })
      .catch(() => {
        if (!cancelled) setRemoteSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  const sessions = useMemo(() => {
    const localFromTokens = (linkedShareTokens ?? [])
      .map((token) => readCachedShareSession(token))
      .filter(Boolean);

    return dedupeShareSessions([...remoteSessions, ...localFromTokens]);
  }, [remoteSessions, linkedShareTokens]);

  return { sessions, loading };
}
