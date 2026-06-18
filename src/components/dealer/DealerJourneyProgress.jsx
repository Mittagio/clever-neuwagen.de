import './dealer-landing.css';

const JOURNEY_STEPS = [
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'trim', label: 'Ausstattung' },
  { id: 'payment', label: 'Zahlungsart' },
  { id: 'usage', label: 'Nutzung' },
  { id: 'offer', label: 'Angebot' },
  { id: 'inquiry', label: 'Anfrage' },
];

function resolveActiveIndex(salesStep) {
  switch (salesStep) {
    case 'recommend': return 0;
    case 'understand':
    case 'trim': return 1;
    case 'purchase':
    case 'budget': return 2;
    case 'special': return 3;
    case 'summary': return 4;
    case 'offer': return 5;
    default: return 0;
  }
}

/**
 * Fortschrittsleiste – Fahrzeug → Ausstattung → Wünsche → Konditionen → Sonderrabatte → Anfrage.
 */
export default function DealerJourneyProgress({ salesStep }) {
  const activeIndex = resolveActiveIndex(salesStep);

  return (
    <nav className="dl-journey-progress" aria-label="Beratungsfortschritt">
      <ol className="dl-journey-progress__list">
        {JOURNEY_STEPS.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          const state = isComplete ? 'complete' : isActive ? 'active' : 'upcoming';

          return (
            <li
              key={step.id}
              className={`dl-journey-progress__item dl-journey-progress__item--${state}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="dl-journey-progress__marker" aria-hidden>
                {isComplete ? '✓' : index + 1}
              </span>
              <span className="dl-journey-progress__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
