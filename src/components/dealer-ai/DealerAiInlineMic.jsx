import { useCallback, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  parseConversationSpeech,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import { IconMic } from './AkteIcons.jsx';

export default function DealerAiInlineMic({
  onTranscript,
  onParsed,
  onListeningChange = null,
  disabled = false,
  variant = 'side',
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  const supported = isSpeechRecognitionSupported();
  const isFab = variant === 'fab';
  const isToolbar = variant === 'toolbar';

  const setListeningState = useCallback((next) => {
    setListening(next);
    onListeningChange?.(next);
  }, [onListeningChange]);

  const handleStart = useCallback(() => {
    if (!supported || disabled) return;
    setError('');
    setListeningState(true);
    startSpeechRecognition({
      onResult: ({ finalText }) => {
        if (!finalText) return;
        onTranscript?.(finalText);
        onParsed?.(parseConversationSpeech(finalText));
      },
      onError: (msg) => {
        setError(msg);
        setListeningState(false);
      },
      onEnd: () => setListeningState(false),
    });
  }, [disabled, onParsed, onTranscript, setListeningState, supported]);

  const rootClass = [
    'dai-inline-mic',
    isFab ? 'dai-inline-mic--fab' : '',
    isToolbar ? 'dai-inline-mic--toolbar' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={`dai-inline-mic__btn${listening ? ' dai-inline-mic__btn--active' : ''}`}
        onClick={handleStart}
        disabled={disabled || !supported || listening}
        aria-label={listening ? 'Aufnahme läuft' : 'Spracheingabe starten'}
        title={supported ? 'Spracheingabe' : 'Spracheingabe nicht verfügbar'}
      >
        {isToolbar ? <IconMic /> : <span aria-hidden>🎤</span>}
      </button>
      {error && !isFab && !isToolbar && <p className="dai-inline-mic__error" role="alert">{error}</p>}
    </div>
  );
}
