import './brand-exclusion-conflict.css';

/**
 * Ruhige Entscheidungskarte – kein Alarm, keine doppelten Systemboxen
 */
export default function BrandExclusionConflictCard({
  copy,
  onRestoreBrand,
  onShowAlternatives,
  onAdjustSearch,
}) {
  if (!copy) return null;

  return (
    <section className="brand-exclusion-card" aria-labelledby="brand-exclusion-title">
      <h2 id="brand-exclusion-title" className="brand-exclusion-card__title">
        {copy.headline}
      </h2>
      <p className="brand-exclusion-card__sub">{copy.subline}</p>

      <div className="brand-exclusion-card__actions">
        <button
          type="button"
          className="brand-exclusion-card__btn brand-exclusion-card__btn--primary"
          onClick={onRestoreBrand}
        >
          {copy.primaryLabel}
        </button>
        <button
          type="button"
          className="brand-exclusion-card__btn brand-exclusion-card__btn--secondary"
          onClick={onShowAlternatives}
        >
          {copy.secondaryLabel}
        </button>
      </div>

      {onAdjustSearch && (
        <button
          type="button"
          className="brand-exclusion-card__tertiary"
          onClick={onAdjustSearch}
        >
          {copy.tertiaryLabel}
        </button>
      )}
    </section>
  );
}
