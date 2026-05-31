import { kiaModels } from '../../data/adminCatalog.js';
import { getModelHealth } from '../../data/vehicleDataService.js';
import HealthIndicator from './HealthIndicator.jsx';
import './ModelOverview.css';

export default function ModelOverview({ onSelectModel, onBack }) {
  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <button type="button" className="admin-back-btn" onClick={onBack}>← Dashboard</button>
        <h2 className="admin-section-title">Kia Modelle</h2>
        <p className="admin-section-desc">
          Pflegezustand je Modell · 🟢 aktuell · 🟡 prüfen · 🔴 veraltet
        </p>
      </header>

      <div className="model-list">
        {kiaModels.map((model) => (
          <button
            key={model.id}
            type="button"
            className={`model-card ${model.hasDetail ? 'is-clickable' : ''}`}
            disabled={!model.hasDetail}
            onClick={() => model.hasDetail && onSelectModel(model.id)}
          >
            <div className="model-card-main">
              <span className="model-card-name">{model.name}</span>
              <span className="model-card-segment">{model.segment}</span>
            </div>
            <div className="model-card-footer">
              <HealthIndicator health={getModelHealth(model.status)} />
              {model.hasDetail ? (
                <span className="model-card-action">Stammdaten →</span>
              ) : (
                <span className="model-card-soon">Noch nicht angelegt</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
