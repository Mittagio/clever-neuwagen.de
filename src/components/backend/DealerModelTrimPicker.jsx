import { useMemo } from 'react';
import {
  getModelTrimLines,
  getTrimsWithFinanceData,
  getTrimsWithLeasingData,
  getTrimsWithPaymentData,
  resolveTrimSettings,
  TRIM_SCOPE_ALL,
} from '../../services/dealer/dealerTrimConditions.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import './DealerVehicleManagement.css';

const PAYMENT_LABELS = {
  cash: 'Barzahlung',
  leasing: 'Leasing',
  financing: 'Finanzierung',
};

export default function DealerModelTrimPicker({
  model,
  conditions,
  paymentType,
  onBack,
  onConfirm,
}) {
  const trims = useMemo(() => getModelTrimLines(model), [model]);
  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );

  const trimsWithData = useMemo(() => {
    if (paymentType === 'leasing') {
      return getTrimsWithLeasingData(conditions, model.id, settings, trims);
    }
    if (paymentType === 'financing') {
      return getTrimsWithFinanceData(conditions, model.id, settings, trims);
    }
    return getTrimsWithPaymentData(settings, paymentType, trims);
  }, [conditions, model.id, settings, trims, paymentType]);

  const paymentLabel = PAYMENT_LABELS[paymentType] ?? 'Konditionen';

  function trimMeta(trimId) {
    const trimSettings = resolveTrimSettings(settings, trimId);
    if (paymentType === 'leasing') {
      const hasData = trimsWithData.some((t) => t.id === trimId);
      return hasData ? 'Bereits gepflegt' : 'Noch nicht gepflegt';
    }
    if (paymentType === 'financing') {
      const hasData = trimsWithData.some((t) => t.id === trimId);
      return hasData ? 'Bereits gepflegt' : 'Noch nicht gepflegt';
    }
    const discount = trimSettings.paymentDiscounts?.[paymentType];
    return discount != null ? `${discount} % Rabatt` : 'Noch nicht gepflegt';
  }

  return (
    <div className="dvm-conditions">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Konditionen
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">{paymentLabel}</h2>
        <p className="dvm-conditions__sub">
          Für welche Ausstattung gelten die Werte?
        </p>
      </header>

      <div className="dvm-trim-picker">
        {trims.map((trim) => (
          <button
            key={trim.id}
            type="button"
            className="dvm-trim-picker__option"
            onClick={() => onConfirm({ mode: 'single', trimId: trim.id })}
          >
            <span className="dvm-trim-picker__name">{trim.name}</span>
            <span className="dvm-trim-picker__meta">{trimMeta(trim.id)}</span>
          </button>
        ))}

        <button
          type="button"
          className="dvm-trim-picker__option dvm-trim-picker__option--all"
          onClick={() => onConfirm({ mode: 'all', trimId: TRIM_SCOPE_ALL })}
        >
          <span className="dvm-trim-picker__name">Alle Ausstattungen</span>
          <span className="dvm-trim-picker__meta">
            Werte für alle Linien gleichzeitig setzen
          </span>
        </button>
      </div>
    </div>
  );
}
