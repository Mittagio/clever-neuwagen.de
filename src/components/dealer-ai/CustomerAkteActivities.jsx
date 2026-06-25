import { getActivityDashboard } from '../../services/customerActivityTimeline.js';
import './CustomerAkte.css';

export default function CustomerAkteActivities({
  history = [],
  lastSeenAt = null,
  onOpenHistory,
}) {
  const dashboard = getActivityDashboard(history, lastSeenAt);

  if (!dashboard.total) return null;

  return (
    <section className="cust-akte-activities cust-akte-compact-row cust-akte-tier-3" aria-labelledby="cust-akte-activities-title">
      <div className="cust-akte-compact-row__main">
        <span id="cust-akte-activities-title" className="cust-akte-compact-row__title">Aktivitäten</span>
        <span className="cust-akte-compact-row__meta">
          {dashboard.total}
          {' '}
          {dashboard.total === 1 ? 'Aktivität' : 'Aktivitäten'}
        </span>
      </div>
      {onOpenHistory && (
        <button type="button" className="cust-akte-compact-row__action" onClick={onOpenHistory}>
          Alle anzeigen
        </button>
      )}
    </section>
  );
}
