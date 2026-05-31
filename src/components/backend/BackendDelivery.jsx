import { useState } from 'react';
import {
  DELIVERY_STATUS_OPTIONS,
  getModelLabel,
} from '../../data/dealerConditionsSchema.js';
import './BackendSections.css';

export default function BackendDelivery({ conditions, onUpdateDelivery, onUpdatePreparationFee }) {
  const [selectedModel, setSelectedModel] = useState('sportage');
  const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
  const modelId = activeModels.some((m) => m.id === selectedModel)
    ? selectedModel
    : activeModels[0]?.id ?? 'sportage';

  const delivery = conditions.deliveryByModel?.[modelId] ?? {};

  return (
    <div className="backend-sections">
      <p className="backend-section-intro">
        Standard-Lieferzeit und Verfügbarkeitsstatus für Kunden-Chips.
      </p>

      <div className="backend-chip-row">
        {(activeModels.length ? activeModels : [{ id: 'sportage' }]).map((m) => (
          <button
            key={m.id}
            type="button"
            className={`backend-chip ${modelId === m.id ? 'is-active' : ''}`}
            onClick={() => setSelectedModel(m.id)}
          >
            {getModelLabel(m.id)}
          </button>
        ))}
      </div>

      <section className="backend-card">
        <h2 className="backend-card-title">{getModelLabel(modelId)}</h2>
        <div className="backend-field-grid">
          <div className="form-group">
            <label className="form-label">Standard-Lieferzeit</label>
            <input
              type="text"
              className="form-input"
              value={delivery.defaultDeliveryTime ?? ''}
              placeholder="z. B. 4–6 Wochen"
              onChange={(e) => onUpdateDelivery(modelId, 'defaultDeliveryTime', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Verfügbarkeitsstatus</label>
            <select
              className="form-select"
              value={delivery.availabilityStatus ?? 'konfigurierbar'}
              onChange={(e) => onUpdateDelivery(modelId, 'availabilityStatus', e.target.value)}
            >
              {DELIVERY_STATUS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="backend-chip-preview">
          <p className="backend-hint">Kunden-Chip-Vorschau:</p>
          <span className="backend-delivery-chip">
            {DELIVERY_STATUS_OPTIONS.find((o) => o.id === delivery.availabilityStatus)?.chip ?? '🟡 4–6 Wochen'}
          </span>
        </div>
      </section>

      <section className="backend-card">
        <h2 className="backend-card-title">Allgemein</h2>
        <div className="form-group">
          <label className="form-label">Bereitstellungsgebühr (Barkauf)</label>
          <div className="backend-input-suffix">
            <input
              type="number"
              className="form-input"
              min={0}
              step={10}
              value={conditions.preparationFee ?? 0}
              onChange={(e) => onUpdatePreparationFee(e.target.value)}
            />
            <span className="backend-suffix">€</span>
          </div>
        </div>
      </section>
    </div>
  );
}
