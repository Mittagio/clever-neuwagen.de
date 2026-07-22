import { useState } from 'react';
import {
  CONTACT_PREFERENCES,
  CONTACT_TIMING_OPTIONS,
  validateHandoffForm,
} from '../../services/consultation/consultationOfferHandoff.js';
import CleverWishProfile from './CleverWishProfile.jsx';
import './clever-conversation.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactPreference: 'whatsapp',
  contactTiming: 'this_week',
};

const CHANNEL_ORDER = ['whatsapp', 'email', 'phone'];

export default function CleverPersonalHandoff({ handoffView, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  if (!handoffView) return null;

  const contactPrefs = [...CONTACT_PREFERENCES].sort((a, b) => (
    CHANNEL_ORDER.indexOf(a.id) - CHANNEL_ORDER.indexOf(b.id)
  ));

  const nameHint = errors.firstName || errors.lastName;
  const title = handoffView.title || 'Wünsche bereit zur Übergabe';
  const intro = handoffView.intro
    || 'Alles klar. Ich gebe Ihre bisherigen Wünsche und unser Gespräch an den Verkäufer weiter.';
  const contactLead = handoffView.contactLead || 'Wie dürfen wir uns bei Ihnen melden?';
  const timingLead = handoffView.timingLead || 'Wann passt es ungefähr?';
  const submitLabel = handoffView.submitLabel || 'Wünsche übergeben';

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
      <p className="cc-offer-handoff__ready" aria-hidden>✓ Wünsche bereit zur Übergabe</p>
      <h2 id="cc-offer-handoff-title" className="cc-offer-handoff__title">
        {title}
      </h2>
      <p className="cc-offer-handoff__intro">{intro}</p>

      <div className="cc-offer-handoff__prepared">
        <p className="cc-offer-handoff__section-label">
          {handoffView.wishesHeading || 'Ihre bisherigen Wünsche'}
        </p>
        {handoffView.wishProfile && (
          <CleverWishProfile profile={handoffView.wishProfile} />
        )}
        {!handoffView.wishProfile && (handoffView.wishLabels?.length > 0) && (
          <ul className="cc-offer-handoff__wish-chips" aria-label="Bisherige Wünsche">
            {handoffView.wishLabels.map((label) => (
              <li key={label} className="cc-offer-handoff__wish-chip">{label}</li>
            ))}
          </ul>
        )}
      </div>

      <form className="cc-offer-handoff__form" onSubmit={handleSubmit} noValidate>
        <div className="cc-offer-handoff__pick-group">
          <p className="cc-offer-handoff__pick-label">{contactLead}</p>
          <div className="cc-offer-handoff__chips" role="group" aria-label="Kontaktweg">
            {contactPrefs.map((option) => (
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

        <div className="cc-offer-handoff__contact-block">
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
          <p className="cc-offer-handoff__pick-label">{timingLead}</p>
          <div className="cc-offer-handoff__chips" role="group" aria-label="Wann passt es">
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
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
