import {
  formatHistoryEntry,
  getModelChangeHistory,
} from '../../services/dealer/dealerChangeHistory.js';
import './DealerVehicleManagement.css';

export default function DealerModelChangeHistory({ conditions, modelId }) {
  const entries = getModelChangeHistory(conditions, modelId, 15)
    .map(formatHistoryEntry);

  if (!entries.length) {
    return (
      <p className="dvm-empty">Noch keine Änderungen protokolliert.</p>
    );
  }

  return (
    <ul className="dvm-history">
      {entries.map((entry) => (
        <li key={entry.id} className="dvm-history__item">
          <time className="dvm-history__time" dateTime={entry.at}>{entry.when}</time>
          <p className="dvm-history__summary">{entry.summary}</p>
          <p className="dvm-history__meta">
            {entry.actor}
            {entry.actorRole && ` · ${entry.actorRole}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
