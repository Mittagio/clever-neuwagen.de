import './dealer-landing.css';

const JOURNEY_STEPS = [
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'wishes', label: 'Wünsche' },
  { id: 'trim', label: 'Ausstattung' },
  { id: 'conditions', label: 'Konditionen' },
  { id: 'offer', label: 'Angebot' },
];

function resolveActiveIndex(salesStep) {
  switch (salesStep) {
    case 'recommend': return 0;
    case 'understand': return 1;
    case 'trim': return 2;
    case 'special':
    case 'purchase':
    case 'summary': return 3;
    case 'offer': return 4;
    default: return 0;
  }
}

/**
 * Fortschrittsleiste – Fahrzeug → Wünsche → Ausstattung → Konditionen → Angebot.
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
