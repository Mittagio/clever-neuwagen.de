import './dealer-landing.css';

const CLASSIC_STEPS = [
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'trim', label: 'Ausstattung' },
  { id: 'payment', label: 'Zahlungsart' },
  { id: 'usage', label: 'Nutzung' },
  { id: 'offer', label: 'Angebot' },
  { id: 'inquiry', label: 'Anfrage' },
];

const CLEVER_STEPS = [
  { id: 'consult', label: 'Beratung' },
  { id: 'recommendation', label: 'Passende Richtung' },
  { id: 'handoff', label: 'Verkäufer' },
  { id: 'inquiry', label: 'Anfrage' },
];

function resolveClassicIndex(salesStep) {
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

function resolveCleverIndex(salesStep) {
  switch (salesStep) {
    case 'consult': return 0;
    case 'recommendation': return 1;
    case 'handoff': return 2;
    case 'understand':
    case 'trim':
    case 'purchase':
    case 'special':
    case 'summary':
    case 'offer': return 3;
    default: return 0;
  }
}

/**
 * Fortschrittsleiste – klassischer Konfigurator oder Frag-Clever-Beratung.
 */
export default function DealerJourneyProgress({ salesStep, flowKind = 'classic' }) {
  const isClever = flowKind === 'clever';
  const steps = isClever ? CLEVER_STEPS : CLASSIC_STEPS;
  const activeIndex = isClever
    ? resolveCleverIndex(salesStep)
    : resolveClassicIndex(salesStep);

  return (
    <nav className="dl-journey-progress" aria-label="Beratungsfortschritt">
      <ol className="dl-journey-progress__list">
        {steps.map((step, index) => {
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
