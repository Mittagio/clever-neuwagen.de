import { useEffect, useMemo, useRef, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import {
  buildSellerAssistantContextChips,
  buildSellerCleverMoment,
  runSellerAssistantTurn,
} from '../../services/dealer/sellerAssistantOrchestrator.js';
import './CustomerAkteSellerAssistant.css';

const QUICK_MODES = [
  { id: 'offer', label: 'Angebot', placeholder: 'Was möchten Sie anbieten?' },
  { id: 'message', label: 'Nachricht', placeholder: 'Was möchten Sie schreiben?' },
  { id: 'call', label: 'Anrufen', placeholder: null },
];

/**
 * Clever Verkäufer-Assistent – zentraler Einstieg der Kundenakte (Mobile-First).
 * Orchestriert Context + Input → Action Result. Kein Auto-Send.
 */
export default function CustomerAkteSellerAssistant({
  lead,
  telHref = null,
  customerName = '',
  onSendMessage = null,
  onEditMessage = null,
  onWhatsApp = null,
  onEmail = null,
  onPrepareOffer = null,
  onSaveNote = null,
  onScheduleCallback = null,
  isSaving = false,
}) {
  const [draft, setDraft] = useState('');
  const [modeHint, setModeHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(null);
  const [editBody, setEditBody] = useState(null);
  const inputRef = useRef(null);

  const displayName = customerName || lead?.name || 'den Kunden';
  const shortName = displayName.replace(/^(Herr|Frau)\s+/i, '') || displayName;

  const idleChips = useMemo(
    () => buildSellerAssistantContextChips(lead, []),
    [lead],
  );

  const cleverMoment = useMemo(
    () => buildSellerCleverMoment(lead),
    [lead],
  );

  const contextChips = turn?.contextChips ?? idleChips;
  const placeholder = modeHint === 'offer'
    ? `Was möchten Sie ${displayName} anbieten?`
    : modeHint === 'message'
      ? `Was möchten Sie ${displayName} schreiben?`
      : `Was möchten Sie für ${displayName} erledigen?`;

  useEffect(() => {
    if (modeHint === 'call') return;
    if (modeHint) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [modeHint]);

  function runTurn(text = draft, hint = modeHint) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const result = runSellerAssistantTurn(lead, trimmed, { modeHint: hint });
      setTurn(result);
      if (result?.result?.type === 'message_draft') {
        setEditBody(result.result.draft?.body ?? '');
      } else {
        setEditBody(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleQuick(modeId) {
    if (modeId === 'call') {
      if (telHref) window.location.href = telHref;
      return;
    }
    setModeHint(modeId);
    setTurn(null);
    setEditBody(null);
  }

  function focusComposer(hint) {
    setModeHint(hint);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handlePrimary() {
    if (!turn?.result) return;
    const { type } = turn.result;
    if (type === 'message_draft') {
      onSendMessage?.({
        body: editBody ?? turn.result.draft?.body,
        channel: turn.result.draft?.channel,
        subject: turn.result.draft?.subject,
      });
      return;
    }
    if (type === 'offer_draft') {
      onPrepareOffer?.(turn.result);
      return;
    }
    if (type === 'customer_note') {
      onSaveNote?.(turn.result.text, turn.result.labels);
      setTurn(null);
      setDraft('');
      return;
    }
    if (type === 'callback') {
      onScheduleCallback?.(turn.result.text);
      setTurn(null);
      setDraft('');
    }
  }

  const result = turn?.result;

  return (
    <section className="cust-seller-assist" aria-label="Clever Verkäufer-Assistent">
      {cleverMoment && !result ? (
        <div className="cust-seller-assist__moment" role="status">
          <p className="cust-seller-assist__moment-label">Clever sagt</p>
          <p className="cust-seller-assist__moment-text">{cleverMoment.summary}</p>
          <div className="cust-seller-assist__moment-actions">
            <button
              type="button"
              className="cust-seller-assist__primary cust-seller-assist__primary--compact"
              onClick={() => focusComposer(cleverMoment.primaryAction.modeHint)}
            >
              {cleverMoment.primaryAction.label}
            </button>
            {cleverMoment.secondaryAction ? (
              <button
                type="button"
                className="cust-seller-assist__sec"
                onClick={() => focusComposer(cleverMoment.secondaryAction.modeHint)}
              >
                {cleverMoment.secondaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="cust-seller-assist__context">
        {contextChips.customer.length > 0 && (
          <div className="cust-seller-assist__context-block">
            <p className="cust-seller-assist__section-label">Kundenkontext</p>
            <ul className="cust-seller-assist__chips" aria-label="Kundenkontext">
              {contextChips.customer.map((chip) => (
                <li key={`c-${chip.label}`}>
                  <span className="cust-seller-assist__chip cust-seller-assist__chip--customer">
                    {chip.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {contextChips.seller.length > 0 && (
          <div className="cust-seller-assist__context-block">
            <p className="cust-seller-assist__section-label">Verkäufer-Notizen</p>
            <ul className="cust-seller-assist__chips cust-seller-assist__chips--seller" aria-label="Verkäufer-Notizen">
              {contextChips.seller.map((chip) => (
                <li key={`s-${chip.label}-${chip.group}`}>
                  <span className="cust-seller-assist__chip cust-seller-assist__chip--seller">
                    {chip.label}
                    {chip.badge ? (
                      <span className="cust-seller-assist__badge">{chip.badge}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="cust-seller-assist__composer">
        <p className="cust-seller-assist__headline">
          <span aria-hidden>✨</span>
          {' '}
          Clever Verkäufer-Assistent
        </p>
        <div className="cust-seller-assist__row">
          <textarea
            ref={inputRef}
            className="cust-seller-assist__input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={busy || isSaving}
            aria-label="Clever Verkäufer-Assistent"
          />
          <DealerAiInlineMic
            variant="fab"
            disabled={busy || isSaving}
            onTranscript={(text) => {
              setDraft((prev) => (prev ? `${prev} ${text}` : text));
              inputRef.current?.focus();
            }}
          />
        </div>
        <button
          type="button"
          className="cust-seller-assist__go"
          onClick={() => runTurn()}
          disabled={busy || isSaving || !draft.trim()}
        >
          {busy ? '…' : 'Weiter'}
        </button>
      </div>

      {result?.type === 'message_draft' && (
        <div className="cust-seller-assist__result cust-seller-assist__result--message">
          <p className="cust-seller-assist__result-title">
            Clever Vorschlag
            <span className="cust-seller-assist__result-ready">Bereit</span>
          </p>
          <p className="cust-seller-assist__result-sub">
            Nachricht für
            {' '}
            {displayName}
          </p>
          <textarea
            className="cust-seller-assist__draft"
            rows={8}
            value={editBody ?? ''}
            onChange={(e) => setEditBody(e.target.value)}
            aria-label="Nachrichtenvorschlag"
          />
          <button
            type="button"
            className="cust-seller-assist__primary"
            onClick={handlePrimary}
            disabled={isSaving || !String(editBody ?? '').trim()}
          >
            Nachricht senden
          </button>
          <div className="cust-seller-assist__secondaries">
            <button type="button" className="cust-seller-assist__sec" onClick={() => onWhatsApp?.(editBody)}>
              WhatsApp
            </button>
            <button type="button" className="cust-seller-assist__sec" onClick={() => onEmail?.(editBody)}>
              E-Mail
            </button>
            <button
              type="button"
              className="cust-seller-assist__sec"
              onClick={() => onEditMessage?.(editBody)}
            >
              Bearbeiten
            </button>
          </div>
        </div>
      )}

      {result?.type === 'offer_draft' && (
        <div className="cust-seller-assist__result cust-seller-assist__result--offer">
          <p className="cust-seller-assist__result-title">
            <span aria-hidden>✨</span>
            {' '}
            Angebot vorbereitet
            <span className="cust-seller-assist__result-ready">Bereit</span>
          </p>
          <p className="cust-seller-assist__offer-vehicle">{result.headline}</p>
          {result.subline && <p className="cust-seller-assist__offer-sub">{result.subline}</p>}
          {result.inheritedFromCustomer?.length > 0 && (
            <ul className="cust-seller-assist__inherited">
              {result.inheritedFromCustomer.map((item) => (
                <li key={item.label}>
                  {item.label}
                  <span className="cust-seller-assist__source">Kunde</span>
                </li>
              ))}
            </ul>
          )}
          {result.importantForCustomer?.length > 0 && (
            <div className="cust-seller-assist__important">
              <p className="cust-seller-assist__important-label">
                Für
                {' '}
                {displayName}
                {' '}
                wichtig
              </p>
              <ul>
                {result.importantForCustomer.map((item) => (
                  <li key={item.label}>
                    ✓
                    {' '}
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="cust-seller-assist__primary"
            onClick={handlePrimary}
            disabled={isSaving}
          >
            {result.primaryCta || `Angebot an ${displayName} senden`}
          </button>
          <div className="cust-seller-assist__secondaries">
            <button
              type="button"
              className="cust-seller-assist__sec"
              onClick={() => onPrepareOffer?.(result)}
            >
              Details ansehen
            </button>
            <button
              type="button"
              className="cust-seller-assist__sec"
              onClick={() => onPrepareOffer?.(result)}
            >
              Bearbeiten
            </button>
          </div>
        </div>
      )}

      {(result?.type === 'customer_note' || result?.type === 'callback') && (
        <div className="cust-seller-assist__result">
          <p className="cust-seller-assist__result-title">{result.title}</p>
          <p className="cust-seller-assist__note-text">{result.text}</p>
          <button type="button" className="cust-seller-assist__primary" onClick={handlePrimary}>
            {result.primaryCta || 'Übernehmen'}
          </button>
        </div>
      )}

      {result?.opportunity && (
        <div className="cust-seller-assist__opportunity">
          <p className="cust-seller-assist__opp-title">Passendes Fahrzeug</p>
          <p className="cust-seller-assist__opp-vehicle">{result.opportunity.vehicleLabel}</p>
          <div className="cust-seller-assist__opp-meta">
            {result.opportunity.color && <span>{result.opportunity.color}</span>}
            {result.opportunity.availability && <span>{result.opportunity.availability}</span>}
          </div>
          <p className="cust-seller-assist__opp-source">Aus Ihrer Angabe · Seller Fact</p>
        </div>
      )}

      <nav className="cust-seller-assist__dock" aria-label="Schnellaktionen">
        {QUICK_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`cust-seller-assist__dock-btn${modeHint === mode.id ? ' is-active' : ''}`}
            onClick={() => handleQuick(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </nav>
    </section>
  );
}
