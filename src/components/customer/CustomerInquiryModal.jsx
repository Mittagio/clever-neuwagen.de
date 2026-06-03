import { useState } from 'react';
import './CustomerInquiryModal.css';

export default function CustomerInquiryModal({ title, inquirySummary, onClose, onSubmit }) {
  const [contact, setContact] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!contact.name.trim() || !contact.email.trim()) {
      setError('Bitte Name und E-Mail angeben.');
      return;
    }
    setError('');
    onSubmit(contact);
    setSent(true);
    setTimeout(onClose, 2000);
  }

  return (
    <div className="cust-inq-overlay" onClick={onClose} role="presentation">
      <div className="cust-inq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cust-inq-title">
        <h2 id="cust-inq-title">{title}</h2>
        {sent ? (
          <p className="cust-inq-success">✓ Ihre Anfrage wurde gesendet. Der Händler meldet sich bei Ihnen.</p>
        ) : (
          <>
            {inquirySummary?.lines?.length > 0 && (
              <div className="cust-inq-summary" aria-label="Anfrage-Zusammenfassung">
                <p className="cust-inq-summary__title">Sie fragen an:</p>
                <ul className="cust-inq-summary__list">
                  {inquirySummary.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          <form onSubmit={handleSubmit} className="cust-inq-form">
            <label>
              Name *
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                required
              />
            </label>
            <label>
              E-Mail *
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                required
              />
            </label>
            <label>
              Telefon (optional)
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
            <label>
              Nachricht (optional)
              <textarea
                rows={3}
                value={contact.message}
                onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                placeholder="z. B. Wunsch-Laufzeit oder Termin für Probefahrt"
              />
            </label>
            {error && <p className="cust-inq-error" role="alert">{error}</p>}
            <button type="submit" className="cust-inq-btn cust-inq-btn--primary">Anfrage absenden</button>
          </form>
          </>
        )}
        <button type="button" className="cust-inq-ghost" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}
