import { useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import './DealerAiStart.css';

const PLACEHOLDER = 'z. B. SUV, Benziner, Automatik, ca. 250 €, Rückfahrkamera';

const INPUT_MODES = [
  { id: 'paste', label: 'Einfügen', icon: '📋' },
  { id: 'speak', label: 'Sprechen', icon: '🎤' },
  { id: 'type', label: 'Tippen', icon: '⌨' },
];

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
  const [inputMode, setInputMode] = useState('paste');
  const canEvaluate = Boolean(text?.trim());

  function appendTranscript(spoken) {
    onTextChange?.(text?.trim() ? `${text.trim()} ${spoken}` : spoken);
  }

  function handleModeChange(mode) {
    setInputMode(mode);
    if (mode === 'type' || mode === 'paste') {
      inputRef?.current?.focus();
    }
  }

  return (
    <section className="dai-start" aria-label="Einstieg Verkaufsassistent">
      {carryCustomer?.contact?.name && (
        <p className="dai-start__carry" role="status">
          <strong>{carryCustomer.contact.name.replace('Kunde (offen)', '').trim()}</strong>
          {' '}wird übernommen – jetzt den neuen Wunsch erfassen.
        </p>
      )}
      <div className="dai-start__stack">
        <article className="dai-entry dai-entry--hero">
          <div className="dai-entry__head">
            <div className="dai-entry__icon dai-entry__icon--blue" aria-hidden>⚡</div>
            <div className="dai-entry__body">
              <h2 className="dai-entry__title">Clever KI-Check</h2>
              <p className="dai-entry__text">
                Kundenwunsch eintippen, sprechen oder Nachricht einfügen.
              </p>
            </div>
          </div>

          <div className="dai-mode-tabs" role="tablist" aria-label="Eingabeart">
            {INPUT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={inputMode === mode.id}
                className={`dai-mode-tab${inputMode === mode.id ? ' is-active' : ''}`}
                onClick={() => handleModeChange(mode.id)}
              >
                <span aria-hidden>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>

          <div className="dai-capture">
            <textarea
              id="dai-quick-capture"
              ref={inputRef}
              className="dai-capture__field"
              rows={4}
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
            className="dai-cta dai-cta--primary"
            onClick={onEvaluate}
            disabled={!canEvaluate || isAnalyzing}
          >
            <span className="dai-cta__spark" aria-hidden>✦</span>
            {isAnalyzing ? 'Wird ausgewertet …' : 'Kundenwunsch auswerten'}
          </button>
        </article>

        <button
          type="button"
          className="dai-entry dai-entry--link"
          onClick={onStartAdvice}
          disabled={isAnalyzing}
        >
          <div className="dai-entry__icon dai-entry__icon--green" aria-hidden>💬</div>
          <div className="dai-entry__body">
            <h2 className="dai-entry__title">Clever-Beratung</h2>
            <p className="dai-entry__text">
              Schritt für Schritt zum passenden Fahrzeug – ideal, wenn der Kunde noch offen ist.
            </p>
          </div>
          <span className="dai-entry__chev" aria-hidden>›</span>
        </button>

        <button
          type="button"
          className="dai-entry dai-entry--link"
          onClick={onStartModel}
          disabled={isAnalyzing}
        >
          <div className="dai-entry__icon dai-entry__icon--purple" aria-hidden>🚗</div>
          <div className="dai-entry__body">
            <h2 className="dai-entry__title">Modell wählen</h2>
            <p className="dai-entry__text">
              Kunde weiß schon, was er möchte? Modell auswählen und direkt loslegen.
            </p>
          </div>
          <span className="dai-entry__chev" aria-hidden>›</span>
        </button>
      </div>
    </section>
  );
}
