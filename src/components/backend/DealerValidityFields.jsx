import { buildValidityFields } from '../../services/dealer/dealerConditionLifecycle.js';
import './DealerVehicleManagement.css';

export default function DealerValidityFields({ value = {}, onChange, compact = false }) {
  const fields = buildValidityFields(value);

  return (
    <div className={`dvm-validity${compact ? ' dvm-validity--compact' : ''}`}>
      {!compact && (
        <p className="dvm-field__label">Gültigkeitszeitraum</p>
      )}
      <div className="dvm-action-card__row">
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Gültig ab</span>
          <input
            type="date"
            className="dvm-field__input"
            value={fields.validFrom?.slice(0, 10) ?? ''}
            onChange={(e) => onChange?.({ validFrom: e.target.value })}
          />
        </label>
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Gültig bis</span>
          <input
            type="date"
            className="dvm-field__input"
            value={fields.validUntil?.slice(0, 10) ?? ''}
            onChange={(e) => onChange?.({ validUntil: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
