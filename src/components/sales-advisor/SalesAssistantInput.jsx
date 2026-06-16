import { ASSISTANT_CHIP_GROUPS } from '../../data/salesAdvisorChips.js';
import SalesVoiceInput from './SalesVoiceInput.jsx';
import SalesWishPicker from './SalesWishPicker.jsx';
import '../sales-advisor/smartSales.css';
import './SalesAssistantInput.css';

const TEXT_PLACEHOLDER =
  'z. B. Kunde sucht SUV, Benziner, Automatik, ca. 250 € Rate, Rückfahrkamera und Sitzheizung';

export default function SalesAssistantInput({
  text = '',
  onTextChange,
  selectedChipIds = [],
  onToggleChip,
  onVoiceParsed,
  onEvaluate,
  isAnalyzing = false,
  inputRef,
  hasVoiceTranscript = false,
}) {
  const hasText = Boolean(text?.trim());
  const hasChips = selectedChipIds.length > 0;
  const canEvaluate = hasText || hasChips || hasVoiceTranscript;

  return (
    <section className="sa-input" aria-label="Kundenwunsch erfassen">
      <SalesVoiceInput
        variant="assistant"
        onParsed={onVoiceParsed}
        disabled={isAnalyzing}
      />

      <div className="sa-input__text-block">
        <label htmlFor="sa-customer-wish" className="sa-input__label">
          Kundenwunsch eintippen oder Nachricht einfügen
        </label>
        <textarea
          id="sa-customer-wish"
          ref={inputRef}
          className="sa-input__textarea"
          rows={4}
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder={TEXT_PLACEHOLDER}
          disabled={isAnalyzing}
        />
      </div>

      <section className="sa-input__analysis-block" aria-label="Optionale Bedarfsanalyse">
        <SalesWishPicker
          className="sa-input__wish-picker"
          title="Optionale Bedarfsanalyse"
          subtitle="Fahrzeugtyp, Antrieb, Angebotsart, Budget und Ausstattung direkt anklicken."
          chipGroups={ASSISTANT_CHIP_GROUPS}
          selectedIds={selectedChipIds}
          onToggle={onToggleChip}
          disabled={isAnalyzing}
          showVoiceInput={false}
          showActions={false}
        />
      </section>

      <div className="sa-input__cta">
        {!canEvaluate && (
          <p className="sa-input__help">
            Bitte sprechen, schreiben oder mindestens einen Wunsch anklicken.
          </p>
        )}
        <button
          type="button"
          className="ss-btn ss-btn--primary ss-btn--xl"
          onClick={onEvaluate}
          disabled={!canEvaluate || isAnalyzing}
        >
          {isAnalyzing ? 'Wird ausgewertet …' : 'Kundenwunsch auswerten'}
        </button>
      </div>
    </section>
  );
}
