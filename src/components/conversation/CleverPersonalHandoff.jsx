import { useEffect, useMemo, useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { validateHandoffForm } from '../../services/consultation/consultationOfferHandoff.js';
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
import { buildEquipmentCategoryView } from '../../services/consultation/wishHandoffEquipment.js';
import './clever-conversation.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactPreference: 'platform',
  contactTiming: null,
  contactIntent: null,
  advisorNote: '',
  privacyAccepted: false,
};

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="cc-offer-handoff__pick-group">
      {label && <p className="cc-offer-handoff__pick-label">{label}</p>}
      <div className="cc-offer-handoff__chips" role="group" aria-label={label || 'Auswahl'}>
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

function Accordion({ id, title, icon, open, onToggle, summary = null, children }) {
  return (
    <div className={`cc-handoff-acc${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="cc-handoff-acc__head"
        aria-expanded={open}
        aria-controls={`cc-acc-${id}`}
        onClick={() => onToggle(id)}
      >
        <span className="cc-handoff-acc__icon" aria-hidden>{icon}</span>
        <span className="cc-handoff-acc__title">{title}</span>
        {summary && <span className="cc-handoff-acc__summary">{summary}</span>}
        <span className="cc-handoff-acc__chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div id={`cc-acc-${id}`} className="cc-handoff-acc__body">
          {children}
        </div>
      )}
    </div>
  );
}

function buildSubmitPayload(form, authEmail, enrichment) {
  return {
    ...form,
    email: authEmail || form.email,
    contactPreference: 'platform',
    contactTiming: null,
    contactIntent: null,
    phone: '',
    enrichment,
  };
}

export default function CleverPersonalHandoff({ handoffView, onSubmit, onEnrichmentChange }) {
  const initialEnrichment = useMemo(
    () => prefillWishHandoffEnrichment(
      handoffView?.needProfile ?? {},
      handoffView?.wishLabels ?? [],
    ),
    [handoffView?.needProfile, handoffView?.wishLabels],
  );

  const [step, setStep] = useState('auth');
  const [enrichment, setEnrichment] = useState(initialEnrichment);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [openAcc, setOpenAcc] = useState(null);
  const [openEquipCat, setOpenEquipCat] = useState(null);
  const [authPhase, setAuthPhase] = useState('email');
  const [loginCode, setLoginCode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    isLoggedIn,
    email: authEmail,
    requestCode,
    verifyCode,
    resendCode,
    pendingEmail,
    demoCode,
    cancelLogin,
    saveProfile,
  } = useCustomerAuth();

  useEffect(() => {
    onEnrichmentChange?.(enrichment);
  }, [enrichment, onEnrichmentChange]);

  useEffect(() => {
    if (isLoggedIn && authEmail) {
      setForm((prev) => ({ ...prev, email: authEmail }));
      setAuthPhase('ready');
    }
  }, [isLoggedIn, authEmail]);

  if (!handoffView) return null;

  const nameHint = errors.firstName || errors.lastName;
  const title = handoffView.title || 'Übergabe';
  const notePlaceholder = handoffView.notePlaceholder || 'Notiz (optional)';
  const privacyText = handoffView.privacyText || 'Übergabe & Datenschutz';
  const privacyLinkHref = handoffView.privacyLinkHref || '/legal/datenschutz';
  const privacyLinkLabel = handoffView.privacyLinkLabel || 'Details';
  const submitLabel = handoffView.submitLabel || 'Übergeben';
  const advisor = handoffView.advisor;

  const equipmentCategories = buildEquipmentCategoryView(
    enrichment.equipmentWishIds ?? [],
    handoffView.wishLabels ?? [],
  );

  const timingSummary = VEHICLE_NEED_TIMING_OPTIONS.find((o) => o.id === enrichment.vehicleNeedTiming)?.label;
  const paySummary = ACQUISITION_OPTIONS.find((o) => o.id === enrichment.acquisitionType && o.id !== 'open')?.label;
  const equipCount = enrichment.equipmentWishIds?.length ?? 0;

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

  function toggleAcc(id) {
    setOpenAcc((prev) => (prev === id ? null : id));
  }

  function toggleEquipment(id) {
    setEnrichment((prev) => {
      const current = prev.equipmentWishIds ?? [];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...prev, equipmentWishIds: next };
    });
  }

  async function handleRequestLoginCode(event) {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    const result = await requestCode(form.email);
    setAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Code fehlt');
      return;
    }
    setForm((prev) => ({ ...prev, email: result.email || prev.email }));
    setAuthPhase('code');
  }

  function handleVerifyLoginCode(event) {
    event.preventDefault();
    setAuthError('');
    const result = verifyCode(loginCode);
    if (!result.ok) {
      setAuthError(result.error || 'Code falsch');
      return;
    }
    setAuthPhase('ready');
  }

  async function handleResendLoginCode() {
    setAuthError('');
    setAuthBusy(true);
    await resendCode();
    setAuthBusy(false);
  }

  function handleAuthBack() {
    setAuthPhase('email');
    setLoginCode('');
    setAuthError('');
    cancelLogin();
  }

  function handleGoToEnrich(event) {
    event.preventDefault();
    if (!isLoggedIn) {
      setAuthError('Zuerst anmelden');
      return;
    }
    const payload = buildSubmitPayload(form, authEmail, enrichment);
    const result = validateHandoffForm(payload);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setStep('enrich');
  }

  function finalizeSubmit(nextEnrichment) {
    if (!isLoggedIn) {
      setAuthError('Zuerst anmelden');
      setStep('auth');
      return;
    }
    const payload = buildSubmitPayload(form, authEmail, nextEnrichment);
    const result = validateHandoffForm(payload);
    if (!result.valid) {
      setErrors(result.errors);
      setStep('auth');
      return;
    }
    saveProfile?.({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    });
    onSubmit?.(payload);
  }

  function handleSubmitEnrichment() {
    finalizeSubmit(enrichment);
  }

  function handleSkipEnrichment() {
    const empty = emptyWishHandoffEnrichment();
    setEnrichment(empty);
    finalizeSubmit(empty);
  }

  const showPurchaseSpecial = enrichment.acquisitionType === 'purchase';
  const showLeasing = enrichment.acquisitionType === 'leasing';
  const showFinance = enrichment.acquisitionType === 'finance';
  const platformReady = isLoggedIn && authPhase === 'ready';

  return (
    <section className="cc-offer-handoff cc-turn-enter" aria-labelledby="cc-offer-handoff-title">
      <p className="cc-offer-handoff__ready" aria-hidden>✓</p>
      <h2 id="cc-offer-handoff-title" className="cc-offer-handoff__title">
        {title}
      </h2>

      {advisor && (
        <div className="cc-offer-handoff__trust" aria-label="Ihr Verkäufer">
          <div className="cc-offer-handoff__trust-avatar" aria-hidden>
            {advisor.initials || 'V'}
          </div>
          <div className="cc-offer-handoff__trust-copy">
            <p className="cc-offer-handoff__trust-line">
              {handoffView.trustLine || advisor.name}
            </p>
            {handoffView.trustSla && (
              <p className="cc-offer-handoff__trust-sla">{handoffView.trustSla}</p>
            )}
          </div>
        </div>
      )}

      {step === 'auth' && (
        <div className="cc-offer-handoff__form">
          {!platformReady && authPhase === 'email' && (
            <form className="cc-offer-handoff__auth" onSubmit={handleRequestLoginCode} noValidate>
              <input
                type="email"
                className="cc-offer-handoff__input"
                autoComplete="email"
                placeholder="E-Mail"
                aria-label="E-Mail"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={Boolean(errors.email || authError)}
              />
              {(errors.email || authError) && (
                <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                  {errors.email || authError}
                </p>
              )}
              <button type="submit" className="cc-offer-handoff__cta" disabled={authBusy}>
                {authBusy ? '…' : 'Code senden'}
              </button>
            </form>
          )}

          {!platformReady && authPhase === 'code' && (
            <form className="cc-offer-handoff__auth" onSubmit={handleVerifyLoginCode} noValidate>
              <button type="button" className="cc-offer-handoff__back" onClick={handleAuthBack}>
                ← {pendingEmail || form.email}
              </button>
              {demoCode && (
                <p className="cc-offer-handoff__auth-demo" role="status">
                  <strong>{demoCode}</strong>
                </p>
              )}
              <input
                type="text"
                className="cc-offer-handoff__input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code"
                aria-label="Code"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              {authError && (
                <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                className="cc-offer-handoff__cta"
                disabled={loginCode.length < 6}
              >
                Weiter
              </button>
              <button
                type="button"
                className="cc-offer-handoff__skip"
                onClick={handleResendLoginCode}
                disabled={authBusy}
              >
                Neu senden
              </button>
            </form>
          )}

          {platformReady && (
            <form onSubmit={handleGoToEnrich} noValidate>
              <p className="cc-offer-handoff__auth-ready" role="status">
                {authEmail || form.email}
              </p>

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
                </div>
              </div>

              <div className="cc-offer-handoff__note-block">
                <textarea
                  className="cc-offer-handoff__note"
                  rows={2}
                  placeholder={notePlaceholder}
                  aria-label="Notiz"
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

              {authError && (
                <p className="cc-offer-handoff__field-hint cc-offer-handoff__field-hint--warn" role="alert">
                  {authError}
                </p>
              )}

              <button type="submit" className="cc-offer-handoff__cta">
                Weiter
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'enrich' && (
        <div className="cc-offer-handoff__enrich" aria-label="Angaben ergänzen">
          <button
            type="button"
            className="cc-offer-handoff__back"
            onClick={() => setStep('auth')}
          >
            ← {authEmail || form.email}
          </button>

          <Accordion
            id="availability"
            title="Verfügbarkeit"
            icon="📅"
            open={openAcc === 'availability'}
            onToggle={toggleAcc}
            summary={timingSummary || null}
          >
            <ChipGroup
              options={VEHICLE_NEED_TIMING_OPTIONS}
              value={enrichment.vehicleNeedTiming}
              onChange={(id) => patchEnrichment({ vehicleNeedTiming: id })}
            />
          </Accordion>

          <Accordion
            id="payment"
            title="Bezahlung"
            icon="💶"
            open={openAcc === 'payment'}
            onToggle={toggleAcc}
            summary={paySummary || null}
          >
            <ChipGroup
              options={ACQUISITION_OPTIONS}
              value={enrichment.acquisitionType}
              onChange={(id) => patchEnrichment({
                acquisitionType: id,
                specialConditionId: id === 'purchase' ? enrichment.specialConditionId : null,
              })}
            />

            {showPurchaseSpecial && (
              <ChipGroup
                label="Kundengruppe"
                options={PURCHASE_SPECIAL_OPTIONS}
                value={enrichment.specialConditionId}
                onChange={(id) => patchEnrichment({ specialConditionId: id })}
              />
            )}

            {showLeasing && (
              <div className="cc-offer-handoff__branch">
                <ChipGroup
                  label="Laufzeit"
                  options={LEASING_TERM_OPTIONS}
                  value={enrichment.leasing?.termId}
                  onChange={(id) => patchNested('leasing', { termId: id })}
                />
                <ChipGroup
                  label="km / Jahr"
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
                    placeholder="Wunschrate €"
                    aria-label="Wunschrate"
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
              label="Inzahlungnahme"
              options={HANDOFF_TRADE_IN_OPTIONS}
              value={enrichment.tradeIn}
              onChange={(id) => patchEnrichment({ tradeIn: id })}
            />
          </Accordion>

          <Accordion
            id="equipment"
            title="Ausstattung"
            icon="💺"
            open={openAcc === 'equipment'}
            onToggle={toggleAcc}
            summary={equipCount > 0 ? `${equipCount}` : null}
          >
            <div className="cc-handoff-equip">
              {equipmentCategories.map((category) => {
                const catOpen = openEquipCat === category.id;
                const selectedInCat = category.chips.filter((c) => c.selected).length;
                return (
                  <div key={category.id} className={`cc-handoff-equip__cat${catOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="cc-handoff-equip__cat-head"
                      aria-expanded={catOpen}
                      onClick={() => setOpenEquipCat((prev) => (prev === category.id ? null : category.id))}
                    >
                      <span aria-hidden>{category.icon}</span>
                      <span>{category.label}</span>
                      {selectedInCat > 0 && (
                        <span className="cc-handoff-equip__cat-count">{selectedInCat}</span>
                      )}
                      <span aria-hidden>{catOpen ? '▾' : '▸'}</span>
                    </button>
                    {catOpen && (
                      <div className="cc-handoff-equip__chips" role="group" aria-label={category.label}>
                        {category.chips.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            className={`cc-option-chip cc-offer-handoff__chip${
                              chip.selected ? ' cc-offer-handoff__chip--selected' : ''
                            }`}
                            aria-pressed={chip.selected}
                            onClick={() => toggleEquipment(chip.id)}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Accordion>

          <div className="cc-offer-handoff__enrich-actions">
            <button
              type="button"
              className="cc-offer-handoff__cta"
              onClick={handleSubmitEnrichment}
            >
              {submitLabel}
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
    </section>
  );
}
