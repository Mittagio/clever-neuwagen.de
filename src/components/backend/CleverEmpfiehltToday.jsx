import { Link } from 'react-router-dom';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CleverEmpfiehltToday.css';

export default function CleverEmpfiehltToday({ items = [] }) {
  if (!items.length) {
    return (
      <section className="clever-today" aria-labelledby="clever-today-title">
        <h2 id="clever-today-title" className="clever-today__title">Clever empfiehlt heute</h2>
        <p className="clever-today__empty">Aktuell keine priorisierten Empfehlungen – neue Anfragen erscheinen hier.</p>
      </section>
    );
  }

  return (
    <section className="clever-today" aria-labelledby="clever-today-title">
      <div className="clever-today__head">
        <h2 id="clever-today-title" className="clever-today__title">Clever empfiehlt heute</h2>
        <p className="clever-today__sub">Von oben nach unten – die wichtigsten Abschlüsse zuerst.</p>
      </div>

      <ol className="clever-today__list">
        {items.map((item, index) => (
          <li key={item.leadId}>
            <Link to={buildKundenaktePath(item.leadId)} className="clever-today__card">
              <span className="clever-today__rank" aria-hidden>{index + 1}</span>
              <div className="clever-today__body">
                <div className="clever-today__row">
                  <span className="clever-today__stars" aria-label={`${item.stars} von 5 Sternen`}>
                    {item.starLabel}
                  </span>
                  <span className="clever-today__chance">{item.closureChance} %</span>
                </div>
                <p className="clever-today__name">{item.customerName}</p>
                <p className="clever-today__action">{item.headline}</p>
                {item.whySummary ? (
                  <p className="clever-today__why">{item.whySummary}</p>
                ) : null}
              </div>
              <span className="clever-today__chevron" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
