import './IntelligenceComponents.css';

export function PeriodTabs({ periods, active, onChange }) {
  return (
    <div className="intel-period" role="tablist" aria-label="Zeitraum">
      {periods.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={active === p.id}
          className={`intel-period__btn${active === p.id ? ' is-active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`intel-card ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="intel-card__head">
          {title && <h2 className="intel-card__title">{title}</h2>}
          {subtitle && <p className="intel-card__sub">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiStrip({ items }) {
  return (
    <div className="intel-kpis">
      {items.map((item) => (
        <article key={item.label} className={`intel-kpi${item.accent ? ` intel-kpi--${item.accent}` : ''}`}>
          <p className="intel-kpi__value">{item.value}</p>
          <p className="intel-kpi__label">{item.label}</p>
        </article>
      ))}
    </div>
  );
}

export function RankingBars({ items, valueKey = 'count', labelKey = 'query', maxItems = 10 }) {
  const list = items.slice(0, maxItems);
  const max = list[0]?.[valueKey] ?? 1;

  return (
    <ol className="intel-ranking">
      {list.map((item, i) => (
        <li key={item[labelKey] ?? item.pair ?? item.label ?? i} className="intel-ranking__row">
          <span className="intel-ranking__rank">{item.rank ?? i + 1}</span>
          <div className="intel-ranking__body">
            <div className="intel-ranking__top">
              <span className="intel-ranking__label">
                {item[labelKey] ?? item.pair ?? item.label ?? item.query}
              </span>
              <span className="intel-ranking__value">{item[valueKey]}</span>
            </div>
            <div className="intel-ranking__track">
              <div
                className="intel-ranking__fill"
                style={{ width: `${Math.max(6, (item[valueKey] / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CleverScoreBadge({ score, size = 'md' }) {
  const tier = score >= 90 ? 'hot' : score >= 75 ? 'good' : 'neutral';
  return (
    <div className={`intel-score intel-score--${tier} intel-score--${size}`}>
      <span className="intel-score__label">Clever Score</span>
      <span className="intel-score__value">{score}/100</span>
    </div>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="intel-table-wrap">
      <table className="intel-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MockBadge({ mode = 'mock' }) {
  const labels = {
    mock: { text: 'Demo-Daten', className: 'intel-mock-badge' },
    live: { text: 'Live-Daten', className: 'intel-live-badge' },
  };
  const cfg = labels[mode] ?? labels.mock;
  return <span className={cfg.className}>{cfg.text}</span>;
}

function formatSyncTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function SyncStatusBar({ status, eventCount, onSync }) {
  const isSyncing = status.status === 'syncing';
  const serverLabel = status.serverOnline === false
    ? 'Server offline'
    : status.serverOnline
      ? 'Server verbunden'
      : 'Sync …';

  return (
    <div className="intel-sync" aria-live="polite">
      <div className="intel-sync__info">
        <span className={`intel-sync__dot intel-sync__dot--${status.status}`} aria-hidden />
        <span className="intel-sync__text">
          {eventCount.toLocaleString('de-DE')} Events · {serverLabel}
          {status.lastSyncAt && ` · ${formatSyncTime(status.lastSyncAt)}`}
        </span>
      </div>
      <button
        type="button"
        className="intel-sync__btn"
        onClick={onSync}
        disabled={isSyncing}
      >
        {isSyncing ? 'Synchronisiert …' : 'Jetzt syncen'}
      </button>
    </div>
  );
}
