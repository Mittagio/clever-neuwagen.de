import { useEffect, useId, useRef, useState } from 'react';
import {
  LIVE_EDIT_EDITOR,
  PAYMENT_OPTIONS,
  liveEditFieldLabel,
  resolveLiveEditEditor,
} from '../../services/cleverSeller/liveEditFactMeta.js';
import { searchVerifiedVehicleOptions } from '../../services/cleverSeller/liveEditVehicleOptions.js';
import './SellerReviewFactChipEditor.css';

const TERM_PRESETS = [24, 36, 48, 60];
const KM_PRESETS = [10000, 12500, 15000, 20000];
const COLOR_PRESETS = ['Schwarz', 'Weiß', 'Grau', 'Blau', 'Rot', 'Silber'];
const EQUIPMENT_PRESETS = ['AHK', 'Wärmepumpe', 'Navi', 'Leder', 'Panzerung'];

/**
 * Feld-spezifischer Inline-Editor am Chip (kein Modal, kein Seitenwechsel).
 * ENTER speichern · ESC abbrechen · TAB navigiert.
 */
export default function SellerReviewFactChipEditor({
  chip = null,
  onSave = null,
  onCancel = null,
}) {
  const field = chip?.field || null;
  const editor = chip?.editor || resolveLiveEditEditor(field);
  const inputId = useId();
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [vehicleHits, setVehicleHits] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    if (!chip) return;
    const initial = chip.value != null && typeof chip.value !== 'object'
      ? String(chip.value)
      : String(chip.label || '');
    if (editor === LIVE_EDIT_EDITOR.TERM) {
      const n = Number(String(chip.value ?? chip.label || '').replace(/\D/g, ''));
      setDraft(Number.isFinite(n) && n > 0 ? String(n) : '');
      setCustomMode(Boolean(n) && !TERM_PRESETS.includes(n));
    } else if (editor === LIVE_EDIT_EDITOR.KM) {
      const n = Number(String(chip.value ?? '').toString().replace(/\D/g, ''))
        || Number(String(chip.label || '').replace(/\./g, '').replace(/\D/g, ''));
      setDraft(Number.isFinite(n) && n > 0 ? String(n) : '');
      setCustomMode(Boolean(n) && !KM_PRESETS.includes(n));
    } else if (editor === LIVE_EDIT_EDITOR.PAYMENT) {
      setDraft(String(chip.value || '').toLowerCase() || 'leasing');
    } else if (editor === LIVE_EDIT_EDITOR.VEHICLE) {
      setDraft(String(chip.label || ''));
      setSelectedVehicle(null);
      setVehicleHits(searchVerifiedVehicleOptions(String(chip.label || ''), { limit: 6 }));
    } else if (editor === LIVE_EDIT_EDITOR.MONEY) {
      const n = Number(chip.value);
      setDraft(Number.isFinite(n) ? String(n) : String(chip.label || '').replace(/[^\d]/g, ''));
    } else {
      setDraft(initial);
    }
    setError('');
  }, [chip, editor]);

  useEffect(() => {
    if (!chip) return;
    const t = setTimeout(() => inputRef.current?.focus?.(), 20);
    return () => clearTimeout(t);
  }, [chip?.field, chip?.label]);

  if (!chip || !editor) return null;

  const title = liveEditFieldLabel(field);

  function commit(raw = draft) {
    let payload = raw;
    if (editor === LIVE_EDIT_EDITOR.VEHICLE) {
      payload = selectedVehicle || raw;
    }
    const result = onSave?.({ field, value: payload, label: chip.label, editor });
    if (result && result.ok === false) {
      setError(result.error || 'Ungültig');
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
    }
  }

  return (
    <div
      className="srf-chip-editor"
      role="group"
      aria-label={`${title} korrigieren`}
      onKeyDown={onKeyDown}
    >
      <label className="srf-chip-editor__label" htmlFor={inputId}>{title}</label>

      {editor === LIVE_EDIT_EDITOR.TERM ? (
        <div className="srf-chip-editor__row">
          <div className="srf-chip-editor__segments" role="group" aria-label="Laufzeit">
            {TERM_PRESETS.map((months) => (
              <button
                key={months}
                type="button"
                className={`srf-chip-editor__seg${Number(draft) === months && !customMode ? ' is-active' : ''}`}
                onClick={() => {
                  setCustomMode(false);
                  setDraft(String(months));
                  commit(String(months));
                }}
              >
                {months}
              </button>
            ))}
            <button
              type="button"
              className={`srf-chip-editor__seg${customMode ? ' is-active' : ''}`}
              onClick={() => setCustomMode(true)}
            >
              Eigene
            </button>
          </div>
          {customMode ? (
            <input
              id={inputId}
              ref={inputRef}
              className="srf-chip-editor__input"
              type="number"
              inputMode="numeric"
              min={6}
              max={96}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : null}
        </div>
      ) : null}

      {editor === LIVE_EDIT_EDITOR.KM ? (
        <div className="srf-chip-editor__row">
          <div className="srf-chip-editor__segments srf-chip-editor__segments--wrap" role="group">
            {KM_PRESETS.map((km) => (
              <button
                key={km}
                type="button"
                className={`srf-chip-editor__seg${Number(draft) === km && !customMode ? ' is-active' : ''}`}
                onClick={() => {
                  setCustomMode(false);
                  setDraft(String(km));
                  commit(String(km));
                }}
              >
                {km >= 1000 ? `${(km / 1000).toLocaleString('de-DE')}k` : km}
              </button>
            ))}
            <button
              type="button"
              className={`srf-chip-editor__seg${customMode ? ' is-active' : ''}`}
              onClick={() => setCustomMode(true)}
            >
              Eigene
            </button>
          </div>
          {customMode ? (
            <input
              id={inputId}
              ref={inputRef}
              className="srf-chip-editor__input"
              type="number"
              inputMode="numeric"
              min={1000}
              step={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : null}
        </div>
      ) : null}

      {editor === LIVE_EDIT_EDITOR.PAYMENT ? (
        <div className="srf-chip-editor__segments" role="group" aria-label="Zahlungsart">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`srf-chip-editor__seg${draft === opt.id ? ' is-active' : ''}`}
              onClick={() => {
                setDraft(opt.id);
                commit(opt.id);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {editor === LIVE_EDIT_EDITOR.COLOR ? (
        <div className="srf-chip-editor__row">
          <div className="srf-chip-editor__segments srf-chip-editor__segments--wrap" role="group">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`srf-chip-editor__seg${draft === color ? ' is-active' : ''}`}
                onClick={() => {
                  setDraft(color);
                  commit(color);
                }}
              >
                {color}
              </button>
            ))}
          </div>
          <input
            id={inputId}
            ref={inputRef}
            className="srf-chip-editor__input"
            type="text"
            placeholder="Andere Farbe"
            value={COLOR_PRESETS.includes(draft) ? '' : draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      ) : null}

      {editor === LIVE_EDIT_EDITOR.EQUIPMENT ? (
        <div className="srf-chip-editor__row">
          <div className="srf-chip-editor__segments srf-chip-editor__segments--wrap" role="group">
            {EQUIPMENT_PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                className={`srf-chip-editor__seg${draft === item ? ' is-active' : ''}`}
                onClick={() => {
                  setDraft(item);
                  commit(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <input
            id={inputId}
            ref={inputRef}
            className="srf-chip-editor__input"
            type="text"
            placeholder="Ausstattung"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      ) : null}

      {editor === LIVE_EDIT_EDITOR.VEHICLE ? (
        <div className="srf-chip-editor__row srf-chip-editor__row--vehicle">
          <input
            id={inputId}
            ref={inputRef}
            className="srf-chip-editor__input"
            type="search"
            placeholder="z. B. EV3 Air"
            value={draft}
            onChange={(e) => {
              const q = e.target.value;
              setDraft(q);
              setSelectedVehicle(null);
              setVehicleHits(searchVerifiedVehicleOptions(q, { limit: 6 }));
            }}
            autoComplete="off"
          />
          {vehicleHits.length ? (
            <ul className="srf-chip-editor__hits" role="listbox" aria-label="Modell wählen">
              {vehicleHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className={`srf-chip-editor__hit${selectedVehicle?.id === hit.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedVehicle(hit);
                      setDraft(hit.label);
                      commit(hit);
                    }}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {(
        editor === LIVE_EDIT_EDITOR.PHONE
        || editor === LIVE_EDIT_EDITOR.EMAIL
        || editor === LIVE_EDIT_EDITOR.NAME
        || editor === LIVE_EDIT_EDITOR.TEXT
        || editor === LIVE_EDIT_EDITOR.MONEY
      ) ? (
        <div className="srf-chip-editor__row">
          <input
            id={inputId}
            ref={inputRef}
            className="srf-chip-editor__input"
            type={editor === LIVE_EDIT_EDITOR.EMAIL ? 'email' : (editor === LIVE_EDIT_EDITOR.PHONE ? 'tel' : (editor === LIVE_EDIT_EDITOR.MONEY ? 'number' : 'text'))}
            inputMode={editor === LIVE_EDIT_EDITOR.PHONE ? 'tel' : (editor === LIVE_EDIT_EDITOR.MONEY ? 'decimal' : undefined)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={title}
          />
        </div>
      ) : null}

      {error ? <p className="srf-chip-editor__error">{error}</p> : null}

      <div className="srf-chip-editor__actions">
        <button
          type="button"
          className="srf-chip-editor__btn srf-chip-editor__btn--ok"
          onClick={() => commit()}
          aria-label="Speichern"
          title="Speichern (Enter)"
        >
          ✓
        </button>
        <button
          type="button"
          className="srf-chip-editor__btn srf-chip-editor__btn--cancel"
          onClick={() => onCancel?.()}
          aria-label="Abbrechen"
          title="Abbrechen (Esc)"
        >
          ×
        </button>
      </div>
    </div>
  );
}
