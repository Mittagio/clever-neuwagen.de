import { getModelStatusLabel } from '../../data/dealerConditionsSchema.js';
import './BackendHub.css';

export default function BackendFahrzeugeOverview({ conditions, onSectionChange }) {
  const inventory = conditions.inventoryVehicles ?? [];
  const models = conditions.activeModels ?? [];

  return (
    <div className="backend-hub">
      <header className="backend-hub__head">
        <h2 className="backend-hub__title">Ihre Fahrzeuge</h2>
        <p className="backend-hub__desc">
          Modelle, Lagerbestand und Veröffentlichung der Händlerseite – alles an einem Ort.
        </p>
      </header>

      <div className="backend-hub__cards">
        <button
          type="button"
          className="backend-hub__card"
          onClick={() => onSectionChange('models')}
        >
          <span className="backend-hub__card-icon">🚗</span>
          <span className="backend-hub__card-value">{models.filter((m) => m.active).length}</span>
          <span className="backend-hub__card-label">Aktive Modelle</span>
          <span className="backend-hub__card-hint">Konditionen & Kontakt</span>
        </button>

        <button
          type="button"
          className="backend-hub__card"
          onClick={() => onSectionChange('inventory')}
        >
          <span className="backend-hub__card-icon">📦</span>
          <span className="backend-hub__card-value">{inventory.length}</span>
          <span className="backend-hub__card-label">Lagerfahrzeuge</span>
          <span className="backend-hub__card-hint">Bestand verwalten</span>
        </button>

        <button
          type="button"
          className="backend-hub__card backend-hub__card--accent"
          onClick={() => onSectionChange('publish')}
        >
          <span className="backend-hub__card-icon">🌐</span>
          <span className="backend-hub__card-label">Online schalten</span>
          <span className="backend-hub__card-hint">
            {conditions.dealerPageOnline ? '🟢 Händlerseite live' : 'Entwurf veröffentlichen'}
          </span>
        </button>
      </div>

      <section className="backend-hub__list-section">
        <h3>Modellstatus</h3>
        <ul className="backend-hub__list">
          {models.map((model) => (
            <li key={model.id}>
              <span>{model.brand} {model.name}</span>
              <span className="backend-hub__badge">{getModelStatusLabel(model)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
