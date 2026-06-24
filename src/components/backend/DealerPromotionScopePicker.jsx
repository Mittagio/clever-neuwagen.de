import {
  PROMOTION_SCOPE_LABELS,
  PROMOTION_SCOPE_TYPES,
} from '../../services/dealer/dealerPromotionEngine.js';
import './DealerVehicleManagement.css';

export default function DealerPromotionScopePicker({
  model,
  conditions,
  scope,
  onChange,
}) {
  const models = conditions.activeModels ?? [];
  const brands = [...new Set(models.map((m) => m.brand).filter(Boolean))];

  function setScopeType(type) {
    if (type === PROMOTION_SCOPE_TYPES.MODEL) {
      onChange?.({ type, modelIds: [model.id], brand: null });
    } else if (type === PROMOTION_SCOPE_TYPES.BRAND) {
      onChange?.({ type, modelIds: [], brand: model.brand ?? brands[0] ?? null });
    } else {
      onChange?.({ type, modelIds: [model.id], brand: null });
    }
  }

  function toggleModel(modelId) {
    const current = scope?.modelIds ?? [];
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];
    onChange?.({ ...scope, modelIds: next.length ? next : [model.id] });
  }

  return (
    <div className="dvm-promo-scope">
      <p className="dvm-field__label">Für welche Fahrzeuge gilt die Aktion?</p>
      <div className="dvm-chips dvm-chips--wrap">
        {Object.entries(PROMOTION_SCOPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            type="button"
            className={`dvm-chip${scope?.type === type ? ' is-active' : ''}`}
            onClick={() => setScopeType(type)}
          >
            {label}
          </button>
        ))}
      </div>

      {scope?.type === PROMOTION_SCOPE_TYPES.MODELS && (
        <div className="dvm-chips dvm-chips--wrap dvm-promo-scope__models">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`dvm-chip${scope.modelIds?.includes(m.id) ? ' is-active' : ''}`}
              onClick={() => toggleModel(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {scope?.type === PROMOTION_SCOPE_TYPES.BRAND && (
        <div className="dvm-chips dvm-chips--wrap">
          {brands.map((brand) => (
            <button
              key={brand}
              type="button"
              className={`dvm-chip${scope.brand === brand ? ' is-active' : ''}`}
              onClick={() => onChange?.({ ...scope, brand })}
            >
              {brand}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
