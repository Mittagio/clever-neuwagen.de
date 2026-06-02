import { useMemo, useState } from 'react';
import { formatRate } from '../../logic/leadService.js';
import { getActiveCounterOffer } from '../../logic/offerDialogService.js';
import { COUNTER_OFFER_STATUS } from '../../data/offerDialogTypes.js';
import { copyOfferLink } from '../../logic/offerService.js';
import { buildOfferMagicUrl } from '../../logic/offerAccessToken.js';
import './CounterOfferPanel.css';

export default function CounterOfferPanel({
  lead,
  offer,
  pricing,
  onSend,
  onToast,
}) {
  const [accessoriesNote, setAccessoriesNote] = useState('');
  const [dealerMessage, setDealerMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState('');

  const activeCounter = useMemo(
    () => (offer ? getActiveCounterOffer(offer) : null),
    [offer],
  );

  const displayPricing = pricing ?? offer?.pricing;

  async function handleSend() {
    if (!lead || busy) return;
    setBusy(true);
    const res = onSend?.({ accessoriesNote, dealerMessage });
    if (res?.ok) {
      setLastUrl(res.url ?? '');
      onToast?.('Digitales Angebot gesendet');
      setAccessoriesNote('');
      setDealerMessage('');
    } else {
      onToast?.('Senden fehlgeschlagen');
    }
    setBusy(false);
  }

  async function handleCopyLink() {
    const token = offer?.dialog?.accessToken;
    if (!token || !offer?.code) return;
    const url = lastUrl || buildOfferMagicUrl(offer.code, token);
    const ok = await copyOfferLink(url);
    onToast?.(ok ? 'Magic Link kopiert' : 'Link konnte nicht kopiert werden');
  }

  return (
    <section className="sc-counter card">
      <h3>Digitales Gegenangebot</h3>
      <p className="sc-counter__hint">
        Rate und Konditionen aus der Berechnung übernehmen und dem Kunden per Magic Link senden.
      </p>

      {displayPricing && (
        <dl className="sc-counter__preview">
          <div>
            <dt>Leasingrate</dt>
            <dd>{formatRate(displayPricing.leasingRate)}/M</dd>
          </div>
          <div>
            <dt>Laufzeit</dt>
            <dd>{displayPricing.termMonths ?? lead?.wish?.termMonths ?? '—'} Monate</dd>
          </div>
          <div>
            <dt>km/Jahr</dt>
            <dd>
              {(displayPricing.mileagePerYear ?? lead?.wish?.mileagePerYear ?? '—').toLocaleString
                ? (displayPricing.mileagePerYear ?? lead?.wish?.mileagePerYear ?? '—').toLocaleString('de-DE')
                : (displayPricing.mileagePerYear ?? lead?.wish?.mileagePerYear ?? '—')}
            </dd>
          </div>
          <div>
            <dt>Anzahlung</dt>
            <dd>{displayPricing.downPayment != null ? `${displayPricing.downPayment.toLocaleString('de-DE')} €` : '—'}</dd>
          </div>
        </dl>
      )}

      <label className="sc-counter__field">
        Zubehör / Anpassungen
        <textarea
          value={accessoriesNote}
          onChange={(e) => setAccessoriesNote(e.target.value)}
          rows={2}
          placeholder="z. B. Anhängerkupplung, Winterräder inklusive"
        />
      </label>

      <label className="sc-counter__field">
        Nachricht an den Kunden
        <textarea
          value={dealerMessage}
          onChange={(e) => setDealerMessage(e.target.value)}
          rows={3}
          placeholder="Kurze Erklärung zum angepassten Angebot"
        />
      </label>

      <button
        type="button"
        className="sc-counter__send"
        onClick={handleSend}
        disabled={busy || !displayPricing}
      >
        {busy ? 'Wird gesendet…' : 'Digitales Angebot senden'}
      </button>

      {activeCounter && (
        <div className="sc-counter__status">
          <p>
            <strong>Offenes Gegenangebot</strong>
            {' · '}
            {COUNTER_OFFER_STATUS[activeCounter.status]?.label ?? activeCounter.status}
            {' · '}
            {new Date(activeCounter.sentAt).toLocaleString('de-DE')}
          </p>
          {activeCounter.accessoriesNote && (
            <p className="sc-counter__note">{activeCounter.accessoriesNote}</p>
          )}
        </div>
      )}

      {offer?.dialog?.accessToken && (
        <button type="button" className="sc-counter__copy" onClick={handleCopyLink}>
          Magic Link kopieren
        </button>
      )}
    </section>
  );
}
