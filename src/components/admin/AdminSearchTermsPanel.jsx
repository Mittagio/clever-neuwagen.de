import { useMemo, useState } from 'react';
import {
  getUnknownSearchTerms,
  approveUnknownTerm,
  dismissUnknownTerm,
} from '../../services/search/unknownTermsLog.js';
import './AdminSearchTermsPanel.css';

export default function AdminSearchTermsPanel() {
  const [tick, setTick] = useState(0);
  const pending = useMemo(() => getUnknownSearchTerms({ status: 'pending' }), [tick]);

  function refresh() {
    setTick((n) => n + 1);
  }

  function handleApprove(entry) {
    if (!entry.suggestedId) return;
    approveUnknownTerm(entry.id, {
      featureId: entry.suggestedId,
      label: entry.suggestedLabel,
    });
    refresh();
  }

  function handleDismiss(id) {
    dismissUnknownTerm(id);
    refresh();
  }

  if (!pending.length) {
    return (
      <section className="admin-search-terms card">
        <h2>Suchbegriffe prüfen</h2>
        <p className="admin-search-terms__empty">
          Keine neuen Begriffe zur Prüfung. Sobald Nutzer Tippfehler eingeben, erscheinen Vorschläge hier.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-search-terms card" aria-label="Neue Suchbegriffe">
      <h2>Neue Suchbegriffe prüfen</h2>
      <p className="admin-search-terms__sub">
        Häufige Tippfehler aus der Suche – nach Bestätigung dauerhaft im Synonym-Katalog nutzbar.
      </p>
      <ul className="admin-search-terms__list">
        {pending.map((entry) => (
          <li key={entry.id} className="admin-search-terms__item">
            <div className="admin-search-terms__main">
              <strong>{entry.raw}</strong>
              {entry.suggestedLabel && (
                <span>→ {entry.suggestedLabel}</span>
              )}
              <span className="admin-search-terms__meta">
                {entry.count}× gesucht · {entry.confidence === 'medium' ? 'Vorschlag' : 'Unbekannt'}
              </span>
            </div>
            <div className="admin-search-terms__actions">
              {entry.suggestedId && (
                <button type="button" onClick={() => handleApprove(entry)}>
                  Übernehmen
                </button>
              )}
              <button type="button" className="admin-search-terms__dismiss" onClick={() => handleDismiss(entry.id)}>
                Ignorieren
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
