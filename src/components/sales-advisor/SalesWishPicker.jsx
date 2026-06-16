import { CONVERSATION_CHIP_GROUPS } from '../../data/salesAdvisorChips.js';
import SalesVoiceInput from './SalesVoiceInput.jsx';
import './smartSales.css';

export default function SalesWishPicker({
  title = 'Was sucht Ihr Kunde?',
  subtitle = 'Sprechen, schreiben oder anklicken – Clever-Neuwagen fasst den Wunsch zusammen und schlägt passende Fahrzeuge vor.',
  chipGroups = CONVERSATION_CHIP_GROUPS,
  selectedIds = [],
  onToggle,
  onFind,
  onEvaluate,
  onVoiceParsed,
  disabled = false,
  hasTranscript = false,
  showVoiceInput = true,
  showActions = true,
  showSecondaryAction = true,
  evaluateLabel = 'Kundenwunsch auswerten',
  findLabel = 'Weiter zur Bedarfsanalyse',
  className = '',
}) {
  return (
    <div className={`ss-wish-picker ${className}`.trim()}>
      <header className="ss-wish-picker__head">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>

      {showVoiceInput && <SalesVoiceInput onParsed={onVoiceParsed} disabled={disabled} />}

      {chipGroups.map((group) => (
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

      {showActions && (
        <div className="ss-wish-picker__cta">
          <button
            type="button"
            className="ss-btn ss-btn--primary ss-btn--xl"
            onClick={onEvaluate}
            disabled={disabled || (selectedIds.length === 0 && !hasTranscript)}
          >
            {evaluateLabel}
          </button>
          {showSecondaryAction && (
            <button
              type="button"
              className="ss-btn ss-btn--secondary ss-btn--xl"
              onClick={onFind}
              disabled={disabled || selectedIds.length === 0}
            >
              {findLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
