import { useCallback, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  parseConversationSpeech,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import './smartSales.css';

export default function SalesVoiceInput({ onParsed, disabled = false }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');

  const handleStart = useCallback(() => {
    setError('');
    setInterim('');
    setListening(true);
    startSpeechRecognition({
      onResult: ({ finalText, interimText }) => {
        if (interimText) setInterim(interimText);
        if (finalText) {
          const parsed = parseConversationSpeech(finalText);
          onParsed?.(parsed);
          setInterim('');
        }
      },
      onError: (msg) => {
        setError(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  }, [onParsed]);

  const supported = isSpeechRecognitionSupported();

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
        <p className="ss-voice__hint">Spracheingabe in diesem Browser nicht verfügbar – bitte Chips nutzen.</p>
      )}
      {interim && <p className="ss-voice__interim">{interim}</p>}
      {error && <p className="ss-voice__error">{error}</p>}
    </div>
  );
}
