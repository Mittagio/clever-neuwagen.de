import { useMemo } from 'react';
import {
  getFinanceResidualProgress,
  resolveFinanceResidualSkippedMap,
} from '../../services/dealer/dealerFinanceResiduals.js';
import {
  getFinancingWizardProgress,
} from '../../services/dealer/dealerFinancingWizard.js';
import {
  getModelTrimLines,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import './DealerVehicleManagement.css';

const FINANCING_OPTIONS = [
  {
    id: 'conditions',
    label: 'Finanzierungskonditionen',
    icon: '🏦',
    hint: 'Zins, Anzahlung und Schlussrate pro Kombination',
  },
  {
    id: 'residuals',
    label: 'Schlussraten',
    icon: '🎯',
    hint: 'Schlussrate in Prozent pro Laufzeit – einmal pflegen, überall nutzen',
  },
];

export default function DealerModelFinancingHub({
  model,
  conditions,
  onBack,
  onOpenConditions,
  onOpenResiduals,
}) {
  const trims = getModelTrimLines(model);
  const settings = resolveModelSettings(conditions, model.id);
  const hasTrimLines = trims.length > 0;

  function conditionsMeta() {
    if (!hasTrimLines) {
      const fp = getFinancingWizardProgress(
        conditions,
        model.id,
        settings.financeWizardSkipped ?? {},
      );
      return `${fp.filled} von ${fp.total} Konditionen gepflegt`;
    }
    const totals = trims.reduce((acc, trim) => {
      const trimSettings = resolveTrimSettings(settings, trim.id);
      const fp = getFinancingWizardProgress(
        conditions,
        model.id,
        trimSettings.financeWizardSkipped ?? {},
        trim.id,
      );
      return {
        filled: acc.filled + fp.filled,
        total: acc.total + fp.total,
      };
    }, { filled: 0, total: 0 });
    return `${totals.filled} von ${totals.total} Konditionen · pro Ausstattung`;
  }

  function residualsMeta() {
    if (!hasTrimLines) {
      const rp = getFinanceResidualProgress(
        conditions,
        model.id,
        resolveFinanceResidualSkippedMap(settings),
      );
      return `${rp.filled} von ${rp.total} Schlussraten gepflegt`;
    }
    const totals = trims.reduce((acc, trim) => {
      const trimSettings = resolveTrimSettings(settings, trim.id);
      const rp = getFinanceResidualProgress(
        conditions,
        model.id,
        resolveFinanceResidualSkippedMap(trimSettings, trim.id),
        trim.id,
      );
      return {
        filled: acc.filled + rp.filled,
        total: acc.total + rp.total,
      };
    }, { filled: 0, total: 0 });
    return `${totals.filled} von ${totals.total} Schlussraten · pro Ausstattung`;
  }

  const metaById = useMemo(() => ({
    conditions: conditionsMeta(),
    residuals: residualsMeta(),
  }), [conditions, model.id, settings, trims, hasTrimLines]);

  return (
    <div className="dvm-conditions">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Konditionen
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Finanzierung</h2>
        <p className="dvm-conditions__sub">
          {model.name} – eine Auswahl pro Screen.
        </p>
      </header>

      <div className="dvm-conditions__cards">
        {FINANCING_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="dvm-conditions-card"
            onClick={() => (
              option.id === 'conditions' ? onOpenConditions() : onOpenResiduals()
            )}
          >
            <span className="dvm-conditions-card__icon" aria-hidden>{option.icon}</span>
            <span className="dvm-conditions-card__body">
              <span className="dvm-conditions-card__label">{option.label}</span>
              <span className="dvm-conditions-card__hint">{option.hint}</span>
              <span className="dvm-conditions-card__meta">{metaById[option.id]}</span>
            </span>
            <span className="dvm-conditions-card__chev" aria-hidden>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
