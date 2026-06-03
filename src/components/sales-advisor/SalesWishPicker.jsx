import { CONVERSATION_CHIP_GROUPS } from '../../data/salesAdvisorChips.js';
import SalesVoiceInput from './SalesVoiceInput.jsx';
import './smartSales.css';

export default function SalesWishPicker({
  selectedIds = [],
  onToggle,
  onFind,
  onVoiceParsed,
  disabled = false,
}) {
  return (
    <div className="ss-wish-picker">
      <header className="ss-wish-picker__head">
        <h1>Was sucht Ihr Kunde?</h1>
        <p>Sprechen oder klicken Sie die Wünsche an. Clever-Neuwagen findet passende Fahrzeuge automatisch.</p>
      </header>

      <SalesVoiceInput onParsed={onVoiceParsed} disabled={disabled} />

      {CONVERSATION_CHIP_GROUPS.map((group) => (
        <section key={group.id} className="ss-chip-group">
          <h2 className="ss-chip-group__title">{group.label}</h2>
          <div className="ss-chip-grid">
            {group.chips.map((chip) => {
              const active = selectedIds.includes(chip.id);
              return (
                <button
                  key={`${group.id}-${chip.id}`}
                  type="button"
                  className={`ss-chip${active ? ' ss-chip--active' : ''}`}
                  onClick={() => onToggle(chip.id)}
                  aria-pressed={active}
                >
                  <span className="ss-chip__emoji" aria-hidden>{chip.emoji}</span>
                  <span className="ss-chip__label">{chip.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="ss-wish-picker__cta">
        <button
          type="button"
          className="ss-btn ss-btn--primary ss-btn--xl"
          onClick={onFind}
          disabled={disabled || selectedIds.length === 0}
        >
          Weiter zur Bedarfsanalyse
        </button>
      </div>
    </div>
  );
}
