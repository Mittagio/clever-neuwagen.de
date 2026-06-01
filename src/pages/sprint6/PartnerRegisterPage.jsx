import { useState } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerRegistration } from '../../context/DealerRegistrationContext.jsx';
import {
  DEALER_PACKAGES,
  REGISTRATION_BRANDS,
  REGISTRATION_STEPS,
} from '../../data/dealerRegistration.js';
import { buildSubdomain } from '../../logic/partnerOnboarding.js';
import { getPackageById } from '../../logic/dealerRegistration.js';
import RegistrationStatusBadge from '../../components/sprint6/RegistrationStatusBadge.jsx';
import './PartnerRegisterPage.css';

export default function PartnerRegisterPage() {
  const {
    draft,
    setStep,
    updateCompany,
    updateContact,
    toggleBrand,
    setPackageId,
    setAgbAccepted,
    submitApplication,
    validateStep,
  } = useDealerRegistration();

  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(
    () => draft.status === 'submitted' || draft.status === 'review'
      || draft.status === 'approved' || draft.status === 'live',
  );

  usePageSeo({
    title: 'Händler registrieren',
    description: 'Self-Service-Registrierung für neue Händlerpartner auf clever-neuwagen.de.',
    path: '/partner/register',
  });

  const subdomain = buildSubdomain(draft.slug);
  const selectedPackage = getPackageById(draft.packageId);

  function goNext() {
    const err = validateStep(draft.step, draft);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    if (draft.step < 6) setStep(draft.step + 1);
  }

  function goBack() {
    setError('');
    if (draft.step > 1) setStep(draft.step - 1);
  }

  function handleSubmit() {
    const result = submitApplication();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="reg-page">
        <header className="reg-header">
          <Link to="/" className="reg-header__back">← Startseite</Link>
        </header>
        <main className="reg-main reg-main--center">
          <div className="reg-success">
            <span className="reg-success__icon" aria-hidden>✓</span>
            <h1>Freigabe beantragt</h1>
            <p>
              Ihre Registrierung wurde eingereicht. Unser Team prüft Ihre Angaben
              und meldet sich unter <strong>{draft.contact.email}</strong>.
            </p>
            <RegistrationStatusBadge status={draft.status === 'draft' ? 'submitted' : draft.status} />
            {subdomain && (
              <p className="reg-success__sub">
                Geplante Subdomain: <code>{subdomain}</code>
              </p>
            )}
            <div className="reg-success__actions">
              <Link to="/partner" className="reg-btn reg-btn--primary">
                Konditionen einrichten →
              </Link>
              <Link to="/" className="reg-btn reg-btn--ghost">
                Zur Startseite
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="reg-page">
      <header className="reg-header">
        <Link to="/" className="reg-header__back">←</Link>
        <div>
          <p className="reg-header__kicker">Partner werden</p>
          <h1 className="reg-header__title">Händler registrieren</h1>
          <p className="reg-header__sub">In wenigen Schritten – ohne manuelle Anlage durch uns.</p>
        </div>
      </header>

      <nav className="reg-steps" aria-label="Registrierungsschritte">
        {REGISTRATION_STEPS.map((s) => {
          const isActive = draft.step === s.id;
          const isDone = draft.step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`reg-step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              onClick={() => isDone && setStep(s.id)}
              disabled={!isDone && !isActive}
            >
              <span className="reg-step__num">{s.id}</span>
              <span className="reg-step__label">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="reg-main">
        {error && <p className="reg-error" role="alert">{error}</p>}

        {draft.step === 1 && (
          <section className="reg-card">
            <h2>Firmendaten</h2>
            <p className="reg-card__hint">Rechtliche Angaben Ihres Autohauses.</p>
            <div className="reg-field">
              <label htmlFor="legalName">Firmenname (rechtlich) *</label>
              <input
                id="legalName"
                value={draft.company.legalName}
                onChange={(e) => updateCompany({ legalName: e.target.value })}
                placeholder="Autohaus Muster GmbH"
                autoComplete="organization"
              />
            </div>
            <div className="reg-field">
              <label htmlFor="tradeName">Handelsname (optional)</label>
              <input
                id="tradeName"
                value={draft.company.tradeName}
                onChange={(e) => updateCompany({ tradeName: e.target.value })}
                placeholder="Autohaus Muster"
              />
            </div>
            <div className="reg-field">
              <label htmlFor="vatId">USt-IdNr. (optional)</label>
              <input
                id="vatId"
                value={draft.company.vatId}
                onChange={(e) => updateCompany({ vatId: e.target.value })}
                placeholder="DE123456789"
              />
            </div>
            <div className="reg-field">
              <label htmlFor="street">Straße & Hausnummer *</label>
              <input
                id="street"
                value={draft.company.street}
                onChange={(e) => updateCompany({ street: e.target.value })}
                autoComplete="street-address"
              />
            </div>
            <div className="reg-row">
              <div className="reg-field">
                <label htmlFor="zip">PLZ *</label>
                <input
                  id="zip"
                  value={draft.company.zip}
                  onChange={(e) => updateCompany({ zip: e.target.value })}
                  autoComplete="postal-code"
                />
              </div>
              <div className="reg-field">
                <label htmlFor="city">Ort *</label>
                <input
                  id="city"
                  value={draft.company.city}
                  onChange={(e) => updateCompany({ city: e.target.value })}
                  autoComplete="address-level2"
                />
              </div>
            </div>
            {draft.slug && (
              <p className="reg-slug-preview">
                Subdomain: <code>{subdomain ?? `${draft.slug}.clever-neuwagen.de`}</code>
              </p>
            )}
          </section>
        )}

        {draft.step === 2 && (
          <section className="reg-card">
            <h2>Ansprechpartner</h2>
            <p className="reg-card__hint">Hauptkontakt für Vertrag und Freigaben.</p>
            <div className="reg-row">
              <div className="reg-field">
                <label htmlFor="firstName">Vorname *</label>
                <input
                  id="firstName"
                  value={draft.contact.firstName}
                  onChange={(e) => updateContact({ firstName: e.target.value })}
                  autoComplete="given-name"
                />
              </div>
              <div className="reg-field">
                <label htmlFor="lastName">Nachname *</label>
                <input
                  id="lastName"
                  value={draft.contact.lastName}
                  onChange={(e) => updateContact({ lastName: e.target.value })}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="reg-field">
              <label htmlFor="role">Funktion</label>
              <input
                id="role"
                value={draft.contact.role}
                onChange={(e) => updateContact({ role: e.target.value })}
                placeholder="z. B. Geschäftsführer, Verkaufsleiter"
              />
            </div>
            <div className="reg-field">
              <label htmlFor="email">E-Mail *</label>
              <input
                id="email"
                type="email"
                value={draft.contact.email}
                onChange={(e) => updateContact({ email: e.target.value })}
                autoComplete="email"
              />
            </div>
            <div className="reg-field">
              <label htmlFor="phone">Telefon *</label>
              <input
                id="phone"
                type="tel"
                value={draft.contact.phone}
                onChange={(e) => updateContact({ phone: e.target.value })}
                autoComplete="tel"
              />
            </div>
          </section>
        )}

        {draft.step === 3 && (
          <section className="reg-card">
            <h2>Marken auswählen</h2>
            <p className="reg-card__hint">
              Max. {selectedPackage.maxBrands} Marke(n) im Paket „{selectedPackage.name}“.
            </p>
            <ul className="reg-brand-list">
              {REGISTRATION_BRANDS.map((brand) => {
                const selected = draft.brands.includes(brand.id);
                const disabled = !brand.available;
                return (
                  <li key={brand.id}>
                    <button
                      type="button"
                      className={`reg-brand${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                      onClick={() => !disabled && toggleBrand(brand.id)}
                      disabled={disabled}
                    >
                      <span className="reg-brand__name">{brand.name}</span>
                      {disabled && <span className="reg-brand__badge">Bald</span>}
                      {selected && <span className="reg-brand__check">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {draft.step === 4 && (
          <section className="reg-card">
            <h2>Paket auswählen</h2>
            <p className="reg-card__hint">Monatliche Plattformgebühr plus Erfolgsprovision pro Auslieferung.</p>
            <div className="reg-packages">
              {DEALER_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  className={`reg-package${draft.packageId === pkg.id ? ' is-selected' : ''}`}
                  onClick={() => setPackageId(pkg.id)}
                >
                  {pkg.recommended && <span className="reg-package__badge">Empfohlen</span>}
                  <h3>{pkg.name}</h3>
                  <p className="reg-package__tagline">{pkg.tagline}</p>
                  <p className="reg-package__price">
                    ab {pkg.monthlyFee} € <span>/ Monat</span>
                  </p>
                  <p className="reg-package__provision">
                    + {pkg.successProvision} € pro Auslieferung
                  </p>
                  <ul className="reg-package__features">
                    {pkg.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </section>
        )}

        {draft.step === 5 && (
          <section className="reg-card">
            <h2>AGB akzeptieren</h2>
            <p className="reg-card__hint">
              Bitte lesen Sie die Vertragsbedingungen für Händlerpartner.
            </p>
            <div className="reg-legal-box">
              <p>
                Mit der Registrierung schließen Sie einen Rahmenvertrag zur Nutzung der
                Plattform clever-neuwagen.de. Abrechnung erfolgt gemäß gewähltem Paket
                ({selectedPackage.name}: {selectedPackage.monthlyFee} €/Monat zzgl. MwSt.,
                Erfolgsprovision {selectedPackage.successProvision} €).
              </p>
              <p>
                <Link to="/legal/haendler-agb" target="_blank" rel="noopener noreferrer">
                  Händler-AGB lesen →
                </Link>
                {' · '}
                <Link to="/legal/datenschutz" target="_blank" rel="noopener noreferrer">
                  Datenschutz →
                </Link>
              </p>
            </div>
            <label className="reg-checkbox">
              <input
                type="checkbox"
                checked={draft.agbAccepted}
                onChange={(e) => setAgbAccepted(e.target.checked)}
              />
              <span>
                Ich akzeptiere die Händler-AGB und die Datenschutzhinweise. *
              </span>
            </label>
          </section>
        )}

        {draft.step === 6 && (
          <section className="reg-card">
            <h2>Freigabe beantragen</h2>
            <p className="reg-card__hint">Prüfen Sie Ihre Angaben und reichen Sie die Registrierung ein.</p>
            <dl className="reg-summary">
              <div>
                <dt>Firma</dt>
                <dd>{draft.company.legalName}</dd>
              </div>
              <div>
                <dt>Standort</dt>
                <dd>{draft.company.zip} {draft.company.city}</dd>
              </div>
              <div>
                <dt>Ansprechpartner</dt>
                <dd>{draft.contact.firstName} {draft.contact.lastName} · {draft.contact.email}</dd>
              </div>
              <div>
                <dt>Marken</dt>
                <dd>
                  {REGISTRATION_BRANDS.filter((b) => draft.brands.includes(b.id)).map((b) => b.name).join(', ')}
                </dd>
              </div>
              <div>
                <dt>Paket</dt>
                <dd>{selectedPackage.name}</dd>
              </div>
              <div>
                <dt>Subdomain</dt>
                <dd><code>{subdomain}</code></dd>
              </div>
            </dl>
            <p className="reg-card__hint">
              Nach dem Einreichen erhalten Sie den Status <strong>Eingereicht</strong>.
              Wir prüfen Ihre Daten und schalten Sie nach Freigabe live.
            </p>
          </section>
        )}

        <footer className="reg-footer">
          {draft.step > 1 && (
            <button type="button" className="reg-btn reg-btn--ghost" onClick={goBack}>
              Zurück
            </button>
          )}
          {draft.step < 6 ? (
            <button type="button" className="reg-btn reg-btn--primary" onClick={goNext}>
              Weiter
            </button>
          ) : (
            <button type="button" className="reg-btn reg-btn--primary" onClick={handleSubmit}>
              Freigabe beantragen
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
