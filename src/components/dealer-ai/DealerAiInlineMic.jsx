import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  parseConversationSpeech,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import { IconMic } from './AkteIcons.jsx';

/** Soft errors: Session bleibt aktiv (Cursor-Prinzip: Aufnahme bis Stopp). */
const SOFT_SPEECH_ERRORS = new Set(['no-speech', 'aborted']);

function IconMicStop(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden
      className="cn-line-icon"
      {...props}
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

/**
 * Composer-Mikrofon: Toggle wie Cursor.
 * Start → bleibt an (continuous) → erneut klicken = Stopp.
 */
export default function DealerAiInlineMic({
  onTranscript,
  onParsed,
  onInterim = null,
  onListeningChange = null,
  disabled = false,
  variant = 'side',
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef(null);

  const supported = isSpeechRecognitionSupported();
  const isFab = variant === 'fab';
  const isToolbar = variant === 'toolbar';

  const setListeningState = useCallback((next) => {
    setListening(next);
    onListeningChange?.(next);
  }, [onListeningChange]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    keepListeningRef.current = false;
    clearRestartTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop?.();
    } catch {
      try {
        rec?.abort?.();
      } catch {
        /* ignore */
      }
    }
    setListeningState(false);
  }, [clearRestartTimer, setListeningState]);

  const beginRecognition = useCallback(() => {
    if (!supported || disabled) return;
    setError('');
    keepListeningRef.current = true;
    setListeningState(true);

    const startInstance = () => {
      if (!keepListeningRef.current) return;
      clearRestartTimer();
      try {
        recognitionRef.current = startSpeechRecognition({
          continuous: true,
          interim: true,
          onResult: ({ finalText, interimText }) => {
            if (interimText) onInterim?.(interimText);
            if (!finalText) return;
            onTranscript?.(finalText);
            onParsed?.(parseConversationSpeech(finalText));
          },
          onError: (msg, code) => {
            if (SOFT_SPEECH_ERRORS.has(code)) return;
            setError(msg);
            keepListeningRef.current = false;
            clearRestartTimer();
            recognitionRef.current = null;
            setListeningState(false);
          },
          onEnd: () => {
            recognitionRef.current = null;
            if (!keepListeningRef.current) {
              setListeningState(false);
              return;
            }
            // Chrome beendet oft nach Pause – Session bewusst weiterführen
            restartTimerRef.current = window.setTimeout(() => {
              restartTimerRef.current = null;
              if (keepListeningRef.current) startInstance();
            }, 120);
          },
        });
      } catch {
        keepListeningRef.current = false;
        setListeningState(false);
        setError('Spracheingabe konnte nicht gestartet werden.');
      }
    };

    startInstance();
  }, [
    clearRestartTimer,
    disabled,
    onInterim,
    onParsed,
    onTranscript,
    setListeningState,
    supported,
  ]);

  const handleToggle = useCallback(() => {
    if (!supported || disabled) return;
    if (keepListeningRef.current || listening) {
      stopRecognition();
      return;
    }
    beginRecognition();
  }, [beginRecognition, disabled, listening, stopRecognition, supported]);

  useEffect(() => () => {
    keepListeningRef.current = false;
    clearRestartTimer();
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, [clearRestartTimer]);

  const rootClass = [
    'dai-inline-mic',
    isFab ? 'dai-inline-mic--fab' : '',
    isToolbar ? 'dai-inline-mic--toolbar' : '',
    listening ? 'dai-inline-mic--listening' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={`dai-inline-mic__btn${listening ? ' dai-inline-mic__btn--active' : ''}`}
        onClick={handleToggle}
        disabled={disabled || !supported}
        aria-pressed={listening}
        aria-label={listening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
        title={
          !supported
            ? 'Spracheingabe nicht verfügbar'
            : (listening ? 'Aufnahme stoppen' : 'Spracheingabe – erneut klicken zum Stoppen')
        }
      >
        {isToolbar
          ? (listening ? <IconMicStop /> : <IconMic />)
          : <span aria-hidden>{listening ? '⏹' : '🎤'}</span>}
      </button>
      {error && !isFab && !isToolbar ? (
        <p className="dai-inline-mic__error" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
