import { getCommunicationSummary } from '../../services/customerAkteHistory.js';
import './CustomerAkte.css';

export default function CustomerAkteCommunication({
  history = [],
  onOpenHistory,
}) {
  const summary = getCommunicationSummary(history);
  if (!summary) return null;

  return (
    <section className="cust-akte-comm cust-akte-summary" aria-labelledby="cust-akte-comm-title">
      <button
        type="button"
        className="cust-akte-summary__row"
        onClick={onOpenHistory}
        disabled={!onOpenHistory}
      >
        <span className="cust-akte-summary__main">
          <span id="cust-akte-comm-title" className="cust-akte-summary__title">Kommunikation</span>
          <span className="cust-akte-summary__line">{summary.line}</span>
        </span>
        {onOpenHistory && (
          <span className="cust-akte-summary__cta">Verlauf anzeigen ›</span>
        )}
      </button>
    </section>
  );
}
