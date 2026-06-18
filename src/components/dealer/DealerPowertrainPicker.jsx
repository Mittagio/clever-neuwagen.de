import './dealer-landing.css';

/**
 * Antriebswahl innerhalb einer Modellfamilie (z. B. Sportage Benziner vs. Hybrid vs. PHEV).
 */
export default function DealerPowertrainPicker({
  options = [],
  value,
  onChange,
}) {
  if (options.length < 2) return null;

  return (
    <div className="dl-powertrain" aria-label="Antrieb wählen">
      <p className="dl-powertrain__label">Welcher Antrieb?</p>
      <div className="dl-powertrain__cards">
        {options.map((option) => {
          const active = value === option.modelKey;
          return (
            <button
              key={option.modelKey}
              type="button"
              className={`dl-powertrain__card${active ? ' dl-powertrain__card--active' : ''}`}
              onClick={() => onChange?.(option.modelKey)}
              aria-pressed={active}
            >
              <span className="dl-powertrain__card-title">{option.label}</span>
              <span className="dl-powertrain__card-sub">{option.subline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
