import './discovery-results.css';

export default function UnderstoodSearchChips({ chips = [], onEditChip }) {
  if (!chips.length) return null;

  return (
    <div className="disc-understood" aria-label="Verstandene Suche">
      <div className="disc-understood__chips">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="disc-understood__chip"
            onClick={() => onEditChip?.(chip)}
          >
            <span className="disc-understood__check" aria-hidden>✓</span>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
