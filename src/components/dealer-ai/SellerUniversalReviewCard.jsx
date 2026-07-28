import './SellerUniversalReviewCard.css';

/**
 * Sichtbare Review: „Clever hat verstanden“ – vor Persistenz.
 */
export default function SellerUniversalReviewCard({
  model = null,
  onAccept = null,
  onDismiss = null,
}) {
  if (!model?.groups?.length) return null;

  return (
    <article className="sur-card" aria-live="polite">
      <header className="sur-card__head">
        <p className="sur-card__title">{model.title}</p>
        {onDismiss ? (
          <button
            type="button"
            className="sur-card__dismiss"
            onClick={onDismiss}
            aria-label="Schließen"
          >
            ×
          </button>
        ) : null}
      </header>

      <ul className="sur-card__groups">
        {model.groups.map((group) => (
          <li key={group.id} className="sur-card__group">
            <p className="sur-card__group-title">{group.title}</p>
            <p className="sur-card__group-line">{group.line}</p>
          </li>
        ))}
      </ul>

      <p className="sur-card__summary">{model.summaryLine}</p>
      {model.missingLine ? (
        <p className="sur-card__missing">{model.missingLine}</p>
      ) : null}

      <div className="sur-card__ctas">
        <button
          type="button"
          className="sur-card__btn sur-card__btn--primary"
          onClick={() => onAccept?.(model)}
        >
          {model.primaryCta || 'Übernehmen'}
        </button>
        {onDismiss ? (
          <button
            type="button"
            className="sur-card__btn sur-card__btn--ghost"
            onClick={onDismiss}
          >
            {model.secondaryCta || 'Verwerfen'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
