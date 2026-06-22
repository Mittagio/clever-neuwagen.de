import { useState } from 'react';
import { formatHistoryWhen } from '../../services/dealerAiLeadCrm.js';
import { getHistoryEntryCount, sortHistoryNewestFirst } from '../../services/customerAkteHistory.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import './CustomerAkte.css';

export default function CustomerAkteActivities({
  history = [],
  onOpenHistory,
}) {
  const [expanded, setExpanded] = useState(false);
  const count = getHistoryEntryCount(history);
  const items = sortHistoryNewestFirst(history);

  if (!count) return null;

  function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
  }

  return (
    <section className="cust-akte-activities cust-akte-summary" aria-labelledby="cust-akte-activities-title">
      <button
        type="button"
        className="cust-akte-summary__row"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <span className="cust-akte-summary__main">
          <span id="cust-akte-activities-title" className="cust-akte-summary__title">Aktivitäten</span>
          <span className="cust-akte-summary__line">
            {count} {count === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </span>
        <span className="cust-akte-summary__cta">{expanded ? 'Weniger ›' : 'Alle anzeigen ›'}</span>
      </button>

      {expanded && (
        <div className="cust-akte-activities__panel">
          <ul className="cust-akte-activities__list">
            {items.map((entry) => (
              <li key={entry.id} className="cust-akte-activities__item">
                <span className="cust-akte-activities__when">{formatHistoryWhen(entry.at)}</span>
                <span className="cust-akte-activities__text">{polishHistoryText(entry.text)}</span>
              </li>
            ))}
          </ul>
          {onOpenHistory && (
            <button type="button" className="cust-akte-activities__sheet-link" onClick={onOpenHistory}>
              Im Verlauf öffnen
            </button>
          )}
        </div>
      )}
    </section>
  );
}
