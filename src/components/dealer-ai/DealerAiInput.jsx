import { DEALER_AI_EXAMPLES } from '../../services/dealerAiParser.js';

export default function DealerAiInput({
  value,
  onChange,
  onAnalyze,
  onExampleSelect,
  onSpeechStart,
  speechHint,
  isAnalyzing,
  inputRef,
}) {
  return (
    <section className="dai-input-section">
      <label htmlFor="dealer-ai-input" className="dai-input-label">
        Was möchten Sie einstellen oder anbieten?
      </label>
      <textarea
        id="dealer-ai-input"
        ref={inputRef}
        className="dai-input"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Beschreiben Sie einfach, was Sie einstellen oder anbieten möchten…"
      />

      <div className="dai-input-actions">
        <button
          type="button"
          className="dai-btn dai-btn--mic"
          onClick={onSpeechStart}
          aria-label="Spracheingabe starten"
        >
          🎤 Spracheingabe starten
        </button>
        <button
          type="button"
          className="dai-btn dai-btn--primary"
          onClick={onAnalyze}
          disabled={!value.trim() || isAnalyzing}
        >
          {isAnalyzing ? 'Analysiere…' : 'Analysieren'}
        </button>
      </div>

      {speechHint && (
        <p className="dai-speech-hint" role="status">{speechHint}</p>
      )}

      <div className="dai-chips" aria-label="Beispiele">
        {DEALER_AI_EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className="dai-chip"
            onClick={() => onExampleSelect(ex.text)}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
