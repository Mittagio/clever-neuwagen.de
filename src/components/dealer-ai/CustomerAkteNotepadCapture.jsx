import { useEffect, useMemo, useRef, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import { SELLER_INSIGHT_CONTEXT } from '../../services/dealer/sellerInsights.js';
import {
  extractLastNotepadKeyword,
  organizeInquiryText,
  suggestNotepadLabels,
} from '../../services/dealer/notepadLabelSuggestions.js';
import './CustomerAkte.css';

/**
 * Memo-/Scan-Leiste am Notizzettel (Akten-Verlauf).
 * E-Mail-Start: Verkaufsassistent „Anfrage einfügen“.
 * Hier: Stichwort tippen → Vorschläge (Sitzh → Sitzheizung).
 */
export default function CustomerAkteNotepadCapture({
  sellerInitials = 'VK',
  sellerName = null,
  onCommit,
  isSaving = false,
}) {
  const [mode, setMode] = useState(null);
  const [draft, setDraft] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [selected, setSelected] = useState([]);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const organized = useMemo(() => organizeInquiryText(draft), [draft]);
  const keyword = useMemo(() => extractLastNotepadKeyword(draft), [draft]);
  const typeahead = useMemo(() => {
    if (draft.trim().length > 160 && keyword.length < 4) return [];
    return suggestNotepadLabels(keyword, {
      exclude: organized,
      limit: 6,
    });
  }, [draft, keyword, organized]);

  useEffect(() => {
    setSelected((prev) => {
      const prevOn = new Set(prev.filter((item) => item.on).map((item) => item.label));
      const labels = [...organized];
      for (const item of prev) {
        if (item.on && !labels.includes(item.label)) labels.push(item.label);
      }
      return labels.map((label) => ({
        label,
        on: prevOn.size ? prevOn.has(label) : true,
      }));
    });
  }, [organized]);

  useEffect(() => {
    if (mode === 'memo' || (mode === 'scan' && imageDataUrl)) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [mode, imageDataUrl]);

  function reset() {
    setMode(null);
    setDraft('');
    setImageDataUrl(null);
    setSelected([]);
  }

  function openMemo() {
    setMode('memo');
    setDraft('');
    setImageDataUrl(null);
    setSelected([]);
  }

  function openScan() {
    setMode('scan');
    setDraft('');
    setImageDataUrl(null);
    setSelected([]);
    requestAnimationFrame(() => fileRef.current?.click());
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (dataUrl.startsWith('data:image')) {
        setImageDataUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  function toggleLabel(label) {
    setSelected((prev) => prev.map((item) => (
      item.label === label ? { ...item, on: !item.on } : item
    )));
  }

  function acceptSuggestion(label) {
    setSelected((prev) => {
      if (prev.some((item) => item.label === label)) {
        return prev.map((item) => (item.label === label ? { ...item, on: true } : item));
      }
      return [...prev, { label, on: true }];
    });
    setDraft((prev) => {
      const last = extractLastNotepadKeyword(prev);
      if (!last || last.length < 3) return prev;
      const cut = prev.lastIndexOf(last);
      if (cut < 0) return prev;
      return `${prev.slice(0, cut)}${label}`;
    });
  }

  function handleCommit() {
    const labels = selected.filter((item) => item.on).map((item) => item.label);
    const text = draft.trim() || labels.join(', ');
    if (!text && !imageDataUrl) return;
    if (isSaving) return;

    onCommit?.({
      text: text || 'Notiz-Scan',
      labels,
      context: mode === 'scan'
        ? SELLER_INSIGHT_CONTEXT.HANDWRITTEN_NOTE
        : SELLER_INSIGHT_CONTEXT.VOICE_NOTE,
      attachment: imageDataUrl
        ? { type: 'image', dataUrl: imageDataUrl, createdAt: new Date().toISOString() }
        : null,
    });
    reset();
  }

  const canCommit = Boolean(draft.trim() || selected.some((item) => item.on) || imageDataUrl);
  const badgeTitle = sellerName ? `${sellerName} (${sellerInitials})` : sellerInitials;

  if (!mode) {
    return (
      <div className="cust-akte-kw-capture" aria-label="Ergänzen">
        <button
          type="button"
          className="cust-akte-kw-capture__icon-btn"
          onClick={openMemo}
          disabled={isSaving}
          aria-label="Memo"
          title="Memo / Stichwort"
        >
          <span aria-hidden>🎤</span>
        </button>
        <button
          type="button"
          className="cust-akte-kw-capture__icon-btn"
          onClick={openScan}
          disabled={isSaving}
          aria-label="Scan"
          title="Scan"
        >
          <span aria-hidden>📷</span>
        </button>
        <span className="cust-akte-kw-capture__who" title={badgeTitle}>{sellerInitials}</span>
      </div>
    );
  }

  return (
    <div
      className={`cust-akte-kw-capture cust-akte-kw-capture--open cust-akte-kw-capture--${mode}`}
      aria-label={mode === 'scan' ? 'Scan' : 'Memo'}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="cust-akte-kw-capture__file"
        onChange={handleFileChange}
      />

      <div className="cust-akte-kw-capture__top">
        <span className="cust-akte-kw-capture__who is-active" title={badgeTitle}>
          {sellerInitials}
        </span>
        {mode === 'scan' && (
          <button
            type="button"
            className="cust-akte-kw-capture__icon-btn"
            onClick={() => fileRef.current?.click()}
            disabled={isSaving}
            aria-label="Foto"
            title="Foto"
          >
            <span aria-hidden>📷</span>
          </button>
        )}
        <DealerAiInlineMic
          variant="fab"
          disabled={isSaving}
          onTranscript={(text) => {
            setDraft((prev) => (prev ? `${prev} ${text}` : text));
          }}
        />
        <button
          type="button"
          className="cust-akte-kw-capture__icon-btn cust-akte-kw-capture__icon-btn--ghost"
          onClick={reset}
          disabled={isSaving}
          aria-label="Abbrechen"
          title="Abbrechen"
        >
          <span aria-hidden>✕</span>
        </button>
        <button
          type="button"
          className="cust-akte-kw-capture__icon-btn cust-akte-kw-capture__icon-btn--ok"
          onClick={handleCommit}
          disabled={isSaving || !canCommit}
          aria-label="Übernehmen"
          title="Übernehmen"
        >
          <span aria-hidden>✓</span>
        </button>
      </div>

      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt=""
          className="cust-akte-kw-capture__thumb"
        />
      )}

      <textarea
        ref={inputRef}
        className="cust-akte-kw-capture__input"
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={isSaving}
        aria-label="Text"
        placeholder={mode === 'scan' ? '…' : 'Stichwort tippen, z. B. Sitzh …'}
      />

      {typeahead.length > 0 && (
        <div className="cust-akte-kw-capture__suggest" role="listbox" aria-label="Stichwort-Vorschläge">
          {typeahead.map((label) => (
            <button
              key={`suggest-${label}`}
              type="button"
              className="cust-akte-kw-capture__suggest-chip"
              role="option"
              onClick={() => acceptSuggestion(label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="cust-akte-kw-capture__chips" role="group" aria-label="Chips">
          {selected.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`cust-akte-kw-capture__chip${item.on ? ' is-on' : ''}`}
              aria-pressed={item.on}
              onClick={() => toggleLabel(item.label)}
            >
              <span>{item.label}</span>
              <span className="cust-akte-kw-capture__chip-badge" aria-hidden>
                {sellerInitials}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
