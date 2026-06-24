import { useEffect, useState } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import './CustomerAkte.css';

export default function CustomerAkteWishConditions({
  chips = [],
  values = {},
  onSave,
  paymentOptions = [],
  deliveryOptions = [],
  getBudgetFieldLabel = () => 'Budget',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);

  useEffect(() => {
    if (!editing) setDraft(values);
  }, [values, editing]);

  if (!chips.length && !editing) return null;

  function startEdit() {
    setDraft(values);
    setEditing(true);
  }

  function updateDraft(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    onSave?.(draft);
    setEditing(false);
  }

  const paymentType = draft.paymentType ?? 'unknown';
  const isCash = paymentType === 'cash';

  return (
    <section className="cust-akte-wish" aria-labelledby="cust-akte-wish-title">
      <div className="cust-akte-wish__head">
        <h2 id="cust-akte-wish-title" className="cust-akte-wish__label">Wunschkonditionen</h2>
        {!editing && onSave && (
          <button
            type="button"
            className="cust-akte-wish__edit"
            onClick={startEdit}
            aria-label="Wunschkonditionen bearbeiten"
          >
            ✎
          </button>
        )}
      </div>

      {editing ? (
        <div className="cust-akte-wish__form">
          <label className="cust-akte-wish__field">
            <span className="cust-akte-wish__field-label">Zahlungsart</span>
            <select
              className="cust-akte-wish__field-input"
              value={paymentType}
              onChange={(e) => {
                const next = e.target.value;
                updateDraft({
                  paymentType: next,
                  desiredRate: next === 'cash' ? '' : draft.desiredRate,
                  desiredPrice: next === 'cash' ? draft.desiredPrice : '',
                });
              }}
            >
              {paymentOptions.map((id) => (
                <option key={id} value={id}>{PAYMENT_TYPE_LABELS[id] ?? id}</option>
              ))}
            </select>
          </label>

          {isCash ? (
            <label className="cust-akte-wish__field">
              <span className="cust-akte-wish__field-label">{getBudgetFieldLabel('cash')}</span>
              <input
                type="number"
                inputMode="numeric"
                className="cust-akte-wish__field-input"
                value={draft.desiredPrice ?? ''}
                onChange={(e) => updateDraft({ desiredPrice: e.target.value })}
                placeholder="30000"
              />
            </label>
          ) : paymentType !== 'unknown' && (
            <label className="cust-akte-wish__field">
              <span className="cust-akte-wish__field-label">{getBudgetFieldLabel(paymentType)}</span>
              <input
                type="number"
                inputMode="numeric"
                className="cust-akte-wish__field-input"
                value={draft.desiredRate ?? ''}
                onChange={(e) => updateDraft({ desiredRate: e.target.value })}
                placeholder="299"
              />
            </label>
          )}

          {paymentType !== 'cash' && paymentType !== 'unknown' && (
            <>
              <label className="cust-akte-wish__field">
                <span className="cust-akte-wish__field-label">Laufzeit</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="cust-akte-wish__field-input"
                  value={draft.termMonths ?? ''}
                  onChange={(e) => updateDraft({ termMonths: e.target.value })}
                  placeholder="48"
                />
              </label>
              {paymentType === 'leasing' && (
                <label className="cust-akte-wish__field">
                  <span className="cust-akte-wish__field-label">Kilometer / Jahr</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="cust-akte-wish__field-input"
                    value={draft.mileagePerYear ?? ''}
                    onChange={(e) => updateDraft({ mileagePerYear: e.target.value })}
                    placeholder="10000"
                  />
                </label>
              )}
              <label className="cust-akte-wish__field">
                <span className="cust-akte-wish__field-label">Anzahlung</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="cust-akte-wish__field-input"
                  value={draft.downPayment ?? ''}
                  onChange={(e) => updateDraft({ downPayment: e.target.value })}
                  placeholder="2000"
                />
              </label>
            </>
          )}

          <label className="cust-akte-wish__field">
            <span className="cust-akte-wish__field-label">Wunschlieferdatum</span>
            <select
              className="cust-akte-wish__field-input"
              value={draft.delivery ?? ''}
              onChange={(e) => updateDraft({ delivery: e.target.value })}
            >
              <option value="">—</option>
              {deliveryOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <div className="cust-akte-wish__form-actions">
            <button type="button" className="cust-akte-wish__save" onClick={handleSave}>
              Speichern
            </button>
            <button type="button" className="cust-akte-wish__cancel" onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="cust-akte-wish__card"
          onClick={onSave ? startEdit : undefined}
          disabled={!onSave}
        >
          <div className="cust-akte-wish__chips">
            {chips.map((chip) => (
              <span key={chip} className="cust-akte-wish__chip">{chip}</span>
            ))}
          </div>
        </button>
      )}
    </section>
  );
}
