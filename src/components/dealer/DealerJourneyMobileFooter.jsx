import './dealer-landing.css';

const STEP_LABELS = {
  recommend: 'Passendes Modell wählen',
  understand: 'Ausstattung wählen',
  special: 'Nutzung wählen',
  purchase: 'Zahlungsart wählen',
  budget: 'Budget festlegen',
  summary: 'Zusammenfassung',
  offer: 'Anfrage absenden',
};

/**
 * Sticky Footer auf dem Handy – ein klarer „Weiter“-Schritt statt vieler Buttons.
 */
export default function DealerJourneyMobileFooter({
  salesStep,
  title,
  subtitle,
  stepLabel,
  actionLabel = 'Weiter',
  actionHint = null,
  onAction,
  disabled = false,
}) {
  if (!salesStep || !onAction) return null;

  const kicker = stepLabel ?? STEP_LABELS[salesStep] ?? 'Weiter';

  return (
    <footer className="dl-journey-footer dl-journey-footer--calm" aria-label="Nächster Beratungsschritt">
      <div className="dl-journey-footer__inner">
        <div className="dl-journey-footer__copy">
          <p className="dl-journey-footer__step">{kicker}</p>
          {title && <p className="dl-journey-footer__title">{title}</p>}
          {subtitle && (
            <p className={`dl-journey-footer__subtitle${disabled ? ' dl-journey-footer__subtitle--muted' : ''}`}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary dl-journey-footer__cta"
          onClick={onAction}
          disabled={disabled}
        >
          {actionLabel}
        </button>
        {actionHint && (
          <p className="dl-journey-footer__hint">{actionHint}</p>
        )}
      </div>
    </footer>
  );
}
