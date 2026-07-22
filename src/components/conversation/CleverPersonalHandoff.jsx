import { useEffect, useMemo, useState } from 'react';
import {
  CONTACT_PREFERENCES,
  CONTACT_TIMING_OPTIONS,
  HANDOFF_INTENT_OPTIONS,
  PHONE_REQUIRED_CONTACT_PREFS,
  validateHandoffForm,
} from '../../services/consultation/consultationOfferHandoff.js';
import {
  ACQUISITION_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FINANCE_BALLOON_OPTIONS,
  FINANCE_TERM_OPTIONS,
  HANDOFF_TRADE_IN_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
  PURCHASE_SPECIAL_OPTIONS,
  VEHICLE_NEED_TIMING_OPTIONS,
  emptyWishHandoffEnrichment,
  prefillWishHandoffEnrichment,
} from '../../services/consultation/wishHandoffEnrichment.js';
import CleverWishProfile from './CleverWishProfile.jsx';
import './clever-conversation.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactPreference: 'whatsapp',
  contactTiming: 'this_week',
  contactIntent: 'callback',
  advisorNote: '',
  privacyAccepted: false,
};

const CHANNEL_ORDER = ['whatsapp', 'email', 'phone'];

function ChipGroup({ label, options, value, onChange, optionalNote = null }) {
  return (
    <div className="cc-offer-handoff__pick-group">
      <p className="cc-offer-handoff__pick-label">
        {label}
        {optionalNote && <span className="cc-offer-handoff__optional"> · {optionalNote}</span>}
      </p>
      <div className="cc-offer-handoff__chips" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`cc-option-chip cc-offer-handoff__chip${
              value === option.id ? ' cc-offer-handoff__chip--selected' : ''
            }`}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CleverPersonalHandoff({ handoffView, onSubmit, onEnrichmentChange }) {
  const initialEnrichment = useMemo(
    () => prefillWishHandoffEnrichment(
      handoffView?.needProfile ?? {},
      handoffView?.wishLabels ?? [],
    ),
    [handoffView?.needProfile, handoffView?.wishLabels],
  );

  const [step, setStep] = useState('enrich');
  const [enrichment, setEnrichment] = useState(initialEnrichment);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    onEnrichmentChange?.(enrichment);
  }, [enrichment, onEnrichmentChange]);

  if (!handoffView) return null;

  const contactPrefs = [...CONTACT_PREFERENCES].sort((a, b) => (
    CHANNEL_ORDER.indexOf(a.id) - CHANNEL_ORDER.indexOf(b.id)
  ));

  const nameHint = errors.firstName || errors.lastName;
  const title = handoffView.title || 'Wünsche bereit zur Übergabe';
  const intro = handoffView.intro
    || 'Alles klar. Ich gebe Ihre bisherigen Wünsche und unser Gespräch an den Verkäufer weiter.';
  const contactLead = handoffView.contactLead || 'Wie dürfen wir uns bei Ihnen melden?';
  const intentLead = handoffView.intentLead || 'Worum soll es gehen?';
  const timingLead = handoffView.timingLead || 'Wann passt es ungefähr?';
  const noteLabel = handoffView.noteLabel || 'Gibt es noch etwas, das Ihr Verkäufer wissen sollte?';
  const notePlaceholder = handoffView.notePlaceholder
    || 'z. B. Lieber nachmittags · Farbe Blau wäre schön';
  const privacyText = handoffView.privacyText
    || 'Mit dem Absenden willige ich ein, dass meine Angaben an den Verkäufer weitergegeben werden.';
  const privacyLinkHref = handoffView.privacyLinkHref || '/legal/datenschutz';
  const privacyLinkLabel = handoffView.privacyLinkLabel || 'Datenschutz';
  const submitLabel = handoffView.submitLabel || 'Wünsche übergeben';
  const advisor = handoffView.advisor;
  const phoneRequired = PHONE_REQUIRED_CONTACT_PREFS.has(form.contactPreference);

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

  function patchEnrichment(patch) {
    setEnrichment((prev) => ({ ...prev, ...patch }));
  }

  function patchNested(key, patch) {
    setEnrichment((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...patch },
    }));
  }

  function goToContact() {
    setStep('contact');
  }

  function handleSkipEnrichment() {
    setEnrichment(emptyWishHandoffEnrichment());
    goToContact();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateHandoffForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSubmit?.({
      ...form,
      enrichment,
    });
  }

  const showPurchaseSpecial = enrichment.acquisitionType === 'purchase';
  const showLeasing = enrichment.acquisitionType === 'leasing';
  const showFinance = enrichment.acquisitionType === 'finance';

  return (
    <section className="cc-offer-handoff cc-turn-enter" aria-labelledby="cc-offer-handoff-title">
      <p className="cc-offer-handoff__ready" aria-hidden>✓ Wünsche bereit zur Übergabe</p>
      <h2 id="cc-offer-handoff-title" className="cc-offer-handoff__title">
        {title}
      </h2>
      <p className="cc-offer-handoff__intro">{intro}</p>

      {advisor && (
        <div className="cc-offer-handoff__trust" aria-label="Ihr Verkäufer">
          <div className="cc-offer-handoff__trust-avatar" aria-hidden>
            {advisor.initials || 'V'}
          </div>
          <div className="cc-offer-handoff__trust-copy">
            <p className="cc-offer-handoff__trust-line">
              {handoffView.trustLine || advisor.name}
            </p>
            <p className="cc-offer-handoff__trust-sla">
              {handoffView.trustSla || 'In der Regel Rückmeldung innerhalb eines Werktags.'}
            </p>
          </div>
        </div>
      )}

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

      {step === 'enrich' && (
        <div className="cc-offer-handoff__enrich" aria-label="Optionale Angaben für den Verkäufer">
          <p className="cc-offer-handoff__section-label">Optional für den Verkäufer</p>
          <p className="cc-offer-handoff__enrich-lead">
            Damit Ihr Verkäufer noch gezielter einsteigen kann – alles freiwillig.
          </p>

          <ChipGroup
            label="Wann brauchen Sie das Fahrzeug?"
            optionalNote="optional"
            options={VEHICLE_NEED_TIMING_OPTIONS}
            value={enrichment.vehicleNeedTiming}
            onChange={(id) => patchEnrichment({ vehicleNeedTiming: id })}
          />

          <ChipGroup
            label="Wie möchten Sie es anschaffen?"
            optionalNote="optional"
            options={ACQUISITION_OPTIONS}
            value={enrichment.acquisitionType}
            onChange={(id) => patchEnrichment({
              acquisitionType: id,
              specialConditionId: id === 'purchase' ? enrichment.specialConditionId : null,
            })}
          />

          {showPurchaseSpecial && (
            <ChipGroup
              label="Gibt es besondere Konditionen?"
              optionalNote="optional"
              options={PURCHASE_SPECIAL_OPTIONS}
              value={enrichment.specialConditionId}
              onChange={(id) => patchEnrichment({ specialConditionId: id })}
            />
          )}

          {showLeasing && (
            <div className="cc-offer-handoff__branch">
              <p className="cc-offer-handoff__branch-title">Leasing-Rahmen</p>
              <ChipGroup
                label="Laufzeit"
                options={LEASING_TERM_OPTIONS}
                value={enrichment.leasing?.termId}
                onChange={(id) => patchNested('leasing', { termId: id })}
              />
              <ChipGroup
                label="Kilometer pro Jahr"
                options={LEASING_MILEAGE_OPTIONS}
                value={enrichment.leasing?.mileageId}
                onChange={(id) => patchNested('leasing', { mileageId: id })}
              />
              <ChipGroup
                label="Anzahlung"
                options={DOWN_PAYMENT_OPTIONS}
                value={enrichment.leasing?.downPayment}
                onChange={(id) => patchNested('leasing', { downPayment: id })}
              />
            </div>
          )}

          {showFinance && (
            <div className="cc-offer-handoff__branch">
              <p className="cc-offer-handoff__branch-title">Finanzierungs-Rahmen</p>
              <ChipGroup
                label="Laufzeit"
                options={FINANCE_TERM_OPTIONS}
                value={enrichment.finance?.termId}
                onChange={(id) => patchNested('finance', { termId: id })}
              />
              <ChipGroup
                label="Anzahlung"
                options={DOWN_PAYMENT_OPTIONS}
                value={enrichment.finance?.downPayment}
                onChange={(id) => patchNested('finance', { downPayment: id })}
              />
              <div className="cc-offer-handoff__field-line">
                <input
                  type="number"
                  inputMode="numeric"
                  className="cc-offer-handoff__input cc-offer-handoff__input--optional"
                  placeholder="Wunschrate € / Monat – optional"
                  aria-label="Wunschrate optional"
                  value={enrichment.finance?.desiredRate ?? ''}
                  onChange={(e) => patchNested('finance', { desiredRate: e.target.value })}
                />
              </div>
              <ChipGroup
                label="Schlussrate"
                options={FINANCE_BALLOON_OPTIONS}
                value={enrichment.finance?.balloon}
                onChange={(id) => patchNested('finance', { balloon: id })}
              />
            </div>
          )}

          <ChipGroup
            label="Möchten Sie ein Fahrzeug in Zahlung geben?"
            optionalNote="optional"
            options={HANDOFF_TRADE_IN_OPTIONS}
            value={enrichment.tradeIn}
            onChange={(id) => patchEnrichment({ tradeIn: id })}
          />

          <div className="cc-offer-handoff__enrich-actions">
            <button
              type="button"
              className="cc-offer-handoff__cta"
              onClick={goToContact}
            >
              Weiter zur Kontaktangabe
            </button>
            <button
              type="button"
              className="cc-offer-handoff__skip"
              onClick={handleSkipEnrichment}
            >
              Überspringen
            </button>
          </div>
        </div>
      )}

      {step === 'contact' && (
        <form className="cc-offer-handoff__form" onSubmit={handleSubmit} noValidate>
          <button
            type="button"
            className="cc-offer-handoff__back"
            onClick={() => setStep('enrich')}
          >
            ← Angaben anpassen
          </button>

          <ChipGroup
            label={intentLead}
            options={HANDOFF_INTENT_OPTIONS}
            value={form.contactIntent}
            onChange={(id) => updateField('contactIntent', id)}
          />

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

              <div className="cc-offer-handoff__field-line">
                <input
                  type="tel"
                  className={`cc-offer-handoff__input${
                    phoneRequired ? '' : ' cc-offer-handoff__input--optional'
                  }`}
                  autoComplete="tel"
                  placeholder={phoneRequired ? 'Telefon' : 'Telefon – optional'}
                  aria-label={phoneRequired ? 'Telefon' : 'Telefon, optional'}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && (
                  <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>
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

          <div className="cc-offer-handoff__note-block">
            <p className="cc-offer-handoff__pick-label">
              {noteLabel}
              <span className="cc-offer-handoff__optional"> · optional</span>
            </p>
            <textarea
              className="cc-offer-handoff__note"
              rows={3}
              placeholder={notePlaceholder}
              aria-label={noteLabel}
              value={form.advisorNote}
              onChange={(e) => updateField('advisorNote', e.target.value)}
            />
          </div>

          <div className="cc-offer-handoff__privacy">
            <label className="cc-offer-handoff__privacy-label">
              <input
                type="checkbox"
                className="cc-offer-handoff__privacy-check"
                checked={form.privacyAccepted}
                onChange={(e) => updateField('privacyAccepted', e.target.checked)}
                aria-invalid={Boolean(errors.privacyAccepted)}
              />
              <span>
                {privacyText}
                {' '}
                <a
                  href={privacyLinkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cc-offer-handoff__privacy-link"
                >
                  {privacyLinkLabel}
                </a>
              </span>
            </label>
            {errors.privacyAccepted && (
              <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                {errors.privacyAccepted}
              </p>
            )}
          </div>

          <button type="submit" className="cc-offer-handoff__cta">
            {submitLabel}
          </button>
        </form>
      )}
    </section>
  );
}
