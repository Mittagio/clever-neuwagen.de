import { useState } from 'react';
import './dealer-landing.css';

/**
 * Phase 6 – Kontaktdaten für Lead / Händler-Dossier.
 */
export default function DealerJourneyLeadSheet({
  dealerName,
  vehicleTitle,
  onClose,
  onSubmit,
}) {
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [message, setMessage] = useState('');
  const [wantTestDrive, setWantTestDrive] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const name = contact.name.trim();
    const email = contact.email.trim().toLowerCase();
    if (!name) {
      setError('Bitte Ihren Namen eingeben.');
      return;
    }
    if (!email.includes('@')) {
      setError('Bitte eine gültige E-Mail eingeben.');
      return;
    }
    setError('');
    onSubmit?.({
      ...contact,
      name,
      email,
      message: message.trim(),
      wantTestDrive,
    });
  }

  return (
    <div className="dl-lead-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="dl-lead-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dl-lead-sheet-title"
      >
        <button type="button" className="dl-lead-sheet__close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
        <p className="dl-lead-sheet__phase">Phase 6 – Anfrage senden</p>
        <h2 id="dl-lead-sheet-title" className="dl-lead-sheet__title">Unverbindlich anfragen</h2>
        <p className="dl-lead-sheet__sub">
          {dealerName ?? 'Ihr Händler'}
          {' '}
          erhält Ihre Beratung und Wunschkonfiguration – der Verkäufer kann direkt einsteigen.
        </p>
        {vehicleTitle && (
          <p className="dl-lead-sheet__vehicle">{vehicleTitle}</p>
        )}

        <form className="dl-lead-sheet__form" onSubmit={handleSubmit}>
          <label className="dl-lead-sheet__field">
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
              placeholder="Max Mustermann"
              required
            />
          </label>
          <label className="dl-lead-sheet__field">
            <span>E-Mail</span>
            <input
              type="email"
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              placeholder="max@beispiel.de"
              required
            />
          </label>
          <label className="dl-lead-sheet__field">
            <span>Telefon (optional)</span>
            <input
              type="tel"
              autoComplete="tel"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+49 …"
            />
          </label>
          <label className="dl-lead-sheet__field">
            <span>Nachricht (optional)</span>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="z. B. Wohnwagen-Anhängerkupplung, Terminwunsch …"
            />
          </label>
          <label className="dl-lead-sheet__checkbox">
            <input
              type="checkbox"
              checked={wantTestDrive}
              onChange={(e) => setWantTestDrive(e.target.checked)}
            />
            <span>Ich möchte eine Probefahrt vereinbaren</span>
          </label>
          {error && <p className="dl-lead-sheet__error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary dl-lead-sheet__cta">
            {wantTestDrive ? 'Anfrage & Probefahrt senden' : 'Anfrage an Händler senden'}
          </button>
        </form>
      </div>
    </div>
  );
}
