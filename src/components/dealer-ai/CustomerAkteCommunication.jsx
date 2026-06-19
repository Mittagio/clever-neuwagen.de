import { formatHistoryWhen } from '../../services/dealerAiLeadCrm.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import './CustomerAkte.css';

function formatRelativeContactWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return `Heute · ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Gestern · ${time}`;
  return formatHistoryWhen(iso);
}

export default function CustomerAkteCommunication({
  history = [],
  onOpenHistory,
}) {
  const latest = history[0];
  if (!latest) return null;

  return (
    <section className="cust-akte-comm" aria-labelledby="cust-akte-comm-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-comm-title" className="cust-akte-section__title">Kommunikation</h2>
        {history.length > 1 && onOpenHistory && (
          <button type="button" className="cust-akte-section__link" onClick={onOpenHistory}>
            Verlauf
          </button>
        )}
      </div>

      <div className="cust-akte-comm__latest">
        <p className="cust-akte-comm__label">Letzter Kontakt</p>
        <p className="cust-akte-comm__when">{formatRelativeContactWhen(latest.at)}</p>
        <p className="cust-akte-comm__text">{polishHistoryText(latest.text)}</p>
      </div>
    </section>
  );
}
