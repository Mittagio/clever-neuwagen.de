import { useEffect, useState } from 'react';
import './EquipmentDataInspector.css';

function MetaItem({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="eq-inspector-meta__item">
      <span className="eq-inspector-meta__label">{label}</span>
      <span className="eq-inspector-meta__value">{value}</span>
    </div>
  );
}

function KiaSyncToneBadge({ tone, label }) {
  return (
    <span className={`eq-inspector-sync-badge eq-inspector-sync-badge--${tone ?? 'neutral'}`}>
      {label}
    </span>
  );
}

export default function KiaTechnicalSyncPanel({ title = 'Kia Preislisten-Abgleich' }) {
  const [syncState, setSyncState] = useState({ loading: true, running: false, error: null, report: null });

  async function loadReport() {
    setSyncState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/v1/admin/technical-sync/kia');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Report nicht verfügbar');
      setSyncState({ loading: false, running: false, error: null, report: data.report });
    } catch (err) {
      setSyncState({
        loading: false,
        running: false,
        error: err instanceof Error ? err.message : 'Fehler beim Laden',
        report: null,
      });
    }
  }

  async function runSync() {
    setSyncState((prev) => ({ ...prev, running: true, error: null }));
    try {
      const res = await fetch('/api/v1/admin/technical-sync/kia/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offline: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Sync fehlgeschlagen');
      setSyncState({ loading: false, running: false, error: null, report: data.report });
    } catch (err) {
      setSyncState((prev) => ({
        ...prev,
        running: false,
        error: err instanceof Error ? err.message : 'Sync fehlgeschlagen',
      }));
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const report = syncState.report;
  const summary = report?.summary;

  return (
    <section className="eq-inspector-card" aria-label={title}>
      <div className="eq-inspector-card__head">
        <div>
          <h2 className="eq-inspector-card__title">{title}</h2>
          <p className="eq-inspector-muted">
            Offizielle kia.com-PDFs laden, Anhängelast extrahieren und mit der Registry vergleichen.
          </p>
        </div>
        <div className="eq-inspector-sync__actions">
          <button
            type="button"
            className="eq-inspector-btn eq-inspector-btn--ghost"
            onClick={() => loadReport()}
            disabled={syncState.loading || syncState.running}
          >
            Aktualisieren
          </button>
          <button
            type="button"
            className="eq-inspector-btn"
            onClick={() => runSync()}
            disabled={syncState.running}
          >
            {syncState.running ? 'Läuft…' : 'Online abgleichen'}
          </button>
        </div>
      </div>

      {syncState.error && (
        <p className="eq-inspector-error" role="alert">{syncState.error}</p>
      )}

      {syncState.loading && !report && (
        <p className="eq-inspector-empty">Abgleich wird geladen…</p>
      )}

      {report && (
        <>
          <div className="eq-inspector-sync__summary">
            <KiaSyncToneBadge tone={report.tone} label={report.headline} />
            {report.generatedAt && (
              <span className="eq-inspector-muted">
                Stand: {new Date(report.generatedAt).toLocaleString('de-DE')}
              </span>
            )}
          </div>

          {summary && (
            <div className="eq-inspector-sync__stats">
              <MetaItem label="Abgeglichen" value={summary.ok} />
              <MetaItem label="Abweichung" value={summary.mismatch} />
              <MetaItem label="Fehlend" value={summary.missing} />
              <MetaItem label="Quelle geändert" value={summary.sourceChanged} />
              <MetaItem label="Ohne Profil" value={summary.pendingProfiles} />
            </div>
          )}

          <ul className="eq-inspector-sync-list">
            {(report.rows ?? []).map((row) => (
              <li key={row.modelKey} className="eq-inspector-sync-list__item">
                <div className="eq-inspector-sync-list__main">
                  <strong>{row.model}</strong>
                  <code>{row.modelKey}</code>
                  <KiaSyncToneBadge tone={row.uiTone} label={row.statusLabel} />
                  {row.sourceChanged && (
                    <span className="eq-inspector-hint">PDF auf kia.com geändert</span>
                  )}
                </div>
                <div className="eq-inspector-muted">
                  PDF: [{row.extractedBrakedKg.join(', ') || '–'}] kg · Profil: [{row.profileBrakedKg.join(', ') || '–'}] kg
                </div>
                {row.downloadUrl && (
                  <a href={row.downloadUrl} target="_blank" rel="noopener noreferrer" className="eq-inspector-link">
                    Offizielle Preisliste
                  </a>
                )}
              </li>
            ))}
          </ul>

          {(report.pending ?? []).length > 0 && (
            <div className="eq-inspector-sync__pending">
              <h3 className="eq-inspector-card__subtitle">Noch ohne geprüftes Profil</h3>
              <ul className="eq-inspector-list">
                {report.pending.map((item) => (
                  <li key={item.modelKey}>
                    <strong>{item.model}</strong>
                    <span className="eq-inspector-muted">{item.note}</span>
                    {item.downloadUrl && (
                      <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer" className="eq-inspector-link">
                        PDF öffnen
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
