import { useState } from 'react';
import {
  FINANCE_TERM_OPTIONS,
  getModelLabel,
} from '../../data/dealerConditionsSchema.js';
import { RATE_DISCLAIMER } from '../../constants/legal.js';
import './BackendSections.css';

const FINANCE_TERM_PRESETS = [12, 24, 36, 48, 60];

export default function BackendFinance({
  conditions,
  onUpdateFinance,
  onUpdateFinanceFinalPayment,
}) {
  const [selectedModel, setSelectedModel] = useState('sportage');
  const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
  const modelId = activeModels.some((m) => m.id === selectedModel)
    ? selectedModel
    : activeModels[0]?.id ?? 'sportage';

  const finance = conditions.financeByModel?.[modelId] ?? {};

  return (
    <div className="backend-sections">
      <p className="backend-section-intro">
        Schlussrate immer in Prozent vom Hauspreis – nicht in Euro.
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
            <label className="form-label">Effektiver Jahreszins</label>
            <div className="backend-input-suffix">
              <input
                type="number"
                className="form-input"
                min={0}
                max={20}
                step={0.01}
                value={finance.interestRate ?? ''}
                onChange={(e) => onUpdateFinance(modelId, 'interestRate', Number(e.target.value) || 0)}
              />
              <span className="backend-suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Anzahlung Standard</label>
            <div className="backend-input-suffix">
              <input
                type="number"
                className="form-input"
                min={0}
                max={100}
                step={1}
                value={finance.downPaymentPercent ?? ''}
                onChange={(e) => onUpdateFinance(modelId, 'downPaymentPercent', Number(e.target.value) || 0)}
              />
              <span className="backend-suffix">%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="backend-card">
        <h2 className="backend-card-title">Schlussrate je Laufzeit</h2>
        <div className="backend-lf-grid">
          {FINANCE_TERM_PRESETS.map((term) => (
            <label key={term} className="backend-lf-card">
              <span className="backend-lf-km">{term} Monate</span>
              <div className="backend-input-suffix">
                <input
                  type="number"
                  className="form-input backend-lf-input"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="–"
                  value={finance.finalPaymentPercent?.[term] ?? ''}
                  onChange={(e) => onUpdateFinanceFinalPayment(modelId, term, e.target.value)}
                />
                <span className="backend-suffix">%</span>
              </div>
            </label>
          ))}
        </div>
        <details className="backend-details">
          <summary>Weitere Laufzeiten (12–60 Monate)</summary>
          <div className="backend-lf-grid backend-lf-grid--compact">
            {FINANCE_TERM_OPTIONS.filter((t) => !FINANCE_TERM_PRESETS.includes(t)).map((term) => (
              <label key={term} className="backend-lf-card backend-lf-card--compact">
                <span className="backend-lf-km">{term} Mt.</span>
                <input
                  type="number"
                  className="form-input backend-lf-input"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="–"
                  value={finance.finalPaymentPercent?.[term] ?? ''}
                  onChange={(e) => onUpdateFinanceFinalPayment(modelId, term, e.target.value)}
                />
              </label>
            ))}
          </div>
        </details>
      </section>

      <p className="backend-disclaimer">{RATE_DISCLAIMER}</p>
    </div>
  );
}
