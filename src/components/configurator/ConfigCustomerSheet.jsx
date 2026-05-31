import { useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import './ConfigCustomerSheet.css';

export default function ConfigCustomerSheet({
  mode,
  dealerName,
  onClose,
  onSubmit,
}) {
  const {
    isLoggedIn,
    email: sessionEmail,
    customerData,
    requestCode,
    verifyCode,
    demoCode,
    pendingEmail,
    loginWithEmail,
  } = useCustomerAuth();

  const [contact, setContact] = useState({
    name: customerData?.profile?.name ?? '',
    email: sessionEmail ?? '',
    phone: customerData?.profile?.phone ?? '',
  });
  const [loginMode, setLoginMode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const title = mode === 'save'
    ? 'Konfiguration speichern'
    : 'Angebot anfragen';
  const submitLabel = mode === 'save'
    ? 'Speichern'
    : 'Angebot erstellen';

  function handleSubmit(e) {
    e.preventDefault();
    const email = contact.email.trim().toLowerCase();
    if (!email.includes('@')) {
      setError('Bitte gültige E-Mail eingeben.');
      return;
    }
    if (!isLoggedIn) {
      loginWithEmail(email);
    }
    onSubmit({ ...contact, email });
  }

  function handleRequestLogin() {
    const result = requestCode(contact.email);
    if (result.ok) {
      setLoginMode(true);
      setError('');
    } else {
      setError(result.error);
    }
  }

  function handleVerifyLogin(e) {
    e.preventDefault();
    const result = verifyCode(code);
    if (result.ok) {
      setLoginMode(false);
      setContact((c) => ({ ...c, email: pendingEmail ?? c.email }));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="cfg-sheet-overlay" onClick={onClose} role="presentation">
      <div className="cfg-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <button type="button" className="cfg-sheet__close" onClick={onClose} aria-label="Schließen">✕</button>
        <h2>{title}</h2>
        <p className="cfg-sheet__sub">
          {mode === 'save'
            ? `Ihre Sportage-Konfiguration wird in „Mein Clever-Neuwagen“ gespeichert.`
            : `Wir erstellen ein Angebot für ${dealerName} und speichern es in Ihrem Konto.`}
        </p>

        {isLoggedIn && (
          <p className="cfg-sheet__logged-in">✓ Angemeldet als {sessionEmail}</p>
        )}

        {!isLoggedIn && !loginMode && (
          <button type="button" className="cfg-sheet__login-link" onClick={handleRequestLogin}>
            Per E-Mail-Code anmelden
          </button>
        )}

        {loginMode && !isLoggedIn && (
          <form className="cfg-sheet__login" onSubmit={handleVerifyLogin}>
            {demoCode && <p className="cfg-sheet__demo">Demo-Code: <strong>{demoCode}</strong></p>}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-stelliger Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-secondary">Code bestätigen</button>
          </form>
        )}

        <form onSubmit={handleSubmit}>
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
              readOnly={isLoggedIn}
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
          {error && <p className="cfg-sheet__error">{error}</p>}
          <button type="submit" className="btn btn-primary cfg-sheet__submit">{submitLabel}</button>
        </form>
      </div>
    </div>
  );
}

export const CONFIG_RESTORE_KEY = 'clever-neuwagen-restore-config';

export function stashConfigForRestore(configEntry) {
  if (!configEntry?.config) return;
  sessionStorage.setItem(CONFIG_RESTORE_KEY, JSON.stringify(configEntry.config));
}
