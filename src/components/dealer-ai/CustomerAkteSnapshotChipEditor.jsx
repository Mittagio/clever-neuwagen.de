import { useEffect, useState } from 'react';
import {
  SNAPSHOT_MINI_EDITOR,
  SNAPSHOT_RATE_MODES,
  SNAPSHOT_RATE_MODE_LABELS,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import './CustomerAkteSnapshotChipEditor.css';

const TERM_PRESETS = [24, 36, 48, 60];
const KM_PRESETS = [10000, 15000, 20000, 25000, 30000];
const COLOR_PRESETS = ['Schwarz', 'Weiß', 'Grau', 'Blau', 'Rot', 'Silber'];

const EDITOR_TITLES = {
  [SNAPSHOT_MINI_EDITOR.DESIRED_RATE]: 'Wunschrate',
  [SNAPSHOT_MINI_EDITOR.CHILDREN]: 'Kinder',
  [SNAPSHOT_MINI_EDITOR.TERM_MONTHS]: 'Laufzeit',
  [SNAPSHOT_MINI_EDITOR.MILEAGE]: 'Kilometer / Jahr',
  [SNAPSHOT_MINI_EDITOR.COLOR]: 'Farbe',
  [SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY]: 'Lieferzeit',
  [SNAPSHOT_MINI_EDITOR.TRADE_IN]: 'Bestandsfahrzeug',
  [SNAPSHOT_MINI_EDITOR.DOG]: 'Hund',
  [SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE]: 'Zahlungsart',
  [SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT]: 'Anzahlung',
};

/**
 * Feld-spezifischer Mini-Editor für Snapshot-Chips (kein generisches Offen-Sheet).
 */
export default function CustomerAkteSnapshotChipEditor({
  open = false,
  editorKey = null,
  values = {},
  onClose = null,
  onApply = null,
  saving = false,
}) {
  const [draft, setDraft] = useState(values);
  const [customKm, setCustomKm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(values);
    const km = Number(values.mileagePerYear);
    setCustomKm(Boolean(km) && !KM_PRESETS.includes(km));
  }, [open, values, editorKey]);

  if (!open || !editorKey) return null;

  const title = EDITOR_TITLES[editorKey] || 'Bearbeiten';

  function patch(next) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function handleSave() {
    onApply?.(editorKey, draft);
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div className="cust-snap-editor" role="presentation" onClick={handleBackdrop}>
      <div
        className="cust-snap-editor__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="cust-snap-editor__head">
          <h2 className="cust-snap-editor__title">{title}</h2>
          <button type="button" className="cust-snap-editor__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>

        <div className="cust-snap-editor__body">
          {editorKey === SNAPSHOT_MINI_EDITOR.DESIRED_RATE ? (
            <>
              <label className="cust-snap-editor__label" htmlFor="snap-rate">
                Betrag (€ / Monat)
              </label>
              <input
                id="snap-rate"
                className="cust-snap-editor__input"
                type="number"
                inputMode="decimal"
                min={0}
                step={10}
                value={draft.desiredRate ?? ''}
                onChange={(e) => patch({ desiredRate: e.target.value })}
                autoFocus
              />
              <div className="cust-snap-editor__segments" role="group" aria-label="Ratenart">
                {Object.entries(SNAPSHOT_RATE_MODE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`cust-snap-editor__seg${(draft.desiredRateMode || SNAPSHOT_RATE_MODES.APPROX) === id ? ' is-active' : ''}`}
                    onClick={() => patch({ desiredRateMode: id })}
                    aria-pressed={(draft.desiredRateMode || SNAPSHOT_RATE_MODES.APPROX) === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.CHILDREN ? (
            <div className="cust-snap-editor__stepper">
              <button
                type="button"
                className="cust-snap-editor__step-btn"
                onClick={() => patch({ children: Math.max(0, Number(draft.children || 0) - 1) })}
                aria-label="Weniger"
              >
                −
              </button>
              <span className="cust-snap-editor__step-value" aria-live="polite">
                {Number(draft.children || 0) === 1
                  ? '1 Kind'
                  : `${Number(draft.children || 0)} Kinder`}
              </span>
              <button
                type="button"
                className="cust-snap-editor__step-btn"
                onClick={() => patch({ children: Math.min(8, Number(draft.children || 0) + 1) })}
                aria-label="Mehr"
              >
                +
              </button>
            </div>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.TERM_MONTHS ? (
            <div className="cust-snap-editor__segments" role="group" aria-label="Laufzeit">
              {TERM_PRESETS.map((months) => (
                <button
                  key={months}
                  type="button"
                  className={`cust-snap-editor__seg${Number(draft.termMonths) === months ? ' is-active' : ''}`}
                  onClick={() => patch({ termMonths: String(months) })}
                  aria-pressed={Number(draft.termMonths) === months}
                >
                  {months}
                </button>
              ))}
            </div>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.MILEAGE ? (
            <>
              <div className="cust-snap-editor__segments cust-snap-editor__segments--wrap" role="group" aria-label="Kilometer">
                {KM_PRESETS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    className={`cust-snap-editor__seg${!customKm && Number(draft.mileagePerYear) === km ? ' is-active' : ''}`}
                    onClick={() => {
                      setCustomKm(false);
                      patch({ mileagePerYear: String(km) });
                    }}
                    aria-pressed={!customKm && Number(draft.mileagePerYear) === km}
                  >
                    {km.toLocaleString('de-DE')}
                  </button>
                ))}
                <button
                  type="button"
                  className={`cust-snap-editor__seg${customKm ? ' is-active' : ''}`}
                  onClick={() => setCustomKm(true)}
                  aria-pressed={customKm}
                >
                  Eigene
                </button>
              </div>
              {customKm ? (
                <input
                  className="cust-snap-editor__input"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  step={1000}
                  placeholder="z. B. 18000"
                  value={draft.mileagePerYear ?? ''}
                  onChange={(e) => patch({ mileagePerYear: e.target.value })}
                  autoFocus
                />
              ) : null}
            </>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.COLOR ? (
            <>
              <div className="cust-snap-editor__segments cust-snap-editor__segments--wrap" role="group" aria-label="Farbe">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`cust-snap-editor__seg${draft.preferredColor === color ? ' is-active' : ''}`}
                    onClick={() => patch({ preferredColor: color })}
                    aria-pressed={draft.preferredColor === color}
                  >
                    {color}
                  </button>
                ))}
              </div>
              <input
                className="cust-snap-editor__input"
                type="text"
                placeholder="Andere Farbe"
                value={COLOR_PRESETS.includes(draft.preferredColor) ? '' : (draft.preferredColor ?? '')}
                onChange={(e) => patch({ preferredColor: e.target.value })}
              />
            </>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY ? (
            <div className="cust-snap-editor__segments cust-snap-editor__segments--wrap" role="group">
              {[
                { id: 'sofort', label: 'Sofort' },
                { id: '1-3-monate', label: '1–3 Monate' },
                { id: 'wichtig', label: 'Wichtig' },
                { id: '', label: 'Offen' },
              ].map((opt) => (
                <button
                  key={opt.id || 'open'}
                  type="button"
                  className={`cust-snap-editor__seg${(draft.delivery ?? '') === opt.id ? ' is-active' : ''}`}
                  onClick={() => patch({ delivery: opt.id })}
                  aria-pressed={(draft.delivery ?? '') === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.TRADE_IN ? (
            <>
              <div className="cust-snap-editor__segments" role="group" aria-label="Gebrauchtwagen">
                {[
                  { id: true, label: 'Ja' },
                  { id: false, label: 'Nein' },
                ].map((opt) => (
                  <button
                    key={String(opt.id)}
                    type="button"
                    className={`cust-snap-editor__seg${Boolean(draft.hasExistingVehicle) === opt.id ? ' is-active' : ''}`}
                    onClick={() => patch({ hasExistingVehicle: opt.id })}
                    aria-pressed={Boolean(draft.hasExistingVehicle) === opt.id}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {draft.hasExistingVehicle ? (
                <input
                  className="cust-snap-editor__input"
                  type="text"
                  placeholder="z. B. Ford Focus"
                  value={draft.existingVehicle ?? ''}
                  onChange={(e) => patch({ existingVehicle: e.target.value })}
                  autoFocus
                />
              ) : null}
            </>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.DOG ? (
            <div className="cust-snap-editor__segments" role="group" aria-label="Hund">
              {[
                { id: true, label: 'Ja' },
                { id: false, label: 'Nein' },
              ].map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  className={`cust-snap-editor__seg${Boolean(draft.dog) === opt.id ? ' is-active' : ''}`}
                  onClick={() => patch({ dog: opt.id })}
                  aria-pressed={Boolean(draft.dog) === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE ? (
            <div className="cust-snap-editor__segments" role="group" aria-label="Zahlungsart">
              {[
                { id: 'leasing', label: 'Leasing' },
                { id: 'financing', label: 'Finanzierung' },
                { id: 'cash', label: 'Kauf' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cust-snap-editor__seg${draft.paymentType === opt.id ? ' is-active' : ''}`}
                  onClick={() => patch({ paymentType: opt.id })}
                  aria-pressed={draft.paymentType === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {editorKey === SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT ? (
            <input
              className="cust-snap-editor__input"
              type="number"
              inputMode="decimal"
              min={0}
              step={500}
              placeholder="0"
              value={draft.downPayment ?? ''}
              onChange={(e) => patch({ downPayment: e.target.value })}
              autoFocus
            />
          ) : null}
        </div>

        <footer className="cust-snap-editor__foot">
          <button type="button" className="cust-snap-editor__btn cust-snap-editor__btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="cust-snap-editor__btn cust-snap-editor__btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
}

export { EDITOR_TITLES, TERM_PRESETS, KM_PRESETS };
