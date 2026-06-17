import { useCallback, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  parseConversationSpeech,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';

export default function DealerAiInlineMic({
  onTranscript,
  onParsed,
  disabled = false,
  variant = 'side',
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  const supported = isSpeechRecognitionSupported();
  const isFab = variant === 'fab';

  const handleStart = useCallback(() => {
    if (!supported || disabled) return;
    setError('');
    setListening(true);
    startSpeechRecognition({
      onResult: ({ finalText }) => {
        if (!finalText) return;
        onTranscript?.(finalText);
        onParsed?.(parseConversationSpeech(finalText));
      },
      onError: (msg) => {
        setError(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  }, [disabled, onParsed, onTranscript, supported]);

  return (
    <div className={`dai-inline-mic${isFab ? ' dai-inline-mic--fab' : ''}`}>
      <button
        type="button"
        className={`dai-inline-mic__btn${listening ? ' dai-inline-mic__btn--active' : ''}`}
        onClick={handleStart}
        disabled={disabled || !supported || listening}
        aria-label={listening ? 'Aufnahme läuft' : 'Spracheingabe starten'}
        title={supported ? 'Spracheingabe' : 'Spracheingabe nicht verfügbar'}
      >
        <span aria-hidden>🎤</span>
      </button>
      {error && !isFab && <p className="dai-inline-mic__error" role="alert">{error}</p>}
    </div>
  );
}
