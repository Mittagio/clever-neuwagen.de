import { Link } from 'react-router-dom';
import { formatImportDate } from '../../../data/priceListImport.js';
import './ImportKpiBar.css';

export default function ImportKpiBar({ metrics }) {
  const lastLabel = metrics.lastUpdate
    ? formatImportDate(metrics.lastUpdate)
    : '–';

  const items = [
    { label: 'Importe gesamt', value: metrics.total },
    { label: 'Heute importiert', value: metrics.today },
    { label: 'Offene Freigaben', value: metrics.pending, highlight: metrics.pending > 0 },
    { label: 'Letzte Aktualisierung', value: lastLabel, isText: true },
  ];

  return (
    <section className="import-kpi" aria-label="Import-Kennzahlen">
      <div className="import-kpi__grid">
        {items.map((item) => (
          <div
            key={item.label}
            className={`import-kpi__card${item.highlight ? ' import-kpi__card--warn' : ''}`}
          >
            <span className="import-kpi__label">{item.label}</span>
            <span className="import-kpi__value">{item.value}</span>
          </div>
        ))}
      </div>
      <Link to="/admin/import/history" className="import-kpi__history-link">
        Import-Historie anzeigen →
      </Link>
    </section>
  );
}
