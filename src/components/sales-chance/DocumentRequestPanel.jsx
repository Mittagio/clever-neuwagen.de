import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  OFFER_DOCUMENT_SLOTS,
  DOCUMENT_REQUEST_STATUS,
} from '../../data/documentRequestTypes.js';
import { copyOfferLink } from '../../logic/offerService.js';
import InternalTestCustomerShareWarning from '../shared/InternalTestCustomerShareWarning.jsx';
import {
  getDocumentRequestsForLead,
  buildUnterlagenPath,
  buildUnterlagenUrl,
  formatRequestExpiry,
  getRequestProgress,
} from '../../logic/documentRequestService.js';
import './DocumentRequestPanel.css';

export default function DocumentRequestPanel({
  lead,
  offer,
  onRequest,
  onToast,
}) {
  const [selected, setSelected] = useState(() =>
    OFFER_DOCUMENT_SLOTS.map((s) => s.id),
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const requests = useMemo(
    () => (lead ? getDocumentRequestsForLead(lead.id) : []),
    [lead],
  );

  const activeRequest = requests.find(
    (r) => r.status !== DOCUMENT_REQUEST_STATUS.completed.id
      && r.status !== DOCUMENT_REQUEST_STATUS.expired.id,
  ) ?? null;

  function toggleSlot(id) {
    setSelected((prev) =>
      (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]),
    );
  }

  async function handleSend() {
    if (!lead || busy || selected.length === 0) return;
    setBusy(true);
    const res = onRequest?.({ slotTypes: selected, message });
    if (res?.ok) {
      onToast?.('Unterlagen angefordert – E-Mail geöffnet');
      setMessage('');
    } else {
      onToast?.('Anforderung fehlgeschlagen');
    }
    setBusy(false);
  }

  async function copyLink() {
    if (!activeRequest) return;
    const url = buildUnterlagenUrl(activeRequest.id, activeRequest.accessToken);
    const ok = await copyOfferLink(url);
    onToast?.(ok ? 'Checklisten-Link kopiert' : 'Kopieren fehlgeschlagen');
  }

  const progress = activeRequest ? getRequestProgress(activeRequest) : null;

  return (
    <section className="sc-docreq card">
      <h3>Unterlagen anfordern</h3>
      <InternalTestCustomerShareWarning />
      <p className="sc-docreq__hint">
        Kunde erhält eine Checkliste mit 48h-Upload-Frist und Link zur digitalen Selbstauskunft.
      </p>

      <div className="sc-docreq__slots">
        {OFFER_DOCUMENT_SLOTS.map((slot) => (
          <label key={slot.id} className="sc-docreq__slot">
            <input
              type="checkbox"
              checked={selected.includes(slot.id)}
              onChange={() => toggleSlot(slot.id)}
            />
            <span>
              {slot.label}
              {slot.kind === 'form' && <em> (Formular)</em>}
            </span>
          </label>
        ))}
      </div>

      <label className="sc-docreq__message">
        Nachricht an den Kunden
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Optional: Hinweis zu fehlenden Unterlagen"
        />
      </label>

      <button
        type="button"
        className="sc-docreq__send"
        onClick={handleSend}
        disabled={busy || selected.length === 0}
      >
        {busy ? 'Wird gesendet…' : 'Unterlagen anfordern'}
      </button>

      {activeRequest && (
        <div className="sc-docreq__active">
          <p>
            <strong>Aktive Anforderung</strong>
            {' · '}
            {progress?.done}/{progress?.total} erledigt
            {' · '}
            {formatRequestExpiry(activeRequest.expiresAt)}
          </p>
          <ul className="sc-docreq__active-slots">
            {activeRequest.slots.map((slot) => (
              <li key={slot.type} className={slot.status !== 'pending' ? 'is-done' : ''}>
                {slot.status !== 'pending' ? '✓' : '○'} {slot.label}
              </li>
            ))}
          </ul>
          <div className="sc-docreq__links">
            <Link to={buildUnterlagenPath(activeRequest.id, activeRequest.accessToken)}>
              Checkliste (Kundenansicht)
            </Link>
            <button type="button" onClick={copyLink}>Link kopieren</button>
          </div>
        </div>
      )}
    </section>
  );
}
