import {
  getActivityDashboard,
  getLastCustomerActivityHint,
} from '../../services/customerActivityTimeline.js';
import './CustomerAkte.css';

export default function CustomerAkteActivityHint({
  history = [],
  lastSeenAt = null,
  onOpenActivities,
}) {
  const hint = getLastCustomerActivityHint(history);
  if (!hint) return null;

  const dashboard = getActivityDashboard(history, lastSeenAt);

  return (
    <section className="cust-akte-activity-hint" aria-label="Letzte Kundenaktivität">
      <p className="cust-akte-activity-hint__eyebrow">🔥 Letzte Kundenaktivität</p>
      <p className="cust-akte-activity-hint__text">{hint}</p>
      {dashboard.hasUnread && (
        <p className="cust-akte-activity-hint__meta">
          {dashboard.newCustomerActivities} neue Kundenaktivität{dashboard.newCustomerActivities === 1 ? '' : 'en'}
        </p>
      )}
      {onOpenActivities && (
        <button type="button" className="cust-akte-activity-hint__btn" onClick={onOpenActivities}>
          Aktivitäten öffnen
        </button>
      )}
    </section>
  );
}
