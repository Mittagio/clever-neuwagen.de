import { useCallback, useRef, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import { SELLER_INSIGHT_CONTEXT } from '../../services/dealer/sellerInsights.js';

const WORKSPACE_HEADING = 'Was haben Sie gerade vom Kunden gelernt?';

const CONTEXT_CHIPS = [
  { id: SELLER_INSIGHT_CONTEXT.PHONE, label: 'Telefonat' },
  { id: SELLER_INSIGHT_CONTEXT.TEST_DRIVE, label: 'Probefahrt' },
  { id: SELLER_INSIGHT_CONTEXT.OFFER, label: 'Angebot' },
  { id: SELLER_INSIGHT_CONTEXT.CALLBACK, label: 'Rückruf' },
  { id: SELLER_INSIGHT_CONTEXT.VEHICLE_VIEWING, label: 'Fahrzeugbesichtigung' },
];

const INPUT_PLACEHOLDER = [
  'Sportage Spirit in Grün. Anhängerkupplung wichtig. Leasing 48 Monate mit 15.000 km …',
  'Er ist sich noch nicht sicher ob Hybrid oder Elektro besser passt. Das Dachzelt ist wichtig.',
  'Sportliches Design ist wichtiger als maximale Ausstattung.',
].join(' ');

/**
 * Verkäufer-Spracharbeitsplatz – frei erzählen oder tippen → sellerInsights.
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
      <div
        className="cust-insight-capture cust-insight-capture--collapsed cust-insight-capture--workspace"
        aria-label="Verkäufer-Spracharbeitsplatz"
      >
        <button
          type="button"
          className="cust-insight-capture__trigger"
          onClick={handleOpen}
          disabled={isSaving}
        >
          <span className="cust-insight-capture__trigger-icon" aria-hidden>🎤</span>
          <span className="cust-insight-capture__trigger-copy">
            <span className="cust-insight-capture__trigger-title">{WORKSPACE_HEADING}</span>
            <span className="cust-insight-capture__trigger-hint">
              Tippen oder sprechen – Clever ordnet es dem Kundenbild zu.
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="cust-insight-capture cust-insight-capture--open cust-insight-capture--workspace"
      aria-label="Verkäufer-Spracharbeitsplatz"
    >
      <p className="cust-insight-capture__heading">
        <span className="cust-insight-capture__heading-icon" aria-hidden>🎤</span>
        {WORKSPACE_HEADING}
      </p>
      <p className="cust-insight-capture__hint">
        Erzählen Sie frei, was im Gespräch wichtig war – kein Formular, keine Pflichtfelder.
      </p>
      <div className="cust-insight-capture__row">
        <textarea
          ref={inputRef}
          className="cust-insight-capture__input"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={INPUT_PLACEHOLDER}
          disabled={isSaving}
          aria-label="Gespräch festhalten"
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

      <div className="cust-insight-capture__context" role="group" aria-label="Gesprächskontext">
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
          {isSaving ? 'Wird festgehalten …' : 'Festhalten'}
        </button>
      </div>
    </div>
  );
}
