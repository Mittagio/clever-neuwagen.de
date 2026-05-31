const STEPS = [
  { id: 'wishes', label: 'Wünsche' },
  { id: 'result', label: 'Empfehlung' },
  { id: 'offer', label: 'Angebot' },
];

export default function EquipmentFlowProgress({ currentStep, completed = false }) {
  const currentIndex = completed
    ? STEPS.length
    : STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav className="eq-flow-progress" aria-label="Fortschritt">
      <ol className="eq-flow-progress__list">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = step.id === currentStep && !completed;
          return (
            <li
              key={step.id}
              className={`eq-flow-progress__step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
            >
              <span className="eq-flow-progress__dot">{isDone ? '✓' : index + 1}</span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
