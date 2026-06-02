import { FEATURE_CATALOG, getFeatureLabel } from '../../data/features/featureCatalog.js';
import './wish.css';

export default function WishChips({
  selectedIds = [],
  onToggle,
  editable = true,
  compact = false,
}) {
  const ids = compact ? selectedIds : FEATURE_CATALOG.map((f) => f.id).filter((id) =>
    !['parking_rear', 'large_trunk'].includes(id),
  );

  const items = compact
    ? selectedIds.map((id) => FEATURE_CATALOG.find((f) => f.id === id)).filter(Boolean)
    : FEATURE_CATALOG.filter((f) => ['camera_360', 'blind_spot', 'heated_seats', 'towbar', 'parking_front', 'automatic', 'family_suv'].includes(f.id));

  return (
    <div className={`wish-chips${compact ? ' wish-chips--compact' : ''}`}>
      {items.map((feature) => {
        const active = selectedIds.includes(feature.id);
        return (
          <button
            key={feature.id}
            type="button"
            className={`wish-chip${active ? ' is-active' : ''}`}
            onClick={() => editable && onToggle?.(feature.id)}
            disabled={!editable}
          >
            {active ? '☑' : '☐'} {feature.label}
          </button>
        );
      })}
    </div>
  );
}

export function WishSummaryBar({ title = 'Wir haben verstanden:', chips, onEditChip }) {
  if (!chips.length) return null;

  return (
    <div className="wish-summary-bar">
      <p className="wish-summary-bar__title">{title}</p>
      <div className="wish-summary-bar__row">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="wish-summary-bar__chip"
            onClick={() => onEditChip?.(chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { getFeatureLabel };
