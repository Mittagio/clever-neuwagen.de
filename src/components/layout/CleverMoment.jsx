import { IconSparkle } from '../dealer-ai/AkteIcons.jsx';

/**
 * CleverMoment – same component for mobile (inline/sheet) and desktop (assist rail).
 * Presentational only; no business logic.
 */
export default function CleverMoment({
  title = 'Clever',
  eyebrow = null,
  body = null,
  children = null,
  primaryLabel = null,
  onPrimary = null,
  secondaryLabel = null,
  onSecondary = null,
  empty = false,
  emptyText = 'Kein aktueller Hinweis.',
  className = '',
}) {
  if (empty && !children && !body) {
    return (
      <section className={`cn-clever-moment cn-clever-moment--empty ${className}`.trim()} aria-label="Clever">
        <p className="cn-clever-moment__eyebrow">
          <IconSparkle />
          {' '}
          Clever
        </p>
        <p className="cn-clever-moment__empty">{emptyText}</p>
        {primaryLabel ? (
          <div className="cn-clever-moment__actions">
            <button type="button" className="cn-clever-moment__btn cn-clever-moment__btn--primary" onClick={onPrimary}>
              {primaryLabel}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`cn-clever-moment ${className}`.trim()} aria-label={title}>
      <p className="cn-clever-moment__eyebrow">
        <IconSparkle />
        {' '}
        {eyebrow || 'Clever'}
      </p>
      <h2 className="cn-clever-moment__title">{title}</h2>
      {body ? <p className="cn-clever-moment__body">{body}</p> : null}
      {children}
      {(primaryLabel || secondaryLabel) ? (
        <div className="cn-clever-moment__actions">
          {primaryLabel ? (
            <button type="button" className="cn-clever-moment__btn cn-clever-moment__btn--primary" onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : null}
          {secondaryLabel ? (
            <button type="button" className="cn-clever-moment__btn" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
