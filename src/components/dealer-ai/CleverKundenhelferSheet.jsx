import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import {
  KUNDENHELFER_CHIPS,
  addCustomKundenhelferChip,
  blobToDataUrl,
  createVoiceMemoId,
  formatMemoDuration,
  formatMemoLine,
  parseKundenhelferNotes,
  replaceKundenhelferChip,
  toggleKundenhelferChip,
} from '../../services/cleverKundenhelfer.js';
import {
  KUNDENWISSEN_CATEGORY_ORDER,
  buildKundenwissenOverview,
  getKundenwissenCategory,
  getPredefinedChipsForCategory,
  suggestKundenwissenCategory,
} from '../../services/kundenwissenCategories.js';
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
  lead = null,
  initialCategoryId = null,
  chipCategories = {},
  onChipCategoriesChange,
  onSave,
  isSaving = false,
}) {
  const [sheetView, setSheetView] = useState('categories');
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('sonstiges');
  const [editingChip, setEditingChip] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const playerRef = useRef(null);
  const addInputRef = useRef(null);

  const activeChips = parseKundenhelferNotes(notes);
  const overview = useMemo(
    () => buildKundenwissenOverview(notes, lead, chipCategories),
    [notes, lead, chipCategories],
  );

  const resetSheetNav = useCallback(() => {
    setSheetView('categories');
    setActiveCategoryId(null);
    setAddMode(false);
    setAddDraft('');
    setAddCategoryId('sonstiges');
    setEditingChip(null);
  }, []);

  useEffect(() => {
    if (!open) {
      playerRef.current?.pause();
      setPlayingId(null);
      resetSheetNav();
      return;
    }
    if (initialCategoryId) {
      setActiveCategoryId(initialCategoryId);
      setSheetView('detail');
    } else {
      resetSheetNav();
    }
  }, [open, initialCategoryId, resetSheetNav]);

  useEffect(() => {
    if (open && addMode && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [open, addMode]);

  const activeCategory = activeCategoryId
    ? getKundenwissenCategory(activeCategoryId)
    : null;

  const categoryDetail = overview.find((cat) => cat.id === activeCategoryId) ?? {
    ...getKundenwissenCategory(activeCategoryId ?? 'sonstiges'),
    count: 0,
    items: [],
  };

  const predefinedForCategory = getPredefinedChipsForCategory(
    activeCategoryId ?? 'sonstiges',
    KUNDENHELFER_CHIPS,
  );

  function openCategory(categoryId) {
    setActiveCategoryId(categoryId);
    setSheetView('detail');
    setAddMode(false);
  }

  function backToCategories() {
    setSheetView('categories');
    setActiveCategoryId(null);
    setAddMode(false);
    setEditingChip(null);
  }

  function startAddInfo() {
    setAddMode(true);
    setAddDraft('');
    setAddCategoryId('sonstiges');
    setEditingChip(null);
    if (sheetView === 'detail' && activeCategoryId) {
      setAddCategoryId(activeCategoryId);
    }
  }

  function cancelAddInfo() {
    setAddMode(false);
    setAddDraft('');
    setEditingChip(null);
  }

  function commitAddInfo() {
    const trimmed = addDraft.trim();
    if (!trimmed) {
      cancelAddInfo();
      return;
    }
    if (editingChip) {
      onNotesChange?.(replaceKundenhelferChip(notes, editingChip, trimmed));
      if (editingChip !== trimmed) {
        onChipCategoriesChange?.((prev) => {
          const next = { ...(prev ?? {}) };
          delete next[editingChip];
          next[trimmed] = addCategoryId;
          return next;
        });
      } else {
        onChipCategoriesChange?.((prev) => ({
          ...(prev ?? {}),
          [trimmed]: addCategoryId,
        }));
      }
    } else {
      onNotesChange?.(addCustomKundenhelferChip(notes, trimmed));
      onChipCategoriesChange?.((prev) => ({
        ...(prev ?? {}),
        [trimmed]: addCategoryId,
      }));
    }
    cancelAddInfo();
    if (sheetView === 'categories') {
      setActiveCategoryId(addCategoryId);
      setSheetView('detail');
    }
  }

  function handleAddDraftChange(value) {
    setAddDraft(value);
    if (!editingChip) {
      setAddCategoryId(suggestKundenwissenCategory(value));
    }
  }

  function toggleChip(chip) {
    const wasActive = activeChips.includes(chip);
    onNotesChange?.(toggleKundenhelferChip(notes, chip));
    if (wasActive) {
      onChipCategoriesChange?.((prev) => {
        const next = { ...(prev ?? {}) };
        delete next[chip];
        return next;
      });
    } else if (activeCategoryId) {
      onChipCategoriesChange?.((prev) => ({
        ...(prev ?? {}),
        [chip]: activeCategoryId,
      }));
    }
  }

  function startEditItem(raw) {
    if (String(raw).startsWith('unterlagen:')) return;
    setEditingChip(raw);
    setAddDraft(raw);
    setAddCategoryId(chipCategories[raw] ?? categorizeChip(raw));
    setAddMode(true);
  }

  function categorizeChip(chip) {
    return suggestKundenwissenCategory(chip);
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

  function handleAddKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitAddInfo();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelAddInfo();
    }
  }

  const panelTitle = sheetView === 'detail' && activeCategory
    ? activeCategory.label
    : 'Clever Kundenhelfer';

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title={panelTitle}
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
        {sheetView === 'categories' && (
          <>
            <p className="dai-kh-sheet__subline">Wählen Sie einen Bereich.</p>

            {overview.length > 0 ? (
              <div className="dai-kh-cat-grid" role="list">
                {overview.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="dai-kh-cat-tile"
                    onClick={() => openCategory(category.id)}
                  >
                    <span className="dai-kh-cat-tile__icon" aria-hidden>{category.icon}</span>
                    <span className="dai-kh-cat-tile__label">{category.label}</span>
                    <span className="dai-kh-cat-tile__count">
                      {category.count}
                      {' '}
                      Info{category.count === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="dai-kh-sheet__empty">Noch keine Infos hinterlegt.</p>
            )}

            <button type="button" className="dai-kh-add-btn" onClick={startAddInfo}>
              + Info hinzufügen
            </button>
          </>
        )}

        {sheetView === 'detail' && activeCategory && (
          <>
            <button type="button" className="dai-kh-back" onClick={backToCategories}>
              ← Bereiche
            </button>

            <div className="dai-kh-detail-list">
              {categoryDetail.items.length > 0 ? (
                <ul className="dai-kh-detail-items">
                  {categoryDetail.items.map((item) => (
                    <li key={item.raw}>
                      {item.readOnly ? (
                        <span className="dai-kh-detail-item dai-kh-detail-item--readonly">
                          {item.display}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="dai-kh-detail-item is-active"
                          onClick={() => startEditItem(item.raw)}
                        >
                          {item.display}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dai-kh-sheet__empty">Noch keine Infos in diesem Bereich.</p>
              )}
            </div>

            {predefinedForCategory.length > 0 && (
              <div className="dai-kh-suggestions">
                <p className="dai-kh-suggestions__label">Hinzufügen</p>
                <div className="dai-kh-chips" role="group" aria-label={`Vorschläge ${activeCategory.label}`}>
                  {predefinedForCategory.map((chip) => {
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
              </div>
            )}

            <button type="button" className="dai-kh-add-btn" onClick={startAddInfo}>
              + Info hinzufügen
            </button>
          </>
        )}

        {addMode && (
          <div className="dai-kh-custom-edit">
            <label className="dai-kh-custom-edit__label" htmlFor="dai-kh-add-input">
              {editingChip ? 'Info bearbeiten' : 'Neue Info'}
            </label>
            <input
              id="dai-kh-add-input"
              ref={addInputRef}
              type="text"
              className="dai-kh-custom-edit__input"
              value={addDraft}
              onChange={(e) => handleAddDraftChange(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="z. B. Kaffee schwarz"
            />
            <label className="dai-kh-custom-edit__label" htmlFor="dai-kh-add-category">
              Kategorie
            </label>
            <select
              id="dai-kh-add-category"
              className="dai-kh-custom-edit__select"
              value={addCategoryId}
              onChange={(e) => setAddCategoryId(e.target.value)}
            >
              {KUNDENWISSEN_CATEGORY_ORDER.filter((id) => id !== 'unterlagen').map((id) => {
                const cat = getKundenwissenCategory(id);
                return (
                  <option key={id} value={id}>{cat.label}</option>
                );
              })}
            </select>
            <div className="dai-kh-custom-edit__actions">
              <button
                type="button"
                className="dai-btn dai-btn--primary dai-kh-custom-edit__confirm"
                onClick={commitAddInfo}
              >
                Übernehmen
              </button>
              <button type="button" className="dai-btn dai-btn--ghost" onClick={cancelAddInfo}>
                Abbrechen
              </button>
            </div>
            <p className="dai-kh-custom-edit__hint">
              Kategorie wird automatisch vorgeschlagen · Enter zum Übernehmen
            </p>
          </div>
        )}

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
