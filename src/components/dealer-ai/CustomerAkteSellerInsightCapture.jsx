import { useCallback, useRef, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import { SELLER_INSIGHT_CONTEXT } from '../../services/dealer/sellerInsights.js';

const CONTEXT_CHIPS = [
  { id: SELLER_INSIGHT_CONTEXT.PHONE, label: 'Telefonat' },
  { id: SELLER_INSIGHT_CONTEXT.TEST_DRIVE, label: 'Probefahrt' },
  { id: SELLER_INSIGHT_CONTEXT.OFFER, label: 'Angebot' },
];

/**
 * Schnelle Verkäufer-Eingabe → sellerInsights (Desktop + Handy).
 */
export default function CustomerAkteSellerInsightCapture({
  onSubmit,
  isSaving = false,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState(null);
  const inputRef = useRef(null);

  const submit = useCallback((text = draft) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed || isSaving) return;
    onSubmit?.(trimmed, context);
    setDraft('');
    setContext(null);
    setOpen(false);
  }, [context, draft, isSaving, onSubmit]);

  function handleOpen() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setDraft('');
      setContext(null);
    }
  }

  if (!open) {
    return (
      <div className="cust-insight-capture cust-insight-capture--collapsed">
        <button
          type="button"
          className="cust-insight-capture__trigger"
          onClick={handleOpen}
          disabled={isSaving}
        >
          + Erkenntnis hinzufügen
        </button>
      </div>
    );
  }

  return (
    <div className="cust-insight-capture cust-insight-capture--open" aria-label="Erkenntnis hinzufügen">
      <p className="cust-insight-capture__label">Neue Erkenntnis</p>
      <div className="cust-insight-capture__row">
        <textarea
          ref={inputRef}
          className="cust-insight-capture__input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="z. B. Dachzelt, Hybrid offen, Frau fährt überwiegend …"
          disabled={isSaving}
          aria-label="Erkenntnis als Freitext"
        />
        <DealerAiInlineMic
          variant="fab"
          disabled={isSaving}
          onTranscript={(text) => {
            setDraft((prev) => (prev ? `${prev} ${text}` : text));
            inputRef.current?.focus();
          }}
        />
      </div>

      <div className="cust-insight-capture__context" role="group" aria-label="Kontext">
        {CONTEXT_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`cust-insight-capture__context-chip${context === chip.id ? ' is-active' : ''}`}
            onClick={() => setContext((prev) => (prev === chip.id ? null : chip.id))}
            aria-pressed={context === chip.id}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="cust-insight-capture__actions">
        <button
          type="button"
          className="cust-insight-capture__cancel"
          onClick={() => {
            setOpen(false);
            setDraft('');
            setContext(null);
          }}
          disabled={isSaving}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className="cust-insight-capture__save"
          onClick={() => submit()}
          disabled={isSaving || !draft.trim()}
        >
          {isSaving ? 'Speichern …' : 'Ergänzen'}
        </button>
      </div>
    </div>
  );
}
