import './CleverEmpfiehltCard.css';

export default function CleverEmpfiehltCard({
  view,
  telHref,
  onPrimaryAction,
  onMarkDone,
  onOpenOffer,
  loading = false,
}) {
  if (!view && !loading) return null;

  if (loading) {
    return (
      <section className="clever-empfiehlt" aria-busy="true">
        <p className="clever-empfiehlt__loading">Clever berechnet …</p>
      </section>
    );
  }

  const primaryAction = view.actions?.find((a) => a.primary)
    ?? view.actions?.find((a) => a.id === 'call')
    ?? view.actions?.[0];

  function handlePrimaryClick() {
    if (primaryAction?.type === 'call' && primaryAction.href) {
      onPrimaryAction?.(view, primaryAction);
      return;
    }
    onPrimaryAction?.(view, primaryAction);
  }

  return (
    <section className="clever-empfiehlt" aria-labelledby="clever-empfiehlt-title">
      <header className="clever-empfiehlt__header">
        <p className="clever-empfiehlt__eyebrow">🧠 Clever sagt</p>
        <div className="clever-empfiehlt__score" aria-label={`Abschlusschance ${view.closureLabel}`}>
          <span className="clever-empfiehlt__score-dot" data-level={view.closureChance >= 70 ? 'high' : view.closureChance >= 45 ? 'mid' : 'low'} />
          <strong>{view.closureLabel}</strong>
        </div>
      </header>

      <h2 id="clever-empfiehlt-title" className="clever-empfiehlt__headline">
        {view.headline}
      </h2>

      {view.subline ? (
        <p className="clever-empfiehlt__subline">{view.subline}</p>
      ) : null}

      {view.whyBullets?.length > 0 && (
        <div className="clever-empfiehlt__why">
          <p className="clever-empfiehlt__why-title">Warum?</p>
          <ul className="clever-empfiehlt__why-list">
            {view.whyBullets.map((bullet) => (
              <li key={bullet.id}>{bullet.text}</li>
            ))}
          </ul>
          {view.closureChance >= 70 ? (
            <p className="clever-empfiehlt__chance-hint">
              Die Abschlusswahrscheinlichkeit ist aktuell hoch.
            </p>
          ) : null}
        </div>
      )}

      <div className="clever-empfiehlt__actions">
        {primaryAction ? (
          primaryAction.type === 'call' && (primaryAction.href || telHref) ? (
            <a
              href={primaryAction.href || telHref}
              className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
              onClick={() => onPrimaryAction?.(view, primaryAction)}
            >
              {primaryAction.label}
            </a>
          ) : (
            <button
              type="button"
              className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
              onClick={handlePrimaryClick}
            >
              {primaryAction.label || view.ctaLabel || 'Weiter'}
            </button>
          )
        ) : (
          <button
            type="button"
            className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
            onClick={() => onPrimaryAction?.(view)}
          >
            {view.ctaLabel || view.headline}
          </button>
        )}

        <div className="clever-empfiehlt__actions-row">
          {view.actions
            ?.filter((a) => a !== primaryAction)
            .map((action) => {
              if (action.type === 'offer') {
                return (
                  <button
                    key={action.id}
                    type="button"
                    className="clever-empfiehlt__btn clever-empfiehlt__btn--secondary"
                    onClick={() => onOpenOffer?.(view)}
                  >
                    {action.label}
                  </button>
                );
              }
              if (!action.href) return null;
              return (
                <a
                  key={action.id}
                  href={action.href}
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--secondary"
                  target={action.type === 'whatsapp' ? '_blank' : undefined}
                  rel={action.type === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  onClick={() => onPrimaryAction?.(view, action)}
                >
                  {action.label}
                </a>
              );
            })}
        </div>
      </div>

      {view.doneOption ? (
        <div className="clever-empfiehlt__done">
          <p className="clever-empfiehlt__done-label">Wenn erledigt</p>
          <button
            type="button"
            className="clever-empfiehlt__done-btn"
            onClick={() => onMarkDone?.(view)}
          >
            {view.doneOption.label}
          </button>
          <p className="clever-empfiehlt__done-hint">↓ Clever berechnet sofort neu</p>
        </div>
      ) : null}
    </section>
  );
}
