import { useState } from 'react';
import {
  LEASING_TERM_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  getModelLabel,
} from '../../data/dealerConditionsSchema.js';
import './BackendSections.css';

export default function BackendLeasingFactors({
  conditions,
  onUpdateLeasingFactor,
  onSaveLeasingTerm,
}) {
  const [selectedModel, setSelectedModel] = useState('sportage');
  const [selectedTerm, setSelectedTerm] = useState(48);
  const [saveHint, setSaveHint] = useState('');

  const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
  const modelId = activeModels.some((m) => m.id === selectedModel)
    ? selectedModel
    : activeModels[0]?.id ?? 'sportage';

  const factors = conditions.leasingFactorsByModel?.[modelId]?.[selectedTerm] ?? {};

  function handleSave() {
    const result = onSaveLeasingTerm(modelId, selectedTerm);
    setSaveHint(`LF für ${selectedTerm} Monate gespeichert (${new Date(result.savedAt).toLocaleTimeString('de-DE')})`);
    setTimeout(() => setSaveHint(''), 3000);
  }

  return (
    <div className="backend-sections">
      <p className="backend-section-intro">
        Laufzeit wählen, dann Kilometerkarten pflegen. Keine Tabellen – mobile-first.
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
        <h2 className="backend-card-title">Laufzeit</h2>
        <div className="backend-chip-row backend-chip-row--wrap">
          {(LEASING_TERM_OPTIONS).map((term) => (
            <button
              key={term}
              type="button"
              className={`backend-chip backend-chip--term ${selectedTerm === term ? 'is-active' : ''}`}
              onClick={() => setSelectedTerm(term)}
            >
              {term} Mt.
            </button>
          ))}
        </div>
      </section>

      <section className="backend-card">
        <h2 className="backend-card-title">{selectedTerm} Monate – Kilometer pro Jahr</h2>
        <div className="backend-lf-grid">
          {LEASING_MILEAGE_OPTIONS.map((km) => (
            <label key={km} className="backend-lf-card">
              <span className="backend-lf-km">{(km / 1000).toLocaleString('de-DE')} Tkm</span>
              <input
                type="number"
                className="form-input backend-lf-input"
                min={0.01}
                max={2}
                step={0.01}
                placeholder="–"
                value={factors[km] ?? ''}
                onChange={(e) => onUpdateLeasingFactor(modelId, selectedTerm, km, e.target.value)}
              />
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-primary backend-save-btn" onClick={handleSave}>
          LF speichern
        </button>
        {saveHint && <p className="backend-save-hint">{saveHint}</p>}
      </section>
    </div>
  );
}
