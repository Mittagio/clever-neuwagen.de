import { useMemo } from 'react';
import { getRecentCustomerRecords } from '../../services/crm/customerSearchService.js';

function RecentCustomerCard({ result, onOpen }) {
  return (
    <button
      type="button"
      className="backend-home__recent-card"
      onClick={() => onOpen?.(result.leadId)}
    >
      <p className="backend-home__recent-name">{result.customerName}</p>
      <p className="backend-home__recent-vehicle">{result.vehicleLabel}</p>
      <div className="backend-home__recent-meta">
        <span className="backend-home__recent-status">{result.statusLabel}</span>
        {result.lastActivityLabel && (
          <span className="backend-home__recent-activity">{result.lastActivityLabel}</span>
        )}
      </div>
    </button>
  );
}

export default function BackendRecentCustomers({ leads = [], onOpenCustomerRecord }) {
  const recentRecords = useMemo(
    () => getRecentCustomerRecords(leads),
    [leads],
  );

  if (!recentRecords.length) return null;

  return (
    <section className="backend-home__section backend-home__recent" aria-labelledby="recent-heading">
      <h3 id="recent-heading" className="backend-home__section-title">
        Zuletzt geöffnet
      </h3>
      <div className="backend-home__recent-list">
        {recentRecords.map((result) => (
          <RecentCustomerCard
            key={result.leadId}
            result={result}
            onOpen={onOpenCustomerRecord}
          />
        ))}
      </div>
    </section>
  );
}
