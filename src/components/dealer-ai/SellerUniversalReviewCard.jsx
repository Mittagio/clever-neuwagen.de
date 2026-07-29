import './SellerUniversalReviewCard.css';

/**
 * Sichtbare Review: „Clever hat verstanden / vorbereitet“ – vor Persistenz.
 */
export default function SellerUniversalReviewCard({
  model = null,
  onAccept = null,
  onDismiss = null,
}) {
  if (!model?.groups?.length) return null;
  const sections = Array.isArray(model.actionSections) ? model.actionSections : [];

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

      {sections.length > 0 ? (
        <ul className="sur-card__actions" aria-label="Vorbereitete Aktionen">
          {sections.map((section) => (
            <li key={section.id} className={`sur-card__action sur-card__action--${section.kind}`}>
              <p className="sur-card__group-title">{section.title}</p>
              {section.headline ? (
                <p className="sur-card__action-headline">{section.headline}</p>
              ) : null}
              {section.kind === 'offer_change' && section.changes?.length ? (
                <ul className="sur-card__deltas">
                  {section.changes.map((change) => (
                    <li key={change.id}>
                      <span className="sur-card__delta-label">{change.label}</span>
                      <span className="sur-card__delta-value">
                        {change.from && change.to
                          ? `${change.from} → ${change.to}`
                          : (change.to || change.from)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.kind === 'message_draft' && section.body ? (
                <pre className="sur-card__draft">{section.body}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="sur-card__groups">
          {model.groups.map((group) => (
            <li key={group.id} className="sur-card__group">
              <p className="sur-card__group-title">{group.title}</p>
              <p className="sur-card__group-line">{group.line}</p>
            </li>
          ))}
        </ul>
      )}

      {sections.length === 0 ? (
        <p className="sur-card__summary">{model.summaryLine}</p>
      ) : (
        <p className="sur-card__summary">{model.summaryLine}</p>
      )}
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
