import { useCallback, useEffect, useState } from 'react';
import {
  ignoreLearningRequest,
  LEARNING_REQUEST_STATUSES,
  listLearningRequests,
  markLearningRequestResolved,
  updateLearningRequestStatus,
} from '../../services/admin/cleverLearningRequestService.js';
import './CleverLearningRequestsAdmin.css';

const STATUS_LABELS = {
  open: 'Offen',
  in_review: 'In Prüfung',
  resolved: 'Erledigt',
  ignored: 'Ignoriert',
};

const SOURCE_LABELS = {
  lexicon: 'Clever-Lexikon',
  customer_equipment_search: 'Kunden-Ausstattungssuche',
  dealer_equipment_search: 'Ausstattung prüfen',
  configurator: 'Konfigurator',
  customer_akte: 'Kundenakte',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function CleverLearningRequestsAdmin() {
  const [filter, setFilter] = useState('open');
  const [items, setItems] = useState([]);

  const reload = useCallback(() => {
    const list = filter === 'all'
      ? listLearningRequests()
      : listLearningRequests({ status: filter });
    setItems(list);
  }, [filter]);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener('clever-learning-requests-changed', onChange);
    return () => window.removeEventListener('clever-learning-requests-changed', onChange);
  }, [reload]);

  function handleStatus(id, status) {
    if (status === LEARNING_REQUEST_STATUSES.RESOLVED) {
      markLearningRequestResolved(id);
    } else if (status === LEARNING_REQUEST_STATUSES.IGNORED) {
      ignoreLearningRequest(id);
    } else {
      updateLearningRequestStatus(id, status);
    }
    reload();
  }

  return (
    <div className="clr-admin">
      <header className="clr-admin__head">
        <p className="clr-admin__kicker">Clever verbessern</p>
        <h1 className="clr-admin__title">Offene Clever-Fragen</h1>
        <p className="clr-admin__lead">
          Verkäufer-Feedback aus Lexikon und Ausstattungssuche – zur Datenverbesserung.
        </p>
      </header>

      <div className="clr-admin__filters" role="tablist" aria-label="Statusfilter">
        {[
          { id: 'open', label: 'Offen' },
          { id: 'in_review', label: 'In Prüfung' },
          { id: 'resolved', label: 'Erledigt' },
          { id: 'ignored', label: 'Ignoriert' },
          { id: 'all', label: 'Alle' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`clr-admin__filter${filter === tab.id ? ' clr-admin__filter--active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p className="clr-admin__empty">Keine Einträge für diesen Filter.</p>
      )}

      <ul className="clr-admin__list">
        {items.map((item) => (
          <li key={item.id} className="clr-admin__item">
            <div className="clr-admin__item-main">
              <p className="clr-admin__query">{item.query}</p>
              <p className="clr-admin__meta">
                {item.modelLabel ?? item.modelKey ?? 'Modell unbekannt'}
                {' · '}
                {SOURCE_LABELS[item.sourceArea] ?? item.sourceArea ?? '—'}
                {' · '}
                <span className={`clr-admin__status clr-admin__status--${item.status}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </p>
              <p className="clr-admin__counts">
                Häufigkeit: {item.existingRequestCount ?? 1}
                {' · '}
                Zuletzt: {formatWhen(item.lastReportedAt ?? item.createdAt)}
              </p>
              {item.suggestedGlobalFeatureIds?.length > 0 && (
                <p className="clr-admin__candidates">
                  Feature-Kandidaten: {item.suggestedGlobalFeatureIds.join(', ')}
                </p>
              )}
            </div>
            <div className="clr-admin__actions">
              {item.status === LEARNING_REQUEST_STATUSES.OPEN && (
                <button
                  type="button"
                  className="clr-admin__btn"
                  onClick={() => handleStatus(item.id, LEARNING_REQUEST_STATUSES.IN_REVIEW)}
                >
                  In Prüfung
                </button>
              )}
              {item.status !== LEARNING_REQUEST_STATUSES.RESOLVED && (
                <button
                  type="button"
                  className="clr-admin__btn clr-admin__btn--ok"
                  onClick={() => handleStatus(item.id, LEARNING_REQUEST_STATUSES.RESOLVED)}
                >
                  Erledigt
                </button>
              )}
              {item.status !== LEARNING_REQUEST_STATUSES.IGNORED && (
                <button
                  type="button"
                  className="clr-admin__btn clr-admin__btn--muted"
                  onClick={() => handleStatus(item.id, LEARNING_REQUEST_STATUSES.IGNORED)}
                >
                  Ignorieren
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
