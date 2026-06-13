import './dealer-landing.css';

const STEP_LABELS = {
  recommend: 'Fahrzeug',
  understand: 'Ausstattung',
  trim: 'Ausstattung',
  special: 'Nutzung',
  purchase: 'Zahlungsart',
  budget: 'Budget',
  summary: 'Zusammenfassung',
  offer: 'Angebot',
};

/**
 * Hinweis nach Reload – Beratung wird fortgesetzt.
 */
export default function DealerJourneyResumeBanner({ salesStep, onDismiss }) {
  const label = STEP_LABELS[salesStep] ?? 'Ihrer Beratung';
  if (!salesStep || salesStep === 'recommend') return null;

  return (
    <div className="dl-journey-resume" role="status">
      <p className="dl-journey-resume__text">
        Sie haben diese Beratung schon begonnen – wir setzen bei
        {' '}
        <strong>{label}</strong>
        {' '}
        fort.
      </p>
      {onDismiss && (
        <button type="button" className="dl-journey-resume__dismiss" onClick={onDismiss}>
          Verstanden
        </button>
      )}
    </div>
  );
}
