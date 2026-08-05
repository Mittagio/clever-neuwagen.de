import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  buildCleverInboxItems,
  filterCleverInboxItems,
} from '../../services/crm/cleverEingangItems.js';
import './NewInquiriesQueue.css';

function stopAndNavigate(event, navigate, href) {
  event.preventDefault();
  event.stopPropagation();
  if (href) navigate(href);
}

export default function NewInquiriesQueuePage() {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const [query, setQuery] = useState('');

  const { items, summary } = useMemo(
    () => buildCleverInboxItems(leads),
    [leads],
  );

  const visibleItems = useMemo(
    () => filterCleverInboxItems(items, query),
    [items, query],
  );

  return (
    <div className="new-inq">
      <header className="new-inq__header">
        <Link to="/backend" className="new-inq__back" aria-label="Zurück zur Startseite">
          ←
        </Link>
        <div className="new-inq__header-text">
          <h1 className="new-inq__title">Clever Eingang</h1>
          <p className="new-inq__sub">
            Clever hat neue Kundeninformationen erkannt und für dich vorbereitet.
          </p>
          <p className="new-inq__summary" aria-live="polite">
            {summary.line}
          </p>
        </div>
      </header>

      {items.length > 0 && (
        <div className="new-inq__toolbar">
          <label className="new-inq__search-label" htmlFor="clever-eingang-search">
            Suche
          </label>
          <input
            id="clever-eingang-search"
            className="new-inq__search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, Fahrzeug, Quelle…"
            autoComplete="off"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="new-inq__empty">
          <p>Sobald Clever neue Anfragen, Notizen oder Dokumente erkennt, erscheinen sie hier als Arbeitsqueue.</p>
          <Link to="/verkaufsassistent" className="new-inq__cta">
            Verkaufsassistent öffnen
          </Link>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="new-inq__empty">
          <p>Keine Vorgänge passen zur Suche.</p>
        </div>
      ) : (
        <ul className="new-inq__list">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <article
                className={`new-inq__card new-inq__card--${item.status}${item.isUnread ? ' is-unread' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(item.nextAction.href)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(item.nextAction.href);
                  }
                }}
                aria-label={`${item.title}: ${item.nextAction.label}`}
              >
                <div className="new-inq__card-top">
                  <div className="new-inq__title-row">
                    {item.isUnread && (
                      <span className="new-inq__unread" title="Ungelesen" aria-label="Ungelesen" />
                    )}
                    <h2 className="new-inq__name">{item.title}</h2>
                  </div>
                  <span className={`new-inq__status new-inq__status--${item.status}`}>
                    {item.statusLabel}
                  </span>
                </div>

                <p className="new-inq__vehicle">{item.vehicleLabel}</p>

                <p className="new-inq__meta">
                  <span>{item.sourceLabel}</span>
                  {item.relativeTime ? (
                    <>
                      <span className="new-inq__meta-sep" aria-hidden="true">·</span>
                      <time dateTime={item.createdAt || undefined}>{item.relativeTime}</time>
                    </>
                  ) : null}
                </p>

                {item.contextHint && (
                  <p className="new-inq__hint">{item.contextHint}</p>
                )}

                <button
                  type="button"
                  className="new-inq__action"
                  onClick={(event) => stopAndNavigate(event, navigate, item.nextAction.href)}
                >
                  {item.nextAction.label}
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}

      <footer className="new-inq__footer">
        <Link to="/backend/verkaufschancen" className="new-inq__all">
          Alle Verkaufschancen
        </Link>
      </footer>
    </div>
  );
}
