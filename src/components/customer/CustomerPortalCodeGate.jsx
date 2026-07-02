import { useState } from 'react';

export default function CustomerPortalCodeGate({
  customerFirstName = 'Hallo',
  emailHint = '',
  onVerify,
  verifying = false,
  error = '',
}) {
  const [code, setCode] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim() || verifying) return;
    onVerify?.(code.trim());
  }

  return (
    <div className="cop-page">
      <div className="cop-shell cop-shell--narrow">
        <header className="cop-header">
          <p className="cop-eyebrow">Persönlicher Zugang</p>
          <h1 className="cop-title">
            {customerFirstName}
            , Ihre Fahrzeugauswahl
          </h1>
          <p className="cop-subline">
            Bitte bestätigen Sie den Zugang mit dem Code aus Ihrer E-Mail.
          </p>
          {emailHint ? (
            <p className="cop-muted cop-code-hint">Code gesendet an {emailHint}</p>
          ) : null}
        </header>

        <form className="cop-code-form" onSubmit={handleSubmit}>
          <label className="cop-code-form__label" htmlFor="cop-access-code">
            Zugangscode
          </label>
          <input
            id="cop-access-code"
            className="cop-code-form__input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-stelliger Code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={verifying}
          />
          <button
            type="submit"
            className="cop-btn cop-btn--primary cop-code-form__submit"
            disabled={verifying || code.trim().length < 4}
          >
            {verifying ? 'Wird geprüft …' : 'Code bestätigen'}
          </button>
          {error ? <p className="cop-code-form__error" role="alert">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
