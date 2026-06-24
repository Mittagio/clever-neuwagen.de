import './DealerModelPromotionBadges.css';

export default function DealerModelPromotionBadges({
  badges = [],
  overflowLabel = null,
  className = '',
}) {
  if (!badges.length && !overflowLabel) return null;

  return (
    <div className={`dmp-badges${className ? ` ${className}` : ''}`} aria-label="Händleraktionen">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`dmp-badge dmp-badge--${badge.tone ?? 'neutral'}${badge.highlight ? ' dmp-badge--highlight' : ''}`}
        >
          {badge.highlight && <span className="dmp-badge__star" aria-hidden>⭐ </span>}
          {badge.label}
        </span>
      ))}
      {overflowLabel && (
        <span className="dmp-badge dmp-badge--overflow">{overflowLabel}</span>
      )}
    </div>
  );
}
