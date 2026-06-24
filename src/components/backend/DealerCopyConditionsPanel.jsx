import { useState } from 'react';
import {
  buildCopyFromModelPatch,
  buildCopyLeasingFactorsPlan,
  getPreviousMonthSettings,
  listCopyableModels,
} from '../../services/dealer/dealerCopyConditions.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import './DealerVehicleManagement.css';

const COPY_OPTIONS = [
  { id: 'model', label: 'Von anderem Modell' },
  { id: 'previous', label: 'Vom Vormonat' },
];

export default function DealerCopyConditionsPanel({
  model,
  conditions,
  onUpdateModelSettings,
  onUpdateLeasingFactor,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const copyableModels = listCopyableModels(conditions, model.id);
  const settings = resolveModelSettings(conditions, model.id);

  function handleCopyFromModel(sourceModelId) {
    const sourceSettings = resolveModelSettings(conditions, sourceModelId);
    onUpdateModelSettings?.(model.id, buildCopyFromModelPatch(settings, sourceSettings));

    const plan = buildCopyLeasingFactorsPlan(conditions, sourceModelId, model.id);
    for (const update of plan.updates) {
      onUpdateLeasingFactor?.(model.id, update.term, update.km, update.value, update.trimId);
    }
    setMode(null);
    setOpen(false);
  }

  function handleCopyPreviousMonth() {
    const prev = getPreviousMonthSettings(conditions, model.id);
    if (!prev) return;
    onUpdateModelSettings?.(model.id, buildCopyFromModelPatch(settings, prev));
    setMode(null);
    setOpen(false);
  }

  return (
    <div className="dvm-copy-panel">
      <button
        type="button"
        className="dvm-copy-panel__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        Werte übernehmen
      </button>

      {open && (
        <div className="dvm-copy-panel__body">
          <div className="dvm-chips dvm-chips--wrap">
            {COPY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`dvm-chip${mode === opt.id ? ' is-active' : ''}`}
                onClick={() => setMode(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === 'model' && (
            <div className="dvm-copy-panel__list">
              {copyableModels.length === 0 ? (
                <p className="dvm-empty">Kein anderes Modell mit Konditionen.</p>
              ) : (
                copyableModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="dvm-copy-panel__item"
                    onClick={() => handleCopyFromModel(m.id)}
                  >
                    {m.brand} {m.name}
                  </button>
                ))
              )}
            </div>
          )}

          {mode === 'previous' && (
            <div className="dvm-copy-panel__list">
              {getPreviousMonthSettings(conditions, model.id) ? (
                <button
                  type="button"
                  className="dvm-copy-panel__item"
                  onClick={handleCopyPreviousMonth}
                >
                  Vormonat übernehmen
                </button>
              ) : (
                <p className="dvm-empty">Kein Archiv vom Vormonat vorhanden.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
