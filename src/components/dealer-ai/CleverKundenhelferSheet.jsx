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
  setExclusiveChipInGroup,
  toggleKundenhelferChip,
} from '../../services/cleverKundenhelfer.js';
import { buildKundenhelferDisplayNotes } from '../../services/dealer/kundenhelferSavePayload.js';
import { buildCustomerUnderstanding } from '../../services/dealer/customerUnderstanding.js';
import {
  KUNDENWISSEN_CATEGORY_ORDER,
  buildKundenwissenOverview,
  getKundenwissenCategory,
  getPredefinedChipsForCategory,
  suggestKundenwissenCategory,
} from '../../services/kundenwissenCategories.js';
import {
  HANDOFF_TRADE_IN_OPTIONS,
  VEHICLE_NEED_TIMING_OPTIONS,
} from '../../services/consultation/wishHandoffEnrichment.js';
import {
  HANDOFF_EQUIPMENT_CHIPS,
  SOFT_EQUIPMENT_CATEGORY_CHIPS,
  buildEquipmentChipsForCategory,
  labelsFromEquipmentIds,
} from '../../services/consultation/wishHandoffEquipment.js';
import CustomerAkteConversationNotes from './CustomerAkteConversationNotes.jsx';
import './CleverKundenhelferSheet.css';

const HUB_SECTIONS = [
  { id: 'equipment', label: 'Ausstattung', icon: '💺' },
  { id: 'availability', label: 'Verfügbarkeit', icon: '📅' },
  { id: 'life', label: 'Leben & Alltag', icon: '🏠' },
  { id: 'freetext', label: 'Freitext', icon: '✏️' },
];

const LIFE_CATEGORY_IDS = KUNDENWISSEN_CATEGORY_ORDER.filter((id) => id !== 'unterlagen');

const TIMING_LABELS = VEHICLE_NEED_TIMING_OPTIONS.map((o) => o.label);
const TRADE_IN_LABELS = HANDOFF_TRADE_IN_OPTIONS.map((o) => o.notepadLabel);
const ALL_EQUIPMENT_LABELS = new Set(labelsFromEquipmentIds(
  HANDOFF_EQUIPMENT_CHIPS.map((chip) => chip.id),
));

function SoftChipRow({ label = null, options, value, onSelect, getOptionLabel = (o) => o.label }) {
  return (
    <div className="dai-kh-soft-group">
      {label && <p className="dai-kh-soft-group__label">{label}</p>}
      <div className="dai-kh-chips" role="group" aria-label={label || 'Auswahl'}>
        {options.map((option) => {
          const optionLabel = getOptionLabel(option);
          const selected = value === option.id || value === optionLabel;
          return (
            <button
              key={option.id}
              type="button"
              className={`dai-kh-chip${selected ? ' is-active' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect(option)}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
            <button type="button" className="dai-btn dai-btn--ghost" onClick={togglePlay}>
              {playing ? 'Pause' : 'Abspielen'}
            </button>
            <button type="button" className="dai-btn dai-btn--primary" onClick={savePreview}>
              Speichern
            </button>
            <button type="button" className="dai-btn dai-btn--ghost" onClick={discardPreview}>
              Verwerfen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceMemoItem({ memo, isPlaying, onPlay }) {
  return (
    <button
      type="button"
      className={`dai-kh-memo-item${isPlaying ? ' is-playing' : ''}`}
      onClick={() => onPlay(memo)}
    >
      <span className="dai-kh-memo-item__icon" aria-hidden>{isPlaying ? '⏸' : '▶'}</span>
      <span className="dai-kh-memo-item__line">{formatMemoLine(memo)}</span>
    </button>
  );
}

function patchChipCategories(onChipCategoriesChange, removedLabels = [], added = {}) {
  onChipCategoriesChange?.((prev) => {
    const next = { ...(prev ?? {}) };
    for (const label of removedLabels) {
      delete next[label];
    }
    for (const [label, categoryId] of Object.entries(added)) {
      if (label) next[label] = categoryId;
    }
    return next;
  });
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
  const [sheetView, setSheetView] = useState('hub');
  const [softSection, setSoftSection] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('sonstiges');
  const [editingChip, setEditingChip] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [moreNotesOpen, setMoreNotesOpen] = useState(false);
  const [equipCategory, setEquipCategory] = useState('comfort');

  const playerRef = useRef(null);
  const addInputRef = useRef(null);

  const displayNotes = useMemo(() => {
    const legacyNotes = lead?.crm?.kundenhelfer?.notes ?? '';
    if (lead && buildCustomerUnderstanding(lead)) {
      const insightNotes = buildKundenhelferDisplayNotes(lead);
      return notes !== legacyNotes ? notes : insightNotes;
    }
    return notes || legacyNotes;
  }, [lead, notes]);

  const activeChips = useMemo(
    () => parseKundenhelferNotes(displayNotes),
    [displayNotes],
  );
  const overview = useMemo(
    () => buildKundenwissenOverview(displayNotes, lead, chipCategories),
    [displayNotes, lead, chipCategories],
  );

  const lifeOverview = useMemo(
    () => LIFE_CATEGORY_IDS.map((id) => {
      const found = overview.find((cat) => cat.id === id);
      if (found) return found;
      return {
        ...getKundenwissenCategory(id),
        count: 0,
        items: [],
      };
    }),
    [overview],
  );

  const timingValue = TIMING_LABELS.find((label) => activeChips.includes(label)) ?? null;
  const tradeInValue = TRADE_IN_LABELS.find((label) => activeChips.includes(label)) ?? null;

  const selectedEquipmentIds = useMemo(
    () => HANDOFF_EQUIPMENT_CHIPS
      .filter((chip) => activeChips.includes(chip.label))
      .map((chip) => chip.id),
    [activeChips],
  );

  const equipmentChips = useMemo(
    () => buildEquipmentChipsForCategory(equipCategory, selectedEquipmentIds, []),
    [equipCategory, selectedEquipmentIds],
  );

  const hubCounts = useMemo(() => ({
    equipment: activeChips.filter((chip) => ALL_EQUIPMENT_LABELS.has(chip)).length,
    availability: timingValue ? 1 : 0,
    life: lifeOverview.reduce((sum, cat) => sum + cat.count, 0)
      + (tradeInValue ? 1 : 0),
  }), [activeChips, timingValue, tradeInValue, lifeOverview]);

  const resetSheetNav = useCallback(() => {
    setSheetView('hub');
    setSoftSection(null);
    setActiveCategoryId(null);
    setAddMode(false);
    setAddDraft('');
    setAddCategoryId('sonstiges');
    setEditingChip(null);
    setMoreNotesOpen(false);
    setEquipCategory('comfort');
  }, []);

  useEffect(() => {
    if (!open) {
      playerRef.current?.pause();
      setPlayingId(null);
      resetSheetNav();
      return;
    }
    if (initialCategoryId && LIFE_CATEGORY_IDS.includes(initialCategoryId)) {
      setActiveCategoryId(initialCategoryId);
      setSheetView('detail');
      setSoftSection(null);
      setAddMode(false);
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

  function openHubSection(sectionId) {
    if (sectionId === 'freetext') {
      setSheetView('hub');
      setSoftSection(null);
      setActiveCategoryId(null);
      startAddInfo();
      return;
    }
    setAddMode(false);
    setEditingChip(null);
    if (sectionId === 'life') {
      setSheetView('life');
      setSoftSection(null);
      setActiveCategoryId(null);
      return;
    }
    setSheetView('soft');
    setSoftSection(sectionId);
    setActiveCategoryId(null);
  }

  function openCategory(categoryId) {
    setActiveCategoryId(categoryId);
    setSheetView('detail');
    setAddMode(false);
    setSoftSection(null);
  }

  function backToHub() {
    setSheetView('hub');
    setSoftSection(null);
    setActiveCategoryId(null);
    setAddMode(false);
    setEditingChip(null);
  }

  function backToLife() {
    setSheetView('life');
    setActiveCategoryId(null);
    setAddMode(false);
    setEditingChip(null);
  }

  function startAddInfo() {
    setAddMode(true);
    setAddDraft('');
    setAddCategoryId(activeCategoryId || 'sonstiges');
    setEditingChip(null);
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
    if (sheetView === 'hub' || sheetView === 'life') {
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

  function applyExclusive(groupLabels, nextLabel, categoryId) {
    const before = new Set(parseKundenhelferNotes(notes));
    const nextNotes = setExclusiveChipInGroup(notes, groupLabels, nextLabel);
    const after = new Set(parseKundenhelferNotes(nextNotes));
    const removed = [...before].filter((label) => !after.has(label));
    const added = [...after].filter((label) => !before.has(label));
    onNotesChange?.(nextNotes);
    const addedMap = {};
    for (const label of added) {
      addedMap[label] = categoryId;
    }
    patchChipCategories(onChipCategoriesChange, removed, addedMap);
  }

  function selectTiming(option) {
    applyExclusive(TIMING_LABELS, option.label, 'auto');
  }

  function selectTradeIn(option) {
    applyExclusive(TRADE_IN_LABELS, option.notepadLabel, 'auto');
  }

  function toggleEquipmentLabel(label) {
    const wasActive = activeChips.includes(label);
    onNotesChange?.(toggleKundenhelferChip(notes, label));
    if (wasActive) {
      patchChipCategories(onChipCategoriesChange, [label], {});
    } else {
      patchChipCategories(onChipCategoriesChange, [], { [label]: 'auto' });
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

  const softTitle = HUB_SECTIONS.find((s) => s.id === softSection)?.label;
  const panelTitle = sheetView === 'detail' && activeCategory
    ? activeCategory.label
    : sheetView === 'soft' && softTitle
      ? softTitle
      : sheetView === 'life'
        ? 'Leben & Alltag'
        : 'Clever Kundenhelfer';

  const moreNotesCount = (conversationNotes?.length ?? 0) + (voiceMemos?.length ?? 0);

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title={panelTitle}
      footer={(
        <div className="dai-kh-sheet-footer">
          <button type="button" className="dai-kh-sheet-footer__cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="dai-kh-sheet-footer__apply"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Übernehmen …' : 'Übernehmen'}
          </button>
        </div>
      )}
    >
      <div className="dai-kh-sheet">
        {sheetView === 'hub' && (
          <>
            <div className="dai-kh-hub" role="list">
              {HUB_SECTIONS.map((section) => {
                const count = hubCounts[section.id];
                return (
                  <button
                    key={section.id}
                    type="button"
                    className="dai-kh-hub__chip"
                    role="listitem"
                    onClick={() => openHubSection(section.id)}
                  >
                    <span className="dai-kh-hub__icon" aria-hidden>{section.icon}</span>
                    <span className="dai-kh-hub__label">{section.label}</span>
                    {count > 0 && (
                      <span className="dai-kh-hub__count">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {sheetView === 'soft' && softSection === 'equipment' && (
          <>
            <button type="button" className="dai-kh-back" onClick={backToHub}>
              ← Bereiche
            </button>
            <div className="dai-kh-soft-group">
              <div className="dai-kh-soft-cats" role="group" aria-label="Ausstattungsbereich">
                {SOFT_EQUIPMENT_CATEGORY_CHIPS.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`dai-kh-soft-cat${equipCategory === category.id ? ' is-active' : ''}`}
                    aria-pressed={equipCategory === category.id}
                    onClick={() => setEquipCategory(category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              {equipmentChips.length > 0 ? (
                <div className="dai-kh-chips" role="group" aria-label={equipCategory}>
                  {equipmentChips.map((chip) => {
                    const active = activeChips.includes(chip.label);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`dai-kh-chip${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => toggleEquipmentLabel(chip.label)}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="dai-kh-sheet__empty">Bereits notiert oder keine Vorschläge.</p>
              )}
            </div>
          </>
        )}

        {sheetView === 'soft' && softSection === 'availability' && (
          <>
            <button type="button" className="dai-kh-back" onClick={backToHub}>
              ← Bereiche
            </button>
            <SoftChipRow
              options={VEHICLE_NEED_TIMING_OPTIONS}
              value={VEHICLE_NEED_TIMING_OPTIONS.find((o) => o.label === timingValue)?.id ?? null}
              onSelect={selectTiming}
            />
            <SoftChipRow
              label="Inzahlungnahme"
              options={HANDOFF_TRADE_IN_OPTIONS}
              value={HANDOFF_TRADE_IN_OPTIONS.find((o) => o.notepadLabel === tradeInValue)?.id ?? null}
              onSelect={selectTradeIn}
            />
          </>
        )}

        {sheetView === 'life' && (
          <>
            <button type="button" className="dai-kh-back" onClick={backToHub}>
              ← Bereiche
            </button>
            <div className="dai-kh-cat-grid" role="list">
              {lifeOverview.map((category) => (
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
            <button type="button" className="dai-kh-add-btn" onClick={startAddInfo}>
              + Info hinzufügen
            </button>
          </>
        )}

        {sheetView === 'detail' && activeCategory && (
          <>
            <button
              type="button"
              className="dai-kh-back"
              onClick={LIFE_CATEGORY_IDS.includes(activeCategoryId) ? backToLife : backToHub}
            >
              ← {LIFE_CATEGORY_IDS.includes(activeCategoryId) ? 'Leben & Alltag' : 'Bereiche'}
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
              {LIFE_CATEGORY_IDS.map((id) => {
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

        <div className="dai-kh-more">
          <button
            type="button"
            className="dai-kh-more__toggle"
            aria-expanded={moreNotesOpen}
            onClick={() => setMoreNotesOpen((prev) => !prev)}
          >
            {moreNotesOpen ? '▾' : '▸'}
            {' '}
            Mehr Notizen
            {moreNotesCount > 0 ? ` (${moreNotesCount})` : ''}
          </button>
          {moreNotesOpen && (
            <div className="dai-kh-more__body">
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
          )}
        </div>
      </div>
    </LeadDetailPanel>
  );
}
