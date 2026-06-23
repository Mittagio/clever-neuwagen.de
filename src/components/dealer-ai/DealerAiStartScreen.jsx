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
  const canEvaluate = Boolean(text?.trim());

  function appendTranscript(spoken) {
    onTextChange?.(text?.trim() ? `${text.trim()} ${spoken}` : spoken);
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
                Kundendaten, Wunsch oder Nachricht eingeben.
              </p>
            </div>
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
            {isAnalyzing ? 'Wird ausgewertet …' : 'Clever starten'}
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
            <h3 className="dai-entry__title">Clever-Beratung</h3>
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
            <h3 className="dai-entry__title">Modell wählen</h3>
            <p className="dai-entry__text">
              Kunde weiß schon, was er möchte? Modell auswählen und direkt loslegen.
            </p>
          </div>
          <span className="dai-entry__chev" aria-hidden>›</span>
        </button>
      </div>

      <CleverLexikon
        className="dai-start__lexikon"
        subline="Fahrzeugwissen schnell nachschlagen."
        placeholder="z. B. EV4 Länge, EV5 Kofferraum, Sportage Batterie"
        showChips={false}
      />
    </section>
  );
}
