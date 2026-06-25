import { useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import CleverLexikon from '../backend/CleverLexikon.jsx';
import './DealerAiStart.css';

const PLACEHOLDER = 'z. B. SUV, Benziner, Automatik, ca. 250 €, Rückfahrkamera';

export default function DealerAiStartScreen({
  text = '',
  onTextChange,
  onVoiceParsed,
  onEvaluate,
  onStartAdvice,
  onStartModel,
  isAnalyzing = false,
  inputRef,
  carryCustomer = null,
}) {
  const [showLexikon, setShowLexikon] = useState(false);
  const canEvaluate = Boolean(text?.trim());

  function appendTranscript(spoken) {
    onTextChange?.(text?.trim() ? `${text.trim()} ${spoken}` : spoken);
  }

  return (
    <section className="dai-start dai-start--calm" aria-label="Einstieg Verkaufsassistent">
      {carryCustomer?.contact?.name && (
        <p className="dai-start__carry" role="status">
          <strong>{carryCustomer.contact.name.replace('Kunde (offen)', '').trim()}</strong>
          {' '}wird übernommen – jetzt den neuen Wunsch erfassen.
        </p>
      )}

      <header className="dai-start__hero">
        <h1 className="dai-start__headline">Was sucht Ihr Kunde?</h1>
      </header>

      <div className="dai-capture dai-capture--hero">
        <textarea
          id="dai-quick-capture"
          ref={inputRef}
          className="dai-capture__field dai-capture__field--hero"
          rows={5}
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={isAnalyzing}
        />
        <DealerAiInlineMic
          variant="fab"
          onTranscript={appendTranscript}
          onParsed={onVoiceParsed}
          disabled={isAnalyzing}
        />
      </div>

      <button
        type="button"
        className="dai-cta dai-cta--primary dai-cta--hero"
        onClick={onEvaluate}
        disabled={!canEvaluate || isAnalyzing}
      >
        {isAnalyzing ? 'Wird ausgewertet …' : 'Clever starten'}
      </button>

      <div className="dai-start__alt">
        <p className="dai-start__alt-label">oder direkt starten</p>
        <nav className="dai-start__alt-nav" aria-label="Weitere Einstiege">
          <button
            type="button"
            className="dai-start__alt-link"
            onClick={onStartAdvice}
            disabled={isAnalyzing}
          >
            Clever Beratung
          </button>
          <span className="dai-start__alt-sep" aria-hidden>·</span>
          <button
            type="button"
            className="dai-start__alt-link"
            onClick={onStartModel}
            disabled={isAnalyzing}
          >
            Modell wählen
          </button>
          <span className="dai-start__alt-sep" aria-hidden>·</span>
          <button
            type="button"
            className={`dai-start__alt-link${showLexikon ? ' is-active' : ''}`}
            onClick={() => setShowLexikon((open) => !open)}
            disabled={isAnalyzing}
            aria-expanded={showLexikon}
          >
            Lexikon
          </button>
        </nav>
      </div>

      {showLexikon && (
        <CleverLexikon
          className="dai-start__lexikon-panel"
          subline=""
          placeholder="z. B. EV4 Länge, Sportage Batterie"
          showChips={false}
        />
      )}
    </section>
  );
}
