import './wish.css';

export default function WishMatchScore({ matched, total, score, size = 'md' }) {
  if (!total) return null;

  return (
    <div className={`wish-match-score wish-match-score--${size}`}>
      <span className="wish-match-score__label">
        Erfüllt {matched} von {total} Wünschen
      </span>
      {score != null && (
        <span className="wish-match-score__badge">{score} %</span>
      )}
    </div>
  );
}
