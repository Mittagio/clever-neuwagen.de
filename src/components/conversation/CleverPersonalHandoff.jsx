import { useState } from 'react';
import {
  CONTACT_PREFERENCES,
  CONTACT_TIMING_OPTIONS,
  validateHandoffForm,
} from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactPreference: 'phone',
  contactTiming: 'this_week',
};

export default function CleverPersonalHandoff({ handoffView, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  if (!handoffView) return null;

  const { advisor } = handoffView;
  const nameHint = errors.firstName || errors.lastName;

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateHandoffForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSubmit?.(form);
  }

  return (
    <section className="cc-offer-handoff cc-turn-enter" aria-labelledby="cc-offer-handoff-title">
      <h2 id="cc-offer-handoff-title" className="cc-offer-handoff__title">
        {handoffView.title}
      </h2>

      <div className="cc-offer-handoff__prepared">
        <p className="cc-offer-handoff__prepared-intro">{handoffView.preparedIntro}</p>
        <ul className="cc-offer-handoff__prepared-list">
          {handoffView.preparedItems.map((item) => (
            <li key={item} className="cc-offer-handoff__prepared-item">
              <span aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <article className="cc-offer-handoff__advisor">
        <p className="cc-offer-handoff__section-label">Ihr Ansprechpartner</p>
        <div className="cc-offer-handoff__advisor-card">
          <div className="cc-offer-handoff__avatar" aria-hidden>
            {advisor.initials || '👤'}
          </div>
          <div className="cc-offer-handoff__advisor-body">
            <p className="cc-offer-handoff__advisor-name">{advisor.name}</p>
            <p className="cc-offer-handoff__advisor-role">{advisor.role}</p>
            <p className="cc-offer-handoff__advisor-exp">{advisor.experience}</p>
            <p className="cc-offer-handoff__advisor-message">{advisor.message}</p>
          </div>
        </div>
      </article>

      <form className="cc-offer-handoff__form" onSubmit={handleSubmit} noValidate>
        <div className="cc-offer-handoff__contact-block">
          <p className="cc-offer-handoff__contact-lead">Damit Ihr Berater Sie erreichen kann</p>

          <div className="cc-offer-handoff__contact-fields">
            <div className="cc-offer-handoff__name-group">
              {nameHint && (
                <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                  {nameHint}
                </p>
              )}
              <input
                type="text"
                className="cc-offer-handoff__input"
                autoComplete="given-name"
                placeholder="Vorname"
                aria-label="Vorname"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                aria-invalid={Boolean(errors.firstName)}
              />
              <input
                type="text"
                className="cc-offer-handoff__input"
                autoComplete="family-name"
                placeholder="Nachname"
                aria-label="Nachname"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                aria-invalid={Boolean(errors.lastName)}
              />
            </div>

            <div className="cc-offer-handoff__field-line">
              <input
                type="email"
                className="cc-offer-handoff__input"
                autoComplete="email"
                placeholder="E-Mail"
                aria-label="E-Mail"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <input
              type="tel"
              className="cc-offer-handoff__input cc-offer-handoff__input--optional"
              autoComplete="tel"
              placeholder="Telefon – optional"
              aria-label="Telefon, optional"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
        </div>

        <div className="cc-offer-handoff__pick-group">
          <p className="cc-offer-handoff__pick-label">Bevorzugte Kontaktart</p>
          <div className="cc-offer-handoff__chips" role="group" aria-label="Bevorzugte Kontaktart">
            {CONTACT_PREFERENCES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`cc-option-chip cc-offer-handoff__chip${
                  form.contactPreference === option.id ? ' cc-offer-handoff__chip--selected' : ''
                }`}
                aria-pressed={form.contactPreference === option.id}
                onClick={() => updateField('contactPreference', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cc-offer-handoff__pick-group">
          <p className="cc-offer-handoff__pick-label">Wann dürfen wir uns bei Ihnen melden?</p>
          <div className="cc-offer-handoff__chips" role="group" aria-label="Wann dürfen wir uns melden">
            {CONTACT_TIMING_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`cc-option-chip cc-offer-handoff__chip${
                  form.contactTiming === option.id ? ' cc-offer-handoff__chip--selected' : ''
                }`}
                aria-pressed={form.contactTiming === option.id}
                onClick={() => updateField('contactTiming', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="cc-offer-handoff__cta">
          Persönliche Beratung anfordern
        </button>
      </form>
    </section>
  );
}
