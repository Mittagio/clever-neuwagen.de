import { formatHistoryWhen } from '../../services/dealerAiLeadCrm.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import './CustomerAkte.css';

export default function CustomerAkteActivities({
  history = [],
  onOpenHistory,
}) {
  const items = history.slice(0, 4);
  if (!items.length) return null;

  return (
    <section className="cust-akte-activities" aria-labelledby="cust-akte-activities-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-activities-title" className="cust-akte-section__title">Aktivitäten</h2>
        {history.length > items.length && onOpenHistory && (
          <button type="button" className="cust-akte-section__link" onClick={onOpenHistory}>
            Alle
          </button>
        )}
      </div>
      <ul className="cust-akte-activities__list">
        {items.map((entry) => (
          <li key={entry.id} className="cust-akte-activities__item">
            <span className="cust-akte-activities__when">{formatHistoryWhen(entry.at)}</span>
            <span className="cust-akte-activities__text">{polishHistoryText(entry.text)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
