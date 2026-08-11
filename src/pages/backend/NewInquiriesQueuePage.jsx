import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  CLEVER_EINGANG_STATUS,
  buildCleverInboxItems,
  filterCleverInboxItems,
} from '../../services/crm/cleverEingangItems.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './NewInquiriesQueue.css';

const STATUS_QUERY_IDS = new Set([
  'all',
  CLEVER_EINGANG_STATUS.REVIEW,
  CLEVER_EINGANG_STATUS.DUPLICATE,
  CLEVER_EINGANG_STATUS.READY,
  CLEVER_EINGANG_STATUS.INCOMPLETE,
  CLEVER_EINGANG_STATUS.ASSIGNED,
]);

function normalizeStatusQuery(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'all';
  if (STATUS_QUERY_IDS.has(value)) return value;
  return 'all';
}

const VISITED_STORAGE_KEY = 'clever-eingang-visited';

function loadVisitedIds() {
  try {
    const raw = localStorage.getItem(VISITED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistVisitedIds(ids) {
  try {
    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

function itemLooksVisited(item, visited) {
  if (visited.has(String(item.id))) return true;
  return (item.memberLeadIds || []).some((id) => visited.has(String(id)));
}

function buildRowMeta(item) {
  const parts = [];
  if (item.vehicleLabel) parts.push(item.vehicleLabel);
  if (item.sourceLabel) parts.push(item.sourceLabel);
  return parts.join(' - ');
}

function StatIcon({ icon }) {
  switch (icon) {
    case 'search':
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'people':
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="7" cy="7" r="2.4" fill="currentColor" />
          <circle cx="13.2" cy="7.4" r="2" fill="currentColor" opacity="0.85" />
          <path d="M2.8 15.2c.6-2.2 2.3-3.4 4.2-3.4s3.6 1.2 4.2 3.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M11.2 12.2c1.1-.5 2.3-.6 3.4.1 1 .7 1.6 1.8 1.8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M6.4 10.2 8.8 12.6 13.6 7.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M10 2.8 17.4 16H2.6L10 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M10 7.6v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="14.1" r="0.9" fill="currentColor" />
        </svg>
      );
    case 'inbox':
    default:
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M3.2 5.2h13.6v9.6H3.2V5.2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M3.4 11.2h3.2c.5 1.7 1.6 2.6 3.4 2.6s2.9-.9 3.4-2.6h3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

function FactIcon({ icon }) {
  switch (icon) {
    case 'document':
      return (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path d="M6 3.5h5.2L15 7.3V16.5H6V3.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11.2 3.6V7.4H15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <rect x="3.5" y="4.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.5 8.2h13M7 2.8v3.2M13 2.8v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'gear':
      return (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 3.4v1.6M10 15v1.6M3.4 10h1.6M15 10h1.6M5.3 5.3l1.1 1.1M13.6 13.6l1.1 1.1M14.7 5.3l-1.1 1.1M6.4 13.6l-1.1 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'money':
      return (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <circle cx="10" cy="10" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6.2v7.6M12.2 7.8c-.5-.7-1.2-1-2.2-1s-1.8.4-1.8 1.3c0 1.8 4 1 4 3 0 1-.8 1.5-2.2 1.5-1.1 0-1.9-.4-2.4-1.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'vehicle':
    default:
      return (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path d="M3.5 11.2 5 7.2c.3-.8 1-1.3 1.8-1.3h6.4c.8 0 1.5.5 1.8 1.3l1.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 11.2h14v3.2H3v-3.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="6.2" cy="14.4" r="1" fill="currentColor" />
          <circle cx="13.8" cy="14.4" r="1" fill="currentColor" />
        </svg>
      );
  }
}

export default function NewInquiriesQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { leads, updateLead } = useLeads();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => (
    normalizeStatusQuery(searchParams.get('status'))
  ));
  const [visitedIds, setVisitedIds] = useState(() => loadVisitedIds());
  const [selectedId, setSelectedId] = useState(null);

  const setStatusFilterAndUrl = useCallback((nextStatus) => {
    const normalized = normalizeStatusQuery(nextStatus);
    setStatusFilter(normalized);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (!normalized || normalized === 'all') params.delete('status');
      else params.set('status', normalized);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    setStatusFilter(normalizeStatusQuery(searchParams.get('status')));
  }, [searchParams]);

  const { items, summary } = useMemo(
    () => buildCleverInboxItems(leads),
    [leads],
  );

  const visibleItems = useMemo(
    () => filterCleverInboxItems(items, query, statusFilter),
    [items, query, statusFilter],
  );

  useEffect(() => {
    if (visibleItems.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && visibleItems.some((item) => item.id === prev)) return prev;
      return visibleItems[0].id;
    });
  }, [visibleItems]);

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedId) || null,
    [visibleItems, selectedId],
  );

  const markVisited = useCallback((item) => {
    setVisitedIds((prev) => {
      const next = new Set(prev);
      next.add(String(item.id));
      for (const leadId of item.memberLeadIds || []) {
        next.add(String(leadId));
      }
      persistVisitedIds(next);
      return next;
    });
  }, []);

  const openItemAction = useCallback((item, href) => {
    markVisited(item);
    if (href) navigate(href);
  }, [markVisited, navigate]);

  const handleSelectRow = useCallback((item) => {
    setSelectedId(item.id);
    markVisited(item);
  }, [markVisited]);

  const handleCreateAkte = useCallback((item) => {
    if (!item?.leadId) return;
    openItemAction(item, buildKundenaktePath(item.leadId));
  }, [openItemAction]);

  const handleDiscard = useCallback((item) => {
    if (!item) return;
    const ids = item.memberLeadIds?.length ? item.memberLeadIds : [item.leadId];
    for (const id of ids) {
      if (id) updateLead(id, { status: 'verloren' });
    }
  }, [updateLead]);

  return (
    <div className="new-inq new-inq--worklist">
      <header className="new-inq__header">
        <Link to="/backend" className="new-inq__back" aria-label="Zurück zur Startseite">
          ←
        </Link>
        <div className="new-inq__header-text">
          <h1 className="new-inq__title">Clever Eingang</h1>
        </div>
      </header>

      {items.length > 0 && (
        <>
          <div className="new-inq__stats" aria-label="Übersicht">
            {(summary.stats || []).map((stat) => (
              <div
                key={stat.id}
                className={`new-inq__stat new-inq__stat--${stat.tone || 'lavender'}`}
              >
                <span className="new-inq__stat-icon" aria-hidden="true">
                  <StatIcon icon={stat.icon} />
                </span>
                <span className="new-inq__stat-text">
                  <strong className="new-inq__stat-count">{stat.count}</strong>
                  {' '}
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <div className="new-inq__toolbar">
            <label className="new-inq__search-label" htmlFor="clever-eingang-search">
              Suche
            </label>
            <div className="new-inq__search-wrap">
              <span className="new-inq__search-icon" aria-hidden="true">
                <StatIcon icon="search" />
              </span>
              <input
                id="clever-eingang-search"
                className="new-inq__search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, Fahrzeug, Quelle..."
                autoComplete="off"
              />
            </div>
          </div>

          <div className="new-inq__filters" role="toolbar" aria-label="Vorgänge filtern">
            {summary.filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`new-inq__filter${statusFilter === filter.id ? ' is-active' : ''}`}
                aria-pressed={statusFilter === filter.id}
                onClick={() => setStatusFilterAndUrl(filter.id)}
              >
                <span className="new-inq__filter-label">{filter.label}</span>
                <span className="new-inq__filter-count">{filter.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {items.length === 0 ? (
        <div className="new-inq__empty">
          <p>Sobald Clever neue Anfragen, Notizen oder Dokumente erkennt, erscheinen sie hier als Arbeitsliste.</p>
          <Link to="/verkaufsassistent" className="new-inq__cta">
            Verkaufsassistent öffnen
          </Link>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="new-inq__empty">
          <p>Keine Vorgänge passen zum Filter oder zur Suche.</p>
        </div>
      ) : (
        <div className="new-inq__workspace">
          <section className="new-inq__list-pane" aria-label="Arbeitsliste">
            {summary.groupHint ? (
              <p className="new-inq__group-hint" aria-live="polite">
                {summary.groupHint}
              </p>
            ) : null}
            <ul className="new-inq__list new-inq__list--rows">
              {visibleItems.map((item) => {
                const isUnread = item.isUnread && !itemLooksVisited(item, visitedIds);
                const needsAttention = Boolean(item.needsAttention);
                const metaLine = buildRowMeta(item);
                const isSelected = selectedItem?.id === item.id;
                return (
                  <li key={item.id}>
                    <article
                      className={[
                        'new-inq__row',
                        `new-inq__row--${item.status}`,
                        needsAttention ? 'new-inq__row--attention' : 'new-inq__row--quiet',
                        item.isGroup ? 'new-inq__row--group' : '',
                        isUnread ? 'is-unread' : '',
                        isSelected ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      role="button"
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() => handleSelectRow(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectRow(item);
                        }
                      }}
                      aria-label={`${item.title}: ${item.statusLabel}. ${item.nextAction.label}`}
                    >
                      <span
                        className={`new-inq__dot new-inq__dot--${item.status}`}
                        title={item.statusLabel}
                        aria-hidden="true"
                      />
                      <div className="new-inq__row-body">
                        <div className="new-inq__row-main">
                          <h2 className="new-inq__name">
                            {isUnread && (
                              <span className="new-inq__unread-mark" title="Ungelesen" aria-label="Ungelesen" />
                            )}
                            {item.title}
                          </h2>
                          {metaLine ? (
                            <p className="new-inq__meta">{metaLine}</p>
                          ) : null}
                          {item.contextHint ? (
                            <p className="new-inq__hint">{item.contextHint}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={`new-inq__action-link${needsAttention ? ' new-inq__action-link--attention' : ''}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openItemAction(item, item.nextAction.href);
                          }}
                        >
                          {item.nextAction.label}
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside
            className={`new-inq__detail${selectedItem ? ' is-open' : ''}`}
            aria-label="Ausgewählter Vorgang"
          >
            {selectedItem ? (
              <div className="new-inq__detail-card">
                <p className="new-inq__detail-label">Ausgewählter Vorgang</p>
                <h2 className="new-inq__detail-name">{selectedItem.displayName || selectedItem.title}</h2>
                {selectedItem.memberCountLabel ? (
                  <p className="new-inq__detail-count">{selectedItem.memberCountLabel}</p>
                ) : null}

                <div className="new-inq__detail-section">
                  <h3 className="new-inq__detail-section-title">Erkannte Angaben</h3>
                  {(selectedItem.recognizedFacts || []).length > 0 ? (
                    <ul className="new-inq__fact-grid">
                      {selectedItem.recognizedFacts.map((fact) => (
                        <li key={fact.id} className="new-inq__fact-chip">
                          <span className="new-inq__fact-icon" aria-hidden="true">
                            <FactIcon icon={fact.icon} />
                          </span>
                          <span className="new-inq__fact-label">{fact.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="new-inq__fact-empty">Noch keine strukturierten Angaben erkannt.</p>
                  )}
                </div>

                {selectedItem.detailBanner ? (
                  <div className="new-inq__detail-banner" role="status">
                    <span className="new-inq__detail-banner-icon" aria-hidden="true">i</span>
                    <p>{selectedItem.detailBanner}</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="new-inq__detail-primary"
                  onClick={() => openItemAction(selectedItem, selectedItem.nextAction.href)}
                >
                  {selectedItem.nextAction.label}
                </button>

                <div className="new-inq__detail-secondary">
                  <button
                    type="button"
                    className="new-inq__detail-secondary-btn"
                    onClick={() => handleCreateAkte(selectedItem)}
                  >
                    <span className="new-inq__detail-secondary-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" width="15" height="15">
                        <path d="M3.5 5.2h5l1.4 1.5H16.5v8.1H3.5V5.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Neue Akte anlegen
                  </button>
                  <button
                    type="button"
                    className="new-inq__detail-secondary-btn new-inq__detail-secondary-btn--danger"
                    onClick={() => handleDiscard(selectedItem)}
                  >
                    <span className="new-inq__detail-secondary-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" width="15" height="15">
                        <path d="M5 6.2h10M8 6.2V4.8h4v1.4M6.4 6.2l.7 9h5.8l.7-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Verwerfen
                  </button>
                </div>

                {summary.groupHint ? (
                  <p className="new-inq__detail-footer">{summary.groupHint}</p>
                ) : null}
              </div>
            ) : (
              <div className="new-inq__detail-card new-inq__detail-card--empty">
                <p>Wähle einen Vorgang aus der Liste.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      <footer className="new-inq__footer">
        <Link to="/backend/verkaufschancen" className="new-inq__all">
          Alle Verkaufschancen
        </Link>
      </footer>
    </div>
  );
}
