import { useEffect, useState } from 'react';
import { loadCustomerRecords } from './customerRecordService.js';
import { PILOT_DEALER_ID } from '../../config/pilotLive.js';

/**
 * Kundenakten vom Server synchronisieren (Verkäufer-Übersicht).
 */
export function useCustomerRecordsSync(dealerId = PILOT_DEALER_ID, enabled = true) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function sync() {
      const next = await loadCustomerRecords(20, dealerId);
      if (!cancelled) {
        setRecords(next);
        setLoading(false);
      }
    }

    sync();
    const timer = setInterval(sync, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dealerId, enabled]);

  return { records, loading };
}
