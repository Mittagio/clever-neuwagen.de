import { sportage, kiaSportage } from '../../data/kiaSportage.js';
import { INVENTORY_TYPE_OPTIONS } from '../../data/inventoryTypes.js';
import {
  getColorName,
  getCustomerAvailabilityLabel,
  getTrimName,
} from '../../logic/inventoryService.js';
import AvailabilityBadge from '../shared/AvailabilityBadge.jsx';
import './InventoryManager.css';
import './BackendSections.css';

export default function InventoryManager({
  inventory,
  onAdd,
  onUpdate,
  onRemove,
}) {
  return (
    <section className="inventory-manager backend-sections">
      <header className="inventory-manager-head">
        <div>
          <h2 className="backend-card-title">Lager & Vorlauf</h2>
          <p className="inventory-manager-desc">
            Konkrete Fahrzeuge – werden auf der Landingpage vor Konfigurationsangeboten angezeigt.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          + Fahrzeug
        </button>
      </header>

      <div className="inventory-list">
        {inventory.map((item) => (
          <article key={item.id} className="inventory-card backend-card">
            <div className="inventory-card-top">
              <AvailabilityBadge
                type={item.type}
                label={getCustomerAvailabilityLabel(item)}
                compact
              />
              <button
                type="button"
                className="inventory-remove"
                onClick={() => onRemove(item.id)}
                aria-label="Fahrzeug entfernen"
              >
                ✕
              </button>
            </div>

            <div className="inventory-fields">
              <div className="form-group">
                <label className="form-label">Modell</label>
                <input
                  type="text"
                  className="form-input"
                  value={item.model ?? 'Sportage'}
                  onChange={(e) => onUpdate(item.id, { model: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={item.type}
                  onChange={(e) => onUpdate(item.id, { type: e.target.value })}
                >
                  {INVENTORY_TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ausstattung (Linie)</label>
                <select
                  className="form-select"
                  value={item.trimId}
                  onChange={(e) => {
                    const trimId = e.target.value;
                    onUpdate(item.id, {
                      trimId,
                      equipment: getTrimName(trimId),
                    });
                  }}
                >
                  {sportage.trims.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Motor</label>
                <select
                  className="form-select"
                  value={item.engineId}
                  onChange={(e) => onUpdate(item.id, { engineId: e.target.value })}
                >
                  {sportage.engines.map((eng) => (
                    <option key={eng.id} value={eng.id}>{eng.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Farbe</label>
                <select
                  className="form-select"
                  value={item.colorId}
                  onChange={(e) => {
                    const colorId = e.target.value;
                    onUpdate(item.id, {
                      colorId,
                      color: getColorName(colorId),
                    });
                  }}
                >
                  {sportage.colors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pakete</label>
                <select
                  className="form-select"
                  multiple
                  value={item.packageIds ?? []}
                  onChange={(e) => {
                    const packageIds = Array.from(e.target.selectedOptions, (o) => o.value);
                    onUpdate(item.id, { packageIds });
                  }}
                >
                  {kiaSportage.packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">VIN (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={item.vin ?? ''}
                  placeholder="z. B. KNADM5A30S6123456"
                  onChange={(e) => onUpdate(item.id, { vin: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">ETA / Lieferdatum</label>
                <input
                  type="date"
                  className="form-input"
                  value={item.eta ?? ''}
                  onChange={(e) => onUpdate(item.id, { eta: e.target.value || null })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Standort</label>
                <input
                  type="text"
                  className="form-input"
                  value={item.location ?? ''}
                  placeholder="z. B. Heilbronn Ausstellung"
                  onChange={(e) => onUpdate(item.id, { location: e.target.value })}
                />
              </div>

              <div className="form-group inventory-field-full">
                <label className="form-label">Interne Notiz</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={item.internalNote ?? ''}
                  placeholder="Nur für Händler sichtbar"
                  onChange={(e) => onUpdate(item.id, { internalNote: e.target.value })}
                />
              </div>

              <label className="backend-toggle inventory-field-full">
                <input
                  type="checkbox"
                  checked={item.visibleOnLanding !== false}
                  onChange={(e) => onUpdate(item.id, { visibleOnLanding: e.target.checked })}
                />
                <span>Auf Landingpage anzeigen</span>
              </label>
            </div>
          </article>
        ))}

        {inventory.length === 0 && (
          <p className="inventory-empty">Noch keine Fahrzeuge im Lager oder Vorlauf.</p>
        )}
      </div>
    </section>
  );
}
