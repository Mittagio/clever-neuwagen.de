import { CHANGE_TYPES } from '../../data/vehicleDataService.js';
import StatusBadge from './StatusBadge.jsx';
import './ChangeCenter.css';

export default function ChangeCenter({ items, title = 'Änderungscenter', showFilters = false }) {
  if (!items?.length) {
    return (
      <section className="change-center">
        <h2 className="change-center-title">{title}</h2>
        <p className="change-center-empty">Keine Änderungen vorhanden.</p>
      </section>
    );
  }

  return (
    <section className="change-center">
      <header className="change-center-head">
        <h2 className="change-center-title">{title}</h2>
        {showFilters && (
          <p className="change-center-sub">Preise · Farben · Pakete · WLTP · Modelljahre</p>
        )}
      </header>

      <div className="change-center-list">
        {items.map((item) => {
          const typeConfig = CHANGE_TYPES[item.type] ?? { label: item.type, icon: '📋' };
          return (
            <article key={item.id} className="change-center-item">
              <span className="change-center-icon" aria-hidden="true">{typeConfig.icon}</span>
              <div className="change-center-body">
                <div className="change-center-meta">
                  <span className="change-center-type">{typeConfig.label}</span>
                  <time className="change-center-date">{item.date}</time>
                </div>
                <p className="change-center-title-text">{item.title}</p>
                {item.detail && (
                  <p className="change-center-detail">{item.detail}</p>
                )}
              </div>
              <StatusBadge status={item.status} type="change" />
            </article>
          );
        })}
      </div>
    </section>
  );
}
