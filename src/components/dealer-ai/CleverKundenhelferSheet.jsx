import { useCallback, useEffect, useRef, useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import {
  KUNDENHELFER_CHIPS,
  addCustomKundenhelferChip,
  blobToDataUrl,
  createVoiceMemoId,
  formatMemoDuration,
  formatMemoLine,
  getCustomKundenhelferChips,
  parseKundenhelferNotes,
  replaceKundenhelferChip,
  toggleKundenhelferChip,
} from '../../services/cleverKundenhelfer.js';
import CustomerAkteConversationNotes from './CustomerAkteConversationNotes.jsx';
import './CleverKundenhelferSheet.css';

function VoiceMemoRecorder({ onSave, disabled }) {
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const previewBlobRef = useRef(null);
  const secondsRef = useRef(0);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [cleanupStream, previewUrl]);

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mikrofon in diesem Browser nicht verfügbar.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        previewBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewDuration(secondsRef.current);
        setPhase('preview');
        cleanupStream();
      };
      recorder.start(200);
      secondsRef.current = 0;
      setSeconds(0);
      setPhase('recording');
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= 120) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setError('Mikrofon-Zugriff nicht möglich.');
      cleanupStream();
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupStream();
    }
  }

  function discardRecording() {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    cleanupStream();
    secondsRef.current = 0;
    setSeconds(0);
    setPhase('idle');
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    previewBlobRef.current = null;
    setSeconds(0);
    setPreviewDuration(0);
    setPlaying(false);
    audioRef.current?.pause();
    setPhase('idle');
  }

  async function savePreview() {
    if (!previewBlobRef.current) return;
    const dataUrl = await blobToDataUrl(previewBlobRef.current);
    onSave?.({
      id: createVoiceMemoId(),
      createdAt: new Date().toISOString(),
      durationSec: previewDuration || seconds,
      audioDataUrl: dataUrl,
      transcript: null,
    });
    discardPreview();
  }

  function togglePlay() {
    if (!audioRef.current || !previewUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    audioRef.current.play();
    setPlaying(true);
  }

  return (
    <div className="dai-kh-memo">
      <div className="dai-kh-memo__head">
        <p className="dai-kh-memo__title">Sprachnotiz</p>
        <p className="dai-kh-memo__hint">Nur für interne Verkaufsnotizen.</p>
      </div>

      {error && <p className="dai-kh-memo__error" role="alert">{error}</p>}

      {phase === 'idle' && (
        <button
          type="button"
          className="dai-kh-memo__record-btn"
          onClick={startRecording}
          disabled={disabled}
        >
          <span className="dai-kh-memo__mic" aria-hidden>🎙</span>
          Memo aufnehmen
        </button>
      )}

      {phase === 'recording' && (
        <div className="dai-kh-memo__recording" aria-live="polite">
          <span className="dai-kh-memo__dot" aria-hidden />
          <span className="dai-kh-memo__time">{formatMemoDuration(seconds)}</span>
          <button type="button" className="dai-btn dai-btn--primary" onClick={stopRecording}>
            Stoppen
          </button>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={discardRecording}>
            Verwerfen
          </button>
        </div>
      )}

      {phase === 'preview' && previewUrl && (
        <div className="dai-kh-memo__preview">
          <audio
            ref={audioRef}
            src={previewUrl}
            onEnded={() => setPlaying(false)}
            className="dai-kh-memo__audio"
          />
          <p className="dai-kh-memo__preview-meta">
            Aufnahme · {formatMemoDuration(previewDuration || seconds)}
          </p>
          <div className="dai-kh-memo__preview-actions">
            <button type="button" className="dai-btn dai-btn--secondary" onClick={togglePlay}>
              {playing ? 'Pause' : 'Anhören'}
            </button>
            <button type="button" className="dai-btn dai-btn--primary" onClick={savePreview}>
              Speichern
            </button>
            <button type="button" className="dai-btn dai-btn--ghost" onClick={discardPreview}>
              Neu aufnehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceMemoItem({ memo, onPlay, isPlaying }) {
  return (
    <div className="dai-kh-memo-item">
      <p className="dai-kh-memo-item__label">
        <span aria-hidden>🎙</span> {formatMemoLine(memo)}
      </p>
      <button
        type="button"
        className="dai-kh-memo-item__play"
        onClick={() => onPlay(memo)}
      >
        {isPlaying ? 'Pause' : 'Anhören'}
      </button>
      {memo.transcript && (
        <p className="dai-kh-memo-item__transcript">{memo.transcript}</p>
      )}
      {!memo.transcript && (
        <button type="button" className="dai-kh-memo-item__transcribe" disabled title="Bald verfügbar">
          In Text umwandeln
        </button>
      )}
    </div>
  );
}

export default function CleverKundenhelferSheet({
  open,
  onClose,
  notes,
  onNotesChange,
  voiceMemos = [],
  onVoiceMemosChange,
  conversationNotes = [],
  onConversationNotesChange,
  vehicleCards = [],
  onSave,
  isSaving = false,
}) {
  const [playingId, setPlayingId] = useState(null);
  const [customEditMode, setCustomEditMode] = useState(null);
  const [customDraft, setCustomDraft] = useState('');
  const [editingChip, setEditingChip] = useState(null);
  const playerRef = useRef(null);
  const customInputRef = useRef(null);

  const activeChips = parseKundenhelferNotes(notes);
  const customChips = getCustomKundenhelferChips(notes);
  const isAddingCustom = customEditMode === 'add';
  const isEditingCustom = customEditMode === 'edit';

  const resetCustomEdit = useCallback(() => {
    setCustomEditMode(null);
    setCustomDraft('');
    setEditingChip(null);
  }, []);

  useEffect(() => {
    if (!open) {
      playerRef.current?.pause();
      setPlayingId(null);
      resetCustomEdit();
    }
  }, [open, resetCustomEdit]);

  useEffect(() => {
    if (open && customEditMode && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [open, customEditMode, customDraft]);

  function toggleChip(chip) {
    resetCustomEdit();
    onNotesChange?.(toggleKundenhelferChip(notes, chip));
  }

  function startAddCustom() {
    if (isAddingCustom) {
      resetCustomEdit();
      return;
    }
    setCustomEditMode('add');
    setCustomDraft('');
    setEditingChip(null);
  }

  function startEditCustom(chip) {
    setCustomEditMode('edit');
    setCustomDraft(chip);
    setEditingChip(chip);
  }

  function commitCustomChip() {
    const trimmed = customDraft.trim();
    if (!trimmed) {
      if (isEditingCustom && editingChip) {
        onNotesChange?.(toggleKundenhelferChip(notes, editingChip));
      }
      resetCustomEdit();
      return;
    }

    if (isEditingCustom && editingChip) {
      onNotesChange?.(replaceKundenhelferChip(notes, editingChip, trimmed));
    } else {
      onNotesChange?.(addCustomKundenhelferChip(notes, trimmed));
    }
    resetCustomEdit();
  }

  function handleCustomKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitCustomChip();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetCustomEdit();
    }
  }

  function handlePlayMemo(memo) {
    if (playingId === memo.id) {
      playerRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!memo.audioDataUrl) return;
    if (!playerRef.current) {
      playerRef.current = new Audio();
      playerRef.current.onended = () => setPlayingId(null);
    }
    playerRef.current.src = memo.audioDataUrl;
    playerRef.current.play();
    setPlayingId(memo.id);
  }

  function handleMemoSaved(memo) {
    onVoiceMemosChange?.([memo, ...voiceMemos]);
  }

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Clever Kundenhelfer"
      footer={(
        <div className="dai-sheet-actions">
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="dai-btn dai-btn--primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Speichern …' : 'Speichern'}
          </button>
        </div>
      )}
    >
      <div className="dai-kh-sheet">
        <p className="dai-kh-sheet__subline">Kleine Details fürs nächste Gespräch.</p>

        <div className="dai-kh-chips-wrap">
          <div className="dai-kh-chips" role="group" aria-label="Schnell-Bemerkungen">
            <button
              type="button"
              className={`dai-kh-chip dai-kh-chip--add${isAddingCustom ? ' is-active' : ''}`}
              onClick={startAddCustom}
              aria-pressed={isAddingCustom}
            >
              + Weitere Info
            </button>

            {customChips.map((chip) => {
              const isEditing = isEditingCustom && editingChip === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  className={`dai-kh-chip dai-kh-chip--custom is-active${isEditing ? ' is-editing' : ''}`}
                  onClick={() => startEditCustom(chip)}
                  aria-pressed
                >
                  {chip}
                </button>
              );
            })}

            {KUNDENHELFER_CHIPS.map((chip) => {
              const active = activeChips.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  className={`dai-kh-chip${active ? ' is-active' : ''}`}
                  onClick={() => toggleChip(chip)}
                  aria-pressed={active}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {customEditMode && (
            <div className="dai-kh-custom-edit">
              <input
                ref={customInputRef}
                type="text"
                className="dai-kh-custom-edit__input"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                placeholder="z. B. Gebrauchtwagen BMW"
                aria-label={isEditingCustom ? 'Eigene Info bearbeiten' : 'Neue Info eingeben'}
              />
              <div className="dai-kh-custom-edit__actions">
                <button
                  type="button"
                  className="dai-btn dai-btn--primary dai-kh-custom-edit__confirm"
                  onClick={commitCustomChip}
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  className="dai-btn dai-btn--ghost"
                  onClick={resetCustomEdit}
                >
                  Abbrechen
                </button>
              </div>
              <p className="dai-kh-custom-edit__hint">
                Enter zum Übernehmen · Leer lassen und übernehmen entfernt den Chip
              </p>
            </div>
          )}
        </div>

        <CustomerAkteConversationNotes
          notes={conversationNotes}
          onChange={onConversationNotesChange}
          vehicleCards={vehicleCards}
          disabled={isSaving}
        />

        <VoiceMemoRecorder onSave={handleMemoSaved} disabled={isSaving} />

        {voiceMemos.length > 0 ? (
          <div className="dai-kh-memo-list">
            <p className="dai-kh-memo-list__title">Gespeicherte Memos</p>
            {voiceMemos.map((memo) => (
              <VoiceMemoItem
                key={memo.id}
                memo={memo}
                isPlaying={playingId === memo.id}
                onPlay={handlePlayMemo}
              />
            ))}
          </div>
        ) : (
          <p className="dai-kh-memo-empty">Noch kein Memo</p>
        )}
      </div>
    </LeadDetailPanel>
  );
}
