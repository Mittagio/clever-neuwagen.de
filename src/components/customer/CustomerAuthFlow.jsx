import { useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import './CustomerAuthFlow.css';

export default function CustomerAuthFlow({ onSuccess }) {
  const { requestCode, verifyCode, resendCode, pendingEmail, demoCode, cancelLogin } = useCustomerAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    const result = await requestCode(email);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep('code');
  }

  function handleCodeSubmit(e) {
    e.preventDefault();
    setError('');
    const result = verifyCode(code);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  async function handleResend() {
    setError('');
    await resendCode();
  }

  function handleBack() {
    setStep('email');
    setCode('');
    setError('');
    cancelLogin();
  }

  if (step === 'email') {
    return (
      <div className="cust-auth">
        <div className="cust-auth-intro">
          <h1 className="cust-auth-title">Anmelden</h1>
          <p className="cust-auth-sub">Ohne Passwort – wir senden Ihnen einen Code per E-Mail.</p>
        </div>

        <form className="cust-auth-form" onSubmit={handleEmailSubmit}>
          <label className="cust-auth-label" htmlFor="cust-email">E-Mail</label>
          <input
            id="cust-email"
            type="email"
            className="cust-auth-input"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
          />
          {error && <p className="cust-auth-error" role="alert">{error}</p>}
          <button type="submit" className="cust-auth-btn">Code senden</button>
        </form>
      </div>
    );
  }

  return (
    <div className="cust-auth">
      <button type="button" className="cust-auth-back" onClick={handleBack}>← Andere E-Mail</button>

      <div className="cust-auth-intro">
        <h1 className="cust-auth-title">Code eingeben</h1>
        <p className="cust-auth-sub">
          Code an <strong>{pendingEmail}</strong> gesendet.
        </p>
      </div>

      {demoCode && (
        <p className="cust-auth-demo">
          Demo: Ihr Code ist <strong>{demoCode}</strong>
        </p>
      )}

      <form className="cust-auth-form" onSubmit={handleCodeSubmit}>
        <label className="cust-auth-label" htmlFor="cust-code">Verifizierungscode</label>
        <input
          id="cust-code"
          type="text"
          className="cust-auth-input cust-auth-input--code"
          placeholder="6-stelliger Code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          required
        />
        {error && <p className="cust-auth-error" role="alert">{error}</p>}
        <button type="submit" className="cust-auth-btn" disabled={code.length < 6}>
          Anmelden
        </button>
        <button type="button" className="cust-auth-link" onClick={handleResend}>
          Code erneut senden
        </button>
      </form>
    </div>
  );
}
