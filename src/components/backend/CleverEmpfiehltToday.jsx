import { Link } from 'react-router-dom';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CleverEmpfiehltToday.css';

function isTelHref(href) {
  return Boolean(href && /^tel:/i.test(String(href)));
}

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
          const aktePath = buildKundenaktePath(item.leadId);
          const callHref = isTelHref(item.ctaHref) ? item.ctaHref : null;
          return (
            <li key={item.leadId} className="clever-today__card">
              <span className="clever-today__rank" aria-hidden>{index + 1}</span>
              <div className="clever-today__body">
                <div className="clever-today__row">
                  <Link to={aktePath} className="clever-today__name-link">
                    <p className="clever-today__name">{item.customerName}</p>
                  </Link>
                  {item.dueTodayBadge ? (
                    <span className="clever-today__due-badge">{item.dueTodayBadge}</span>
                  ) : null}
                </div>
                {why ? (
                  <Link to={aktePath} className="clever-today__why-link">
                    <p className="clever-today__why">{why}</p>
                  </Link>
                ) : null}
                {callHref ? (
                  <a href={callHref} className="clever-today__action clever-today__action--cta">
                    {cta}
                  </a>
                ) : (
                  <Link to={aktePath} className="clever-today__action clever-today__action--cta">
                    {cta}
                  </Link>
                )}
              </div>
              <Link
                to={aktePath}
                className="clever-today__chevron"
                aria-label={`${item.customerName} öffnen`}
              >
                →
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
