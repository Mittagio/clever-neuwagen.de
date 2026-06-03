import { useEffect, useState } from 'react';
import MobileBottomSheet from '../shared/MobileBottomSheet.jsx';
import './CustomerInquiryModal.css';

function useInquiryLayout() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return mobile;
}

function InquirySummaryBlock({ inquirySummary, compact = false }) {
  if (compact && inquirySummary?.compact) {
    const { vehicleTitle, priceLabel, priceSubtitle, bullets } = inquirySummary.compact;
    return (
      <div className="cust-inq-summary cust-inq-summary--compact" aria-label="Anfrage-Kurzüberblick">
        <p className="cust-inq-summary__vehicle">{vehicleTitle}</p>
        {priceLabel && (
          <p className="cust-inq-summary__price">
            {priceLabel}
            {priceSubtitle && <span className="cust-inq-summary__price-sub">{priceSubtitle}</span>}
          </p>
        )}
        {bullets.length > 0 && (
          <ul className="cust-inq-summary__bullets">
            {bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!inquirySummary?.lines?.length) return null;

  return (
    <div className="cust-inq-summary" aria-label="Anfrage-Zusammenfassung">
      <p className="cust-inq-summary__title">Sie fragen an:</p>
      <ul className="cust-inq-summary__list">
        {inquirySummary.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function InquiryContactForm({ contact, setContact, error, onSubmit, hideSubmit = false, formId }) {
  return (
    <form id={formId} onSubmit={onSubmit} className="cust-inq-form">
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
        Telefon (optional)
        <input
          type="tel"
          value={contact.phone}
          onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
          autoComplete="tel"
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
      {!hideSubmit && (
        <button type="submit" className="cust-inq-btn cust-inq-btn--primary">
          Anfrage absenden
        </button>
      )}
    </form>
  );
}

export default function CustomerInquiryModal({ title, inquirySummary, onClose, onSubmit }) {
  const isMobile = useInquiryLayout();
  const [contact, setContact] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const formId = 'cust-inq-form';

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

  if (sent) {
    const success = (
      <p className="cust-inq-success">✓ Ihre Anfrage wurde gesendet. Der Händler meldet sich bei Ihnen.</p>
    );
    if (isMobile) {
      return (
        <MobileBottomSheet open onClose={onClose} title={title} className="vd-sheet--inquiry" priority="high">
          {success}
        </MobileBottomSheet>
      );
    }
    return (
      <div className="cust-inq-overlay" onClick={onClose} role="presentation">
        <div className="cust-inq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cust-inq-title">
          <h2 id="cust-inq-title">{title}</h2>
          {success}
          <button type="button" className="cust-inq-ghost" onClick={onClose}>Schließen</button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileBottomSheet
        open
        onClose={onClose}
        title={title}
        titleId="cust-inq-title"
        className="vd-sheet--inquiry"
        priority="high"
        footer={(
          <button
            type="submit"
            form={formId}
            className="cust-inq-btn cust-inq-btn--primary cust-inq-btn--block"
          >
            Anfrage absenden
          </button>
        )}
      >
        <InquirySummaryBlock inquirySummary={inquirySummary} compact />
        <InquiryContactForm
          formId={formId}
          contact={contact}
          setContact={setContact}
          error={error}
          onSubmit={handleSubmit}
          hideSubmit
        />
      </MobileBottomSheet>
    );
  }

  return (
    <div className="cust-inq-overlay" onClick={onClose} role="presentation">
      <div className="cust-inq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cust-inq-title">
        <h2 id="cust-inq-title">{title}</h2>
        <InquirySummaryBlock inquirySummary={inquirySummary} />
        <InquiryContactForm
          contact={contact}
          setContact={setContact}
          error={error}
          onSubmit={handleSubmit}
        />
        <button type="button" className="cust-inq-ghost" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}
