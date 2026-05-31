import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import './AdvisorComponents.css';

export default function AdvisorContactStep({
  rec,
  initialContact,
  onBack,
  onSubmit,
  isSubmitting,
}) {
  const { isLoggedIn, email: sessionEmail, requestCode, verifyCode, demoCode, pendingEmail } = useCustomerAuth();
  const [contact, setContact] = useState({
    name: initialContact?.name ?? '',
    email: initialContact?.email ?? sessionEmail ?? '',
    phone: initialContact?.phone ?? '',
  });
  const [wantTestDrive, setWantTestDrive] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const [code, setCode] = useState('');
  const [loginError, setLoginError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ ...contact, wantTestDrive });
  }

  function handleRequestLogin() {
    const result = requestCode(contact.email);
    if (result.ok) {
      setLoginMode(true);
      setLoginError('');
    } else {
      setLoginError(result.error);
    }
  }

  function handleVerifyLogin(e) {
    e.preventDefault();
    const result = verifyCode(code);
    if (result.ok) {
      setLoginMode(false);
      setLoginError('');
    } else {
      setLoginError(result.error);
    }
  }

  return (
    <section className="adv-contact-step">
      <header className="adv-contact-step__head">
        <button type="button" className="adv-compare-view__back" onClick={onBack}>
          ← Zurück
        </button>
        <h2>Kontakt & Abschluss</h2>
        <p>Angebot für <strong>{rec?.fullLabel}</strong></p>
      </header>

      {!isLoggedIn && !loginMode && (
        <div className="adv-contact-step__login-hint">
          <p>Mit Login speichern wir Ihr Angebot dauerhaft in „Mein Clever-Neuwagen“.</p>
          <button type="button" className="adv-btn adv-btn--ghost" onClick={handleRequestLogin}>
            Per E-Mail-Code anmelden
          </button>
        </div>
      )}

      {loginMode && !isLoggedIn && (
        <form className="adv-contact-step__login" onSubmit={handleVerifyLogin}>
          <p>Code an <strong>{pendingEmail ?? contact.email}</strong> gesendet.</p>
          {demoCode && (
            <p className="adv-contact-step__demo-code">Demo-Code: <strong>{demoCode}</strong></p>
          )}
          <label>
            6-stelliger Code
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="adv-contact-step__error">{loginError}</p>}
          <button type="submit" className="adv-btn adv-btn--secondary">Code bestätigen</button>
        </form>
      )}

      {isLoggedIn && (
        <p className="adv-contact-step__logged-in">
          ✓ Angemeldet als {sessionEmail}
        </p>
      )}

      <form className="adv-contact-step__form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={contact.name}
            onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            required
            autoComplete="name"
          />
        </label>
        <label>
          E-Mail
          <input
            type="email"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            required
            autoComplete="email"
            readOnly={isLoggedIn}
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

        <label className="adv-contact-step__checkbox">
          <input
            type="checkbox"
            checked={wantTestDrive}
            onChange={(e) => setWantTestDrive(e.target.checked)}
          />
          Probefahrt anfragen
        </label>

        <button
          type="submit"
          className="adv-btn adv-btn--primary adv-contact-step__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Wird erstellt…' : 'Angebot erstellen & absenden'}
        </button>
      </form>

      <p className="adv-contact-step__legal">
        Mit Absenden erhalten Sie Ihr Angebot und ein Lead wird an {rec?.dealerName ?? 'den Händler'} übermittelt.
      </p>
    </section>
  );
}

export function AdvisorSuccessStep({ offer, offerUrl, wantTestDrive, onGoAccount, onGoOffer }) {
  return (
    <section className="adv-success-step">
      <div className="adv-success-step__icon">✓</div>
      <h2>Angebot erstellt!</h2>
      <p className="adv-success-step__code">Angebotsnummer: <strong>{offer.code}</strong></p>
      <p className="adv-success-step__vehicle">{offer.vehicle.label}</p>
      {wantTestDrive && (
        <p className="adv-success-step__extra">🚗 Probefahrt wurde mit angefragt.</p>
      )}

      <div className="adv-success-step__actions">
        <button type="button" className="adv-btn adv-btn--primary" onClick={onGoOffer}>
          Angebot ansehen
        </button>
        <button type="button" className="adv-btn adv-btn--secondary" onClick={onGoAccount}>
          Mein Clever-Neuwagen
        </button>
        <Link to="/" className="adv-btn adv-btn--ghost">
          Zur Startseite
        </Link>
      </div>
    </section>
  );
}
