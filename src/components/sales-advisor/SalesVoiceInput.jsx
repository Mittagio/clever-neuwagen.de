import { useCallback, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  parseConversationSpeech,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import './smartSales.css';

const TEXT_PLACEHOLDER = 'z. B. Herr Müller sucht einen SUV, maximal 400 Euro, Sitzheizung und Anhängerkupplung';

export default function SalesVoiceInput({ onParsed, disabled = false, variant = 'full' }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [typedText, setTypedText] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);

  const applyParsed = useCallback((parsed) => {
    if (parsed?.chipIds?.length || parsed?.customerName || parsed?.transcript) {
      onParsed?.(parsed);
    }
  }, [onParsed]);

  const handleStart = useCallback(() => {
    setError('');
    setInterim('');
    setListening(true);
    startSpeechRecognition({
      onResult: ({ finalText, interimText }) => {
        if (interimText) setInterim(interimText);
        if (finalText) {
          applyParsed(parseConversationSpeech(finalText));
          setInterim('');
        }
      },
      onError: (msg) => {
        setError(msg);
        setListening(false);
        setShowTextFallback(true);
      },
      onEnd: () => setListening(false),
    });
  }, [applyParsed]);

  const handleTypedSubmit = useCallback(() => {
    const text = typedText.trim();
    if (!text) return;
    setError('');
    applyParsed(parseConversationSpeech(text));
    setTypedText('');
  }, [typedText, applyParsed]);

  const supported = isSpeechRecognitionSupported();

  const isAssistant = variant === 'assistant';

  return (
    <div className="ss-voice">
      <button
        type="button"
        className={`ss-voice__btn${listening ? ' ss-voice__btn--active' : ''}`}
        onClick={handleStart}
        disabled={disabled || !supported || listening}
      >
        <span aria-hidden>🎤</span>
        {listening ? 'Aufnahme …' : 'Gespräch aufnehmen'}
      </button>

      {!supported && (
        <p className="ss-voice__hint">
          Spracheingabe in diesem Browser nicht verfügbar – bitte Wunsch eintippen oder Chips nutzen.
        </p>
      )}

      {supported && (
        <p className="ss-voice__hint">
          {isAssistant
            ? 'Ideal im Kundengespräch. Alternativ können Sie den Wunsch eintippen oder anklicken.'
            : 'Mikrofon nutzt Chrome/Google – bei Firmen-WLAN ggf. nicht verfügbar. Alternativ eintippen.'}
        </p>
      )}

      {interim && <p className="ss-voice__interim">{interim}</p>}
      {error && <p className="ss-voice__error" role="alert">{error}</p>}

      {!isAssistant && (
        <div className="ss-voice__text-fallback">
          <label className="ss-voice__text-label" htmlFor="ss-voice-text">
            {showTextFallback ? 'Gespräch eintippen (empfohlen)' : 'Oder Kundengespräch eintippen'}
          </label>
          <textarea
            id="ss-voice-text"
            className="ss-voice__text-input"
            rows={3}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={TEXT_PLACEHOLDER}
            disabled={disabled}
          />
          <button
            type="button"
            className="ss-btn ss-btn--secondary ss-voice__text-submit"
            onClick={handleTypedSubmit}
            disabled={disabled || !typedText.trim()}
          >
            Aus Gesprächstext auswerten
          </button>
        </div>
      )}
    </div>
  );
}
