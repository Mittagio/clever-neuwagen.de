import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDealerConditions } from '../context/DealerConditionsContext.jsx';
import { usePartnerOnboarding } from '../context/PartnerOnboardingContext.jsx';
import {
  DISCOUNT_FIELDS,
  LEASING_MILEAGES,
  LEASING_TERMS,
  ONBOARDING_STEPS,
  PARTNER_BRANDS,
} from '../data/partnerOnboarding.js';
import {
  buildPartnerUrl,
  buildSubdomain,
  copySubdomain,
  validateStep,
} from '../logic/partnerOnboarding.js';
import './PartnerOnboardingPage.css';

export default function PartnerOnboardingPage() {
  const { publishFromOnboarding } = useDealerConditions();
  const {
    draft,
    setStep,
    updateDealer,
    setSlug,
    toggleBrand,
    updateDiscount,
    updateLeasingFactor,
    updateDefaultDeliveryTime,
    updateBrandDeliveryTime,
    updatePreparationFee,
    markPublished,
  } = usePartnerOnboarding();

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const subdomain = draft.subdomain ?? buildSubdomain(draft.slug);
  const partnerUrl = buildPartnerUrl(draft.slug);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

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

  function handlePublish() {
    const err = validateStep(1, draft) ?? validateStep(2, draft) ?? validateStep(5, draft);
    if (err) {
      setError(err);
      return;
    }
    const sub = buildSubdomain(draft.slug);
    const profile = {
      ...draft,
      subdomain: sub,
      publishedAt: new Date().toISOString(),
    };
    publishFromOnboarding(profile);
    markPublished(sub);
    setError('');
    showToast('Händlerseite veröffentlicht');
  }

  async function handleCopySubdomain() {
    try {
      await copySubdomain(subdomain);
      showToast('Subdomain kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  }

  const selectedBrandNames = PARTNER_BRANDS
    .filter((b) => draft.brands.includes(b.id))
    .map((b) => b.name);

  return (
    <div className="partner">
      <header className="partner-header">
        <Link to="/" className="partner-header__back">←</Link>
        <div>
          <p className="partner-header__kicker">Partner werden</p>
          <h1 className="partner-header__title">Konditionen einrichten</h1>
          <p className="partner-header__sub">
            Noch nicht registriert?{' '}
            <Link to="/partner/register">Händler registrieren →</Link>
          </p>
        </div>
      </header>

      <nav className="partner-steps" aria-label="Fortschritt">
        {ONBOARDING_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`partner-step${draft.step === s.id ? ' is-active' : ''}${draft.step > s.id ? ' is-done' : ''}`}
            onClick={() => draft.published || s.id <= draft.step ? setStep(s.id) : undefined}
            disabled={!draft.published && s.id > draft.step}
          >
            <span className="partner-step__num">{s.id}</span>
            <span className="partner-step__label">{s.label}</span>
          </button>
        ))}
      </nav>

      <main className="partner-main">
        {error && <p className="partner-error" role="alert">{error}</p>}

        {draft.step === 1 && (
          <section className="partner-panel card">
            <h2>Händlerdaten</h2>
            <p className="partner-panel__sub">Grunddaten für Ihre Händlerseite</p>
            <div className="partner-form">
              <label>
                Händlername
                <input
                  type="text"
                  value={draft.dealer.name}
                  onChange={(e) => updateDealer({ name: e.target.value })}
                  placeholder="Autohaus Trinkle"
                />
              </label>
              <div className="partner-form__row">
                <label>
                  PLZ
                  <input
                    type="text"
                    value={draft.dealer.plz}
                    onChange={(e) => updateDealer({ plz: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    placeholder="74072"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  Ort
                  <input
                    type="text"
                    value={draft.dealer.city}
                    onChange={(e) => updateDealer({ city: e.target.value })}
                    placeholder="Heilbronn"
                  />
                </label>
              </div>
              <label>
                Adresse
                <input
                  type="text"
                  value={draft.dealer.address}
                  onChange={(e) => updateDealer({ address: e.target.value })}
                  placeholder="Willy-Brandt-Platz 5"
                />
              </label>
              <label>
                Ansprechpartner
                <input
                  type="text"
                  value={draft.dealer.contactName}
                  onChange={(e) => updateDealer({ contactName: e.target.value })}
                  placeholder="Max Trinkle"
                />
              </label>
              <div className="partner-form__row">
                <label>
                  Telefon
                  <input
                    type="tel"
                    value={draft.dealer.phone}
                    onChange={(e) => updateDealer({ phone: e.target.value })}
                    placeholder="+49 7131 …"
                  />
                </label>
                <label>
                  E-Mail
                  <input
                    type="email"
                    value={draft.dealer.email}
                    onChange={(e) => updateDealer({ email: e.target.value })}
                    placeholder="info@autohaus.de"
                  />
                </label>
              </div>
              <label>
                Subdomain-Slug
                <input
                  type="text"
                  value={draft.slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="autohaus-trinkle"
                />
              </label>
              {draft.slug && (
                <p className="partner-slug-preview">
                  Vorschau: <strong>{buildSubdomain(draft.slug)}</strong>
                </p>
              )}
            </div>
          </section>
        )}

        {draft.step === 2 && (
          <section className="partner-panel card">
            <h2>Marken auswählen</h2>
            <p className="partner-panel__sub">Welche Marken möchten Sie anbieten?</p>
            <div className="partner-brands">
              {PARTNER_BRANDS.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  disabled={!brand.available}
                  className={`partner-brand${draft.brands.includes(brand.id) ? ' is-selected' : ''}${!brand.available ? ' is-disabled' : ''}`}
                  onClick={() => brand.available && toggleBrand(brand.id)}
                >
                  <span className="partner-brand__name">{brand.name}</span>
                  <span className="partner-brand__meta">
                    {brand.available
                      ? `${brand.modelCount} Modelle`
                      : 'Demnächst'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {draft.step === 3 && (
          <section className="partner-panel card">
            <h2>Rabatte pflegen</h2>
            <p className="partner-panel__sub">Rabatt in % auf den UPE-Listenpreis</p>
            <div className="partner-discount-grid">
              {DISCOUNT_FIELDS.map(({ key, label }) => (
                <label key={key} className="partner-discount">
                  <span>{label}</span>
                  <div className="partner-discount__input">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={draft.discounts[key]}
                      onChange={(e) => updateDiscount(key, e.target.value)}
                    />
                    <span>%</span>
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {draft.step === 4 && (
          <section className="partner-panel card">
            <h2>Leasingfaktoren pflegen</h2>
            <p className="partner-panel__sub">Laufzeit × Laufleistung → Faktor</p>
            <div className="partner-leasing">
              {LEASING_TERMS.map((term) => (
                <div key={term} className="partner-leasing-term">
                  <h3>{term} Monate</h3>
                  {LEASING_MILEAGES.map((km) => (
                    <label key={km} className="partner-leasing-field">
                      <span>{(km / 1000).toLocaleString('de-DE')} Tkm/Jahr</span>
                      <input
                        type="number"
                        min={0.01}
                        max={2}
                        step={0.01}
                        value={draft.leasingFactors[term]?.[km] ?? ''}
                        onChange={(e) => updateLeasingFactor(term, km, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {draft.step === 5 && (
          <section className="partner-panel card">
            <h2>Lieferzeiten pflegen</h2>
            <p className="partner-panel__sub">Standard und je ausgewählter Marke</p>
            <label className="partner-delivery">
              <span>Standard-Lieferzeit</span>
              <input
                type="text"
                value={draft.deliveryTimes.default}
                onChange={(e) => updateDefaultDeliveryTime(e.target.value)}
                placeholder="4–6 Wochen"
              />
            </label>
            {selectedBrandNames.length > 0 && (
              <div className="partner-delivery-brands">
                <p className="partner-delivery-brands__title">Je Marke</p>
                {draft.brands.map((brandId) => {
                  const brand = PARTNER_BRANDS.find((b) => b.id === brandId);
                  if (!brand) return null;
                  return (
                    <label key={brandId} className="partner-delivery">
                      <span>{brand.name}</span>
                      <input
                        type="text"
                        value={draft.deliveryTimes.byBrand[brandId] ?? draft.deliveryTimes.default}
                        onChange={(e) => updateBrandDeliveryTime(brandId, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            )}
            <label className="partner-delivery">
              <span>Bereitstellungsgebühr</span>
              <input
                type="number"
                min={0}
                step={10}
                value={draft.preparationFee}
                onChange={(e) => updatePreparationFee(e.target.value)}
              />
            </label>
          </section>
        )}

        {draft.step === 6 && (
          <section className="partner-panel card">
            <h2>Veröffentlichung</h2>
            <p className="partner-panel__sub">Prüfen und online stellen</p>

            <dl className="partner-summary">
              <div><dt>Händler</dt><dd>{draft.dealer.name || '–'}</dd></div>
              <div><dt>Standort</dt><dd>{draft.dealer.plz} {draft.dealer.city}</dd></div>
              <div><dt>Marken</dt><dd>{selectedBrandNames.join(', ') || '–'}</dd></div>
              <div><dt>Standard-Rabatt</dt><dd>{draft.discounts.standard} %</dd></div>
              <div><dt>Lieferzeit</dt><dd>{draft.deliveryTimes.default}</dd></div>
            </dl>

            {!draft.published ? (
              <button type="button" className="partner-btn partner-btn--primary" onClick={handlePublish}>
                Jetzt veröffentlichen
              </button>
            ) : (
              <div className="partner-published">
                <p className="partner-published__badge">✓ Veröffentlicht</p>
                <p className="partner-published__url">{subdomain}</p>
                <div className="partner-published__actions">
                  <button type="button" className="partner-btn partner-btn--primary" onClick={handleCopySubdomain}>
                    Subdomain kopieren
                  </button>
                  <a href={partnerUrl} className="partner-btn partner-btn--secondary" target="_blank" rel="noopener noreferrer">
                    Seite öffnen
                  </a>
                  <Link to="/backend" className="partner-btn partner-btn--outline">
                    Zum Backend
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="partner-nav">
          {draft.step > 1 && (
            <button type="button" className="partner-btn partner-btn--outline" onClick={goBack}>
              Zurück
            </button>
          )}
          {draft.step < 6 && (
            <button type="button" className="partner-btn partner-btn--primary" onClick={goNext}>
              Weiter
            </button>
          )}
        </footer>
      </main>

      {toast && <div className="partner-toast">{toast}</div>}
    </div>
  );
}
