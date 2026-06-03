import '../vehicle-detail/vehicle-detail.css';

const STATUS_LABELS = {
  requested: 'Ihr Wunsch',
  standard: 'SERIENMÄSSIG',
  package: 'Im Paket',
  bonus: 'zusätzlich',
  open: null,
  unavailable: 'Nicht verfügbar',
};

const VARIANT_MAP = {
  requested: 'wish',
  standard: 'standard',
  package: 'wish',
  bonus: 'bonus',
  open: 'idle',
  unavailable: 'unavailable',
};

export default function WishFeatureChip({ featureId, label, status = 'open', onClick }) {
  const variant = VARIANT_MAP[status] ?? 'idle';
  const badge = STATUS_LABELS[status];

  return (
    <button
      type="button"
      className={`vd-wish-chip vd-wish-chip--${variant}`}
      onClick={() => onClick?.(featureId)}
    >
      {(status === 'standard' || status === 'requested' || status === 'package') && (
        <span className="vd-wish-chip__check" aria-hidden>✓</span>
      )}
      <span className="vd-wish-chip__text">{label}</span>
      {badge && <span className="vd-wish-chip__badge">{badge}</span>}
    </button>
  );
}
