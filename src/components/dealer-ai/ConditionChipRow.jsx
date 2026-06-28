import './condition-chips.css';

/**
 * Einheitliche Konditions-Chips (Clever Auswahl, Konfigurator, Panel-Header).
 */
export default function ConditionChipRow({ chips = [], label = null, className = '' }) {
  if (!chips.length) return null;
  return (
    <div className={`cn-cond-chips-wrap${className ? ` ${className}` : ''}`}>
      {label && (
        <span className="cn-cond-chips-wrap__label">{label}</span>
      )}
      <div className="cn-cond-chips">
        {chips.map((chip) => (
          <span key={chip} className="cn-cond-chip">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConditionChipButton({
  children,
  active = false,
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`cn-cond-chip cn-cond-chip--btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
