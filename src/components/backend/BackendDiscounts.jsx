import { useState } from 'react';
import {
  DISCOUNT_GROUP_FIELDS,
  resolveDiscountsForModel,
  getModelLabel,
} from '../../data/dealerConditionsSchema.js';
import './BackendSections.css';

export default function BackendDiscounts({ conditions, onUpdateDiscount }) {
  const [selectedModel, setSelectedModel] = useState('sportage');
  const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
  const modelId = activeModels.some((m) => m.id === selectedModel)
    ? selectedModel
    : activeModels[0]?.id ?? 'sportage';

  const discounts = conditions.discountsByModel?.[modelId] ?? {};
  const { isConfigured } = resolveDiscountsForModel(conditions.discountsByModel, modelId);

  return (
    <div className="backend-sections">
      <p className="backend-section-intro">
        Rabatte je Modell. Leere Felder fallen auf den Standardrabatt zurück.
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
          {DISCOUNT_GROUP_FIELDS.map(({ key, label, required }) => {
            const configured = isConfigured(key);
            const value = discounts[key] ?? '';
            return (
              <div key={key} className="form-group">
                <label className="form-label" htmlFor={`disc-${modelId}-${key}`}>{label}</label>
                <div className="backend-input-suffix">
                  <input
                    id={`disc-${modelId}-${key}`}
                    type="number"
                    className="form-input"
                    min={0}
                    max={50}
                    step={0.5}
                    placeholder={required ? '' : 'Standard'}
                    value={value === null ? '' : value}
                    onChange={(e) => onUpdateDiscount(modelId, key, e.target.value)}
                  />
                  <span className="backend-suffix">%</span>
                </div>
                {!required && !configured && (
                  <p className="backend-field-hint">
                    Nicht gepflegt – Kunde sieht Vorteil, aber keine bessere Rate.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
