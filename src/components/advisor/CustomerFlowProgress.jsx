import './AdvisorComponents.css';

const STEPS = [
  { id: 'beratung', label: 'Beratung' },
  { id: 'vergleich', label: 'Vergleich' },
  { id: 'angebot', label: 'Angebot' },
  { id: 'kontakt', label: 'Kontakt' },
];

export default function CustomerFlowProgress({ currentStep, completed = false }) {
  const currentIndex = completed
    ? STEPS.length
    : STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav className="adv-flow-progress" aria-label="Fortschritt">
      <ol className="adv-flow-progress__list">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = step.id === currentStep;
          return (
            <li
              key={step.id}
              className={`adv-flow-progress__step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
            >
              <span className="adv-flow-progress__dot" aria-hidden="true">
                {isDone ? '✓' : index + 1}
              </span>
              <span className="adv-flow-progress__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <div
        className="adv-flow-progress__bar"
        style={{ '--progress': `${Math.max(0, currentIndex) / (STEPS.length - 1) * 100}%` }}
        aria-hidden="true"
      />
    </nav>
  );
}
