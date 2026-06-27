import { useEffect, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import CleverLexikon from '../backend/CleverLexikon.jsx';
import './DealerAiStart.css';

const PLACEHOLDER_EXAMPLES = [
  'Claus Clever sucht einen Elektro-Kleinwagen mit AHK, 48 Monate, 10.000 km/Jahr, bis 350 €.',
  'Familie Müller möchte einen Sportage Plug-in-Hybrid, 36 Monate Leasing, 15.000 km pro Jahr.',
  'Herr Weber will einen EV4 mit AHK – Finanzierung, Termin am Freitag im Showroom.',
  'Kundin sucht Kleinwagen Benziner, bis 280 € monatlich, sofort verfügbar.',
];

function useTypewriterPlaceholder(examples) {
  const [display, setDisplay] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const full = examples[exampleIdx] ?? '';
    let timeoutId;

    if (!isDeleting && display.length < full.length) {
      timeoutId = window.setTimeout(() => {
        setDisplay(full.slice(0, display.length + 1));
      }, 34);
    } else if (!isDeleting && display.length === full.length) {
      timeoutId = window.setTimeout(() => setIsDeleting(true), 2600);
    } else if (isDeleting && display.length > 0) {
      timeoutId = window.setTimeout(() => {
        setDisplay(full.slice(0, display.length - 1));
      }, 16);
    } else if (isDeleting && display.length === 0) {
      setIsDeleting(false);
      setExampleIdx((prev) => (prev + 1) % examples.length);
    }

    return () => window.clearTimeout(timeoutId);
  }, [display, exampleIdx, examples, isDeleting]);

  return display;
}

export default function DealerAiStartScreen({
  text = '',
  onTextChange,
  onVoiceParsed,
  onEvaluate,
  onStartModel,
  onStartShowroom,
  isAnalyzing = false,
  inputRef,
  carryCustomer = null,
}) {
  const [showLexikon, setShowLexikon] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const typewriterText = useTypewriterPlaceholder(PLACEHOLDER_EXAMPLES);
  const canEvaluate = Boolean(text?.trim());
  const showTypewriter = !text.trim() && !fieldFocused;

  function appendTranscript(spoken) {
    onTextChange?.(text?.trim() ? `${text.trim()} ${spoken}` : spoken);
  }

  return (
    <section className="dai-start dai-start--calm" aria-label="Einstieg Verkaufsassistent">
      {carryCustomer?.contact?.name && (
        <p className="dai-start__carry" role="status">
          <strong>{carryCustomer.contact.name.replace('Kunde (offen)', '').trim()}</strong>
          {' '}
          wird übernommen – jetzt den neuen Wunsch erfassen.
        </p>
      )}

      <div className="dai-start__magic-hero">
        <header className="dai-start__hero">
          <h1 className="dai-start__headline">Clever Beratung ✨</h1>
          <p className="dai-start__hero-subline">
            Schreib oder sprich einfach, was der Kunde sagt.
            <br />
            Clever erkennt daraus Auto, Bezahlung, Kunde und Notiz.
          </p>
        </header>

        <div className="dai-capture dai-capture--hero dai-capture--magic">
          <div className="dai-capture__field-wrap">
            {showTypewriter && (
              <div className="dai-capture__typewriter" aria-hidden>
                <span className="dai-capture__typewriter-text">{typewriterText}</span>
                <span className="dai-capture__typewriter-cursor" />
              </div>
            )}
            <textarea
              id="dai-quick-capture"
              ref={inputRef}
              className="dai-capture__field dai-capture__field--hero"
              rows={6}
              value={text}
              onChange={(e) => onTextChange?.(e.target.value)}
              onFocus={() => setFieldFocused(true)}
              onBlur={() => setFieldFocused(false)}
              placeholder=""
              disabled={isAnalyzing}
              aria-label="Kundenwunsch frei eingeben"
              aria-describedby="dai-capture-hint"
            />
          </div>
          <DealerAiInlineMic
            variant="fab"
            onTranscript={appendTranscript}
            onParsed={onVoiceParsed}
            disabled={isAnalyzing}
          />
        </div>

        <p id="dai-capture-hint" className="dai-start__paste-hint">
          Text kopieren, einfügen oder einfach diktieren.
        </p>

        <button
          type="button"
          className="dai-cta dai-cta--primary dai-cta--hero dai-cta--magic"
          onClick={onEvaluate}
          disabled={!canEvaluate || isAnalyzing}
        >
          {isAnalyzing ? 'Wird ausgewertet …' : 'Clever starten'}
        </button>
      </div>

      <div className="dai-start__path">
        <button
          type="button"
          className="dai-entry dai-entry--tile"
          onClick={onStartShowroom}
          disabled={isAnalyzing}
        >
          <span className="dai-entry__icon dai-entry__icon--green" aria-hidden>📱</span>
          <span className="dai-entry__body">
            <span className="dai-entry__title">Showroom Modus</span>
            <span className="dai-entry__text">Mobil am Auto, im Showroom oder spontan im Gespräch.</span>
          </span>
          <span className="dai-entry__chev" aria-hidden>›</span>
        </button>

        <button
          type="button"
          className="dai-entry dai-entry--tile"
          onClick={onStartModel}
          disabled={isAnalyzing}
        >
          <span className="dai-entry__icon dai-entry__icon--purple" aria-hidden>🚗</span>
          <span className="dai-entry__body">
            <span className="dai-entry__title">Modell wählen</span>
            <span className="dai-entry__text">Direkt starten, wenn das Modell schon feststeht.</span>
          </span>
          <span className="dai-entry__chev" aria-hidden>›</span>
        </button>

        <button
          type="button"
          className={`dai-entry dai-entry--tile dai-entry--lexikon${showLexikon ? ' is-active' : ''}`}
          onClick={() => setShowLexikon((open) => !open)}
          disabled={isAnalyzing}
          aria-expanded={showLexikon}
        >
          <span className="dai-entry__icon dai-entry__icon--blue" aria-hidden>📖</span>
          <span className="dai-entry__body">
            <span className="dai-entry__title">Clever-Lexikon</span>
            <span className="dai-entry__text">Technik und Ausstattung schnell nachschlagen.</span>
          </span>
          <span className="dai-entry__chev" aria-hidden>{showLexikon ? '⌃' : '›'}</span>
        </button>
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
