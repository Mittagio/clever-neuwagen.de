import { Link } from 'react-router-dom';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CleverEmpfiehltToday.css';

export default function CleverEmpfiehltToday({ items = [] }) {
  if (!items.length) {
    return (
      <section className="clever-today" aria-labelledby="clever-today-title">
        <h2 id="clever-today-title" className="clever-today__title">Clever empfiehlt heute</h2>
        <p className="clever-today__empty">Aktuell keine offenen Aufgaben – neue Anfragen erscheinen hier.</p>
      </section>
    );
  }

  return (
    <section className="clever-today" aria-labelledby="clever-today-title">
      <div className="clever-today__head">
        <h2 id="clever-today-title" className="clever-today__title">Clever empfiehlt heute</h2>
        <p className="clever-today__sub">Von oben nach unten – die wichtigste Arbeit zuerst.</p>
      </div>

      <ol className="clever-today__list">
        {items.map((item, index) => {
          const why = item.whySummary || '';
          const cta = item.ctaLabel || item.headline || 'Öffnen und erledigen';
          return (
            <li key={item.leadId}>
              <Link to={buildKundenaktePath(item.leadId)} className="clever-today__card">
                <span className="clever-today__rank" aria-hidden>{index + 1}</span>
                <div className="clever-today__body">
                  <div className="clever-today__row">
                    <p className="clever-today__name">{item.customerName}</p>
                    {item.dueTodayBadge ? (
                      <span className="clever-today__due-badge">{item.dueTodayBadge}</span>
                    ) : null}
                  </div>
                  {why ? <p className="clever-today__why">{why}</p> : null}
                  <p className="clever-today__action">{cta}</p>
                </div>
                <span className="clever-today__chevron" aria-hidden>→</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
