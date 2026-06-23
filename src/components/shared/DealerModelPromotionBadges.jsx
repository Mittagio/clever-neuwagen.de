import './DealerModelPromotionBadges.css';

export default function DealerModelPromotionBadges({ badges = [], className = '' }) {
  if (!badges.length) return null;

  return (
    <div className={`dmp-badges${className ? ` ${className}` : ''}`} aria-label="Händleraktionen">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`dmp-badge dmp-badge--${badge.tone ?? 'neutral'}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
