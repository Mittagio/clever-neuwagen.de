import { getModelStatusLabel } from '../../data/dealerConditionsSchema.js';
import './BackendSections.css';

export default function BackendModels({ conditions, onUpdateModel, onUpdateModelContact }) {
  return (
    <div className="backend-sections">
      <p className="backend-section-intro">
        Aktivieren Sie Modelle für Ihre Händlerseite und die Landingpage-Suche.
      </p>
      {conditions.activeModels?.map((model) => (
        <article key={model.id} className="backend-card backend-model-card">
          <header className="backend-model-card-head">
            <div>
              <h2 className="backend-card-title">{model.brand} {model.name}</h2>
              <span className={`backend-model-status-badge backend-model-status-badge--${model.active ? 'active' : 'prep'}`}>
                {getModelStatusLabel(model)}
              </span>
            </div>
          </header>

          <div className="backend-toggle-list">
            <label className="backend-toggle">
              <input
                type="checkbox"
                checked={model.active}
                disabled={model.status === 'preparing' && !model.active}
                onChange={(e) => onUpdateModel(model.id, { active: e.target.checked })}
              />
              <span>Aktiv</span>
            </label>
            <label className="backend-toggle">
              <input
                type="checkbox"
                checked={model.showOnDealerPage}
                disabled={!model.active}
                onChange={(e) => onUpdateModel(model.id, { showOnDealerPage: e.target.checked })}
              />
              <span>Auf Händlerseite anzeigen</span>
            </label>
            <label className="backend-toggle">
              <input
                type="checkbox"
                checked={model.syncToLanding}
                disabled={!model.active}
                onChange={(e) => onUpdateModel(model.id, { syncToLanding: e.target.checked })}
              />
              <span>Auf clever-neuwagen.de synchronisieren</span>
            </label>
          </div>

          <div className="backend-field-grid">
            <div className="form-group">
              <label className="form-label">Standard-Lieferzeit</label>
              <input
                type="text"
                className="form-input"
                value={model.defaultDeliveryTime ?? ''}
                disabled={!model.active}
                onChange={(e) => onUpdateModel(model.id, { defaultDeliveryTime: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ansprechpartner</label>
              <input
                type="text"
                className="form-input"
                value={model.contact?.name ?? ''}
                disabled={!model.active}
                placeholder="Name"
                onChange={(e) => onUpdateModelContact(model.id, 'name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input
                type="tel"
                className="form-input"
                value={model.contact?.phone ?? ''}
                disabled={!model.active}
                onChange={(e) => onUpdateModelContact(model.id, 'phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                className="form-input"
                value={model.contact?.email ?? ''}
                disabled={!model.active}
                onChange={(e) => onUpdateModelContact(model.id, 'email', e.target.value)}
              />
            </div>
          </div>

          {model.status === 'preparing' && (
            <p className="backend-hint">Modell in Vorbereitung – Fahrzeugdaten werden zentral freigeschaltet.</p>
          )}
        </article>
      ))}
    </div>
  );
}
