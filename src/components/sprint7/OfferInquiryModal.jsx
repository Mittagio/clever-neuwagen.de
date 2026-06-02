import { useState } from 'react';
import {
  EMPTY_SONDERWUESNCHE,
  SONDERWUNSCH_TOGGLES,
} from '../../data/offerDialogTypes.js';
import './OfferInquiryModal.css';

const defaultContact = (offer) => ({
  name: offer.customer?.name ?? '',
  email: offer.customer?.email ?? '',
  phone: offer.customer?.phone ?? '',
});

export default function OfferInquiryModal({
  offer,
  mode = 'inquiry',
  title,
  onClose,
  onSubmit,
}) {
  const [contact, setContact] = useState(defaultContact(offer));
  const [message, setMessage] = useState('');
  const [sonderwuensche, setSonder] = useState({ ...EMPTY_SONDERWUESNCHE });
  const [sent, setSent] = useState(false);

  const showWishes = mode === 'inquiry' || mode === 'special_request';
  const requireMessage = mode === 'question';

  function toggleWish(id) {
    setSonder((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ contact, message, sonderwuensche });
    setSent(true);
    setTimeout(onClose, 2000);
  }

  return (
    <div className="offer-inquiry-overlay" onClick={onClose} role="presentation">
      <div
        className="offer-inquiry-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="offer-inquiry-title"
      >
        <h2 id="offer-inquiry-title">{title}</h2>
        <p className="offer-inquiry-modal__sub">
          {offer.vehicle.label} · Angebot {offer.code}
        </p>

        {sent ? (
          <p className="offer-inquiry-modal__success">
            ✓ Ihre Anfrage wurde gesendet. Ihr Ansprechpartner meldet sich zeitnah.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="offer-inquiry-modal__form">
            <fieldset className="offer-inquiry-modal__section">
              <legend>Ihre Kontaktdaten</legend>
              <label>
                Name *
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                E-Mail *
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Telefon
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </label>
              {(requireMessage || mode === 'inquiry') && (
                <label>
                  {requireMessage ? 'Ihre Frage *' : 'Nachricht'}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    required={requireMessage}
                    placeholder={requireMessage ? 'Was möchten Sie wissen?' : 'Optional'}
                  />
                </label>
              )}
            </fieldset>

            {showWishes && (
              <fieldset className="offer-inquiry-modal__section">
                <legend>Sonderwünsche</legend>
                <label>
                  Wunschfarbe
                  <input
                    type="text"
                    value={sonderwuensche.wunschfarbe}
                    onChange={(e) => setSonder((s) => ({ ...s, wunschfarbe: e.target.value }))}
                    placeholder="z. B. Schwarz Metallic"
                  />
                </label>
                <div className="offer-inquiry-modal__toggles">
                  {SONDERWUNSCH_TOGGLES.map((opt) => (
                    <label key={opt.id} className="offer-inquiry-modal__toggle">
                      <input
                        type="checkbox"
                        checked={!!sonderwuensche[opt.id]}
                        onChange={() => toggleWish(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="offer-inquiry-modal__row">
                  <label>
                    Andere Laufzeit (Mon.)
                    <input
                      type="number"
                      min="12"
                      max="60"
                      step="12"
                      value={sonderwuensche.andereLaufzeit}
                      onChange={(e) => setSonder((s) => ({ ...s, andereLaufzeit: e.target.value }))}
                      placeholder="48"
                    />
                  </label>
                  <label>
                    Andere km/Jahr
                    <input
                      type="number"
                      min="5000"
                      step="5000"
                      value={sonderwuensche.andereKilometer}
                      onChange={(e) => setSonder((s) => ({ ...s, andereKilometer: e.target.value }))}
                      placeholder="15000"
                    />
                  </label>
                  <label>
                    Andere Anzahlung €
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={sonderwuensche.andereAnzahlung}
                      onChange={(e) => setSonder((s) => ({ ...s, andereAnzahlung: e.target.value }))}
                      placeholder="0"
                    />
                  </label>
                </div>
                <label>
                  Sonstiger Wunsch
                  <textarea
                    value={sonderwuensche.sonstigerWunsch}
                    onChange={(e) => setSonder((s) => ({ ...s, sonstigerWunsch: e.target.value }))}
                    rows={2}
                    placeholder="Weitere Wünsche oder Hinweise"
                  />
                </label>
              </fieldset>
            )}

            <button type="submit" className="angebot-btn angebot-btn--primary offer-inquiry-modal__submit">
              Anfrage senden
            </button>
          </form>
        )}
        <button type="button" className="offer-inquiry-modal__close" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
