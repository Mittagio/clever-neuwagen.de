import { useEffect, useMemo, useRef, useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { validateHandoffForm } from '../../services/consultation/consultationOfferHandoff.js';
import {
  emptyWishHandoffEnrichment,
  prefillWishHandoffEnrichment,
} from '../../services/consultation/wishHandoffEnrichment.js';
import {
  buildSoftWishEnrichmentSuggestions,
  sanitizeSoftWishSuggestions,
} from '../../services/consultation/softWishEnrichmentSuggestions.js';
import { mergeTextIntoNeedProfile } from '../../services/consultation/needProfileService.js';
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

function buildSubmitPayload(form, authEmail, enrichment) {
  const email = authEmail || form.email;
  const local = String(email ?? '').split('@')[0] || 'Kunde';
  return {
    ...form,
    email,
    firstName: form.firstName?.trim() || local,
    lastName: form.lastName?.trim() || '',
    contactPreference: 'platform',
    contactTiming: null,
    contactIntent: null,
    phone: '',
    enrichment,
  };
}

function SoftWishChip({ suggestion, flying, onSelect }) {
  return (
    <button
      type="button"
      className={`cc-soft-wish__chip${flying ? ' is-flying' : ''}`}
      onClick={() => onSelect?.(suggestion)}
    >
      <span className="cc-soft-wish__chip-icon" aria-hidden>{suggestion.icon || '·'}</span>
      <span>{suggestion.label}</span>
    </button>
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

  const [step, setStep] = useState('soft');
  const [enrichment, setEnrichment] = useState(initialEnrichment);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [authPhase, setAuthPhase] = useState('email');
  const [loginCode, setLoginCode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [freetext, setFreetext] = useState('');
  const [flyingId, setFlyingId] = useState(null);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState([]);
  const codeAutoSubmitRef = useRef(false);

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

  const suggestions = useMemo(() => {
    const ctx = {
      needProfile: handoffView?.needProfile ?? {},
      notepadLabels: [
        ...(handoffView?.wishLabels ?? []),
        ...(enrichment.softExtraLabels ?? []),
      ],
      max: 6,
    };
    const fromAi = handoffView?.handoffSuggestions;
    const list = fromAi?.length
      ? sanitizeSoftWishSuggestions(fromAi, ctx)
      : buildSoftWishEnrichmentSuggestions(ctx);
    return list.filter((item) => !dismissedSuggestionIds.includes(item.id));
  }, [
    handoffView?.needProfile,
    handoffView?.wishLabels,
    handoffView?.handoffSuggestions,
    enrichment.softExtraLabels,
    dismissedSuggestionIds,
  ]);

  useEffect(() => {
    onEnrichmentChange?.(enrichment);
  }, [enrichment, onEnrichmentChange]);

  useEffect(() => {
    if (isLoggedIn && authEmail) {
      setForm((prev) => ({ ...prev, email: authEmail }));
      if (step === 'identify' && authPhase === 'code') {
        // stay on success path via finalize
      }
    }
  }, [isLoggedIn, authEmail, step, authPhase]);

  if (!handoffView) return null;

  const title = handoffView.title || 'Meine Wünsche weitergeben';
  const softHeadline = handoffView.softHeadline
    || 'Möchten Sie dem Verkäufer noch etwas mitgeben?';
  const softSubline = handoffView.softSubline
    || 'Damit er direkt weiß, worauf es Ihnen ankommt.';
  const identifyIntro = handoffView.intro
    || 'Damit Ihre Wünsche beim richtigen Ansprechpartner landen, bestätigen Sie bitte kurz Ihre E-Mail-Adresse.';
  const trustNote = handoffView.trustNote
    || 'Ihr Notizzettel und der bisherige Gesprächsverlauf werden gemeinsam weitergegeben.';
  const privacyText = handoffView.privacyText || 'Datenschutz';
  const privacyLinkHref = handoffView.privacyLinkHref || '/legal/datenschutz';
  const privacyLinkLabel = handoffView.privacyLinkLabel || 'Details';
  const advisor = handoffView.advisor;
  const dealerName = handoffView.dealerName || 'unser Verkaufsteam';

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

  function selectSuggestion(suggestion) {
    if (!suggestion) return;
    setFlyingId(suggestion.id);
    window.setTimeout(() => setFlyingId(null), 520);

    setEnrichment((prev) => {
      const next = { ...prev };
      if (suggestion.equipmentWishId) {
        const current = prev.equipmentWishIds ?? [];
        if (!current.includes(suggestion.equipmentWishId)) {
          next.equipmentWishIds = [...current, suggestion.equipmentWishId];
        }
      } else {
        const label = suggestion.customerNoteValue || suggestion.label;
        const extras = prev.softExtraLabels ?? [];
        if (label && !extras.includes(label)) {
          next.softExtraLabels = [...extras, label];
        }
      }
      return next;
    });

    setDismissedSuggestionIds((prev) => (
      prev.includes(suggestion.id) ? prev : [...prev, suggestion.id]
    ));
  }

  function applyFreetextWish() {
    const text = String(freetext ?? '').trim();
    if (!text) return;
    const recognized = mergeTextIntoNeedProfile(text, handoffView?.needProfile ?? {});
    const newLabels = (recognized.understoodLabels ?? []).filter(
      (label) => !(handoffView?.wishLabels ?? []).includes(label),
    );
    setEnrichment((prev) => {
      const extras = [...(prev.softExtraLabels ?? [])];
      for (const label of newLabels.length ? newLabels : [text.slice(0, 48)]) {
        if (!extras.includes(label)) extras.push(label);
      }
      return { ...prev, softExtraLabels: extras };
    });
    setFreetext('');
  }

  function goToIdentify() {
    setStep('identify');
    setAuthPhase(isLoggedIn ? 'email' : 'email');
    setAuthError('');
  }

  async function handleRequestLoginCode(event) {
    event.preventDefault();
    setAuthError('');
    if (!form.privacyAccepted) {
      setErrors({ privacyAccepted: 'Bitte bestätigen' });
      return;
    }
    setAuthBusy(true);
    const result = await requestCode(form.email);
    setAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Code fehlt');
      return;
    }
    setForm((prev) => ({ ...prev, email: result.email || prev.email }));
    setAuthPhase('code');
    codeAutoSubmitRef.current = false;
  }

  function finalizeSubmit(nextEnrichment) {
    const payload = buildSubmitPayload(form, authEmail || form.email, nextEnrichment);
    const result = validateHandoffForm(payload);
    if (!result.valid) {
      setErrors(result.errors);
      setStep('identify');
      setAuthPhase('email');
      return;
    }
    saveProfile?.({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    });
    onSubmit?.(payload);
  }

  function handleVerifyLoginCode(event) {
    event?.preventDefault?.();
    setAuthError('');
    const result = verifyCode(loginCode);
    if (!result.ok) {
      setAuthError(result.error || 'Code falsch');
      return;
    }
    finalizeSubmit(enrichment);
  }

  useEffect(() => {
    if (authPhase !== 'code') return undefined;
    if (loginCode.length < 6) return undefined;
    if (codeAutoSubmitRef.current) return undefined;
    codeAutoSubmitRef.current = true;
    const timer = window.setTimeout(() => {
      handleVerifyLoginCode();
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginCode, authPhase]);

  async function handleResendLoginCode() {
    setAuthError('');
    setAuthBusy(true);
    await resendCode();
    setAuthBusy(false);
    codeAutoSubmitRef.current = false;
  }

  function handleAuthBack() {
    setAuthPhase('email');
    setLoginCode('');
    setAuthError('');
    codeAutoSubmitRef.current = false;
    cancelLogin();
  }

  return (
    <section className="cc-offer-handoff cc-soft-handoff cc-turn-enter" aria-labelledby="cc-offer-handoff-title">
      {step === 'soft' && (
        <div className="cc-soft-wish" aria-label="Wünsche ergänzen">
          <h2 id="cc-offer-handoff-title" className="cc-soft-wish__headline">
            {softHeadline}
          </h2>
          <p className="cc-soft-wish__sub">{softSubline}</p>

          {suggestions.length > 0 && (
            <div className="cc-soft-wish__chips" role="group" aria-label="Vorschläge">
              {suggestions.map((suggestion) => (
                <SoftWishChip
                  key={suggestion.id}
                  suggestion={suggestion}
                  flying={flyingId === suggestion.id}
                  onSelect={selectSuggestion}
                />
              ))}
            </div>
          )}

          <div className="cc-soft-wish__freetext">
            <p className="cc-soft-wish__freetext-label">Etwas anderes?</p>
            <div className="cc-soft-wish__freetext-row">
              <input
                type="text"
                className="cc-offer-handoff__input"
                placeholder="z. B. kein schwarzes Auto, unbedingt AHK …"
                aria-label="Weiteren Wunsch ergänzen"
                value={freetext}
                onChange={(e) => setFreetext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyFreetextWish();
                  }
                }}
              />
              <button
                type="button"
                className="cc-soft-wish__add"
                onClick={applyFreetextWish}
                disabled={!freetext.trim()}
              >
                +
              </button>
            </div>
          </div>

          <button type="button" className="cc-offer-handoff__cta" onClick={goToIdentify}>
            Weiter
          </button>
          <button type="button" className="cc-offer-handoff__skip" onClick={goToIdentify}>
            So passt es
          </button>
        </div>
      )}

      {step === 'identify' && (
        <div className="cc-soft-identify">
          <h2 id="cc-offer-handoff-title" className="cc-offer-handoff__title">
            {title}
          </h2>
          <p className="cc-soft-identify__intro">{identifyIntro}</p>
          <p className="cc-soft-identify__trust">{trustNote}</p>

          {advisor ? (
            <div className="cc-offer-handoff__trust cc-offer-handoff__trust--soft" aria-label="Ihr Verkäufer">
              <div className="cc-offer-handoff__trust-avatar" aria-hidden>
                {advisor.initials || 'V'}
              </div>
              <div className="cc-offer-handoff__trust-copy">
                <p className="cc-offer-handoff__trust-line">
                  {handoffView.trustLine || advisor.name}
                </p>
              </div>
            </div>
          ) : (
            <p className="cc-soft-identify__team">
              Ihre Wünsche gehen an {dealerName}.
            </p>
          )}

          {authPhase === 'email' && (
            <form className="cc-offer-handoff__auth" onSubmit={handleRequestLoginCode} noValidate>
              <label className="cc-soft-identify__field-label" htmlFor="cc-wish-email">
                E-Mail-Adresse
              </label>
              <input
                id="cc-wish-email"
                type="email"
                className="cc-offer-handoff__input"
                autoComplete="email"
                placeholder="name@email.de"
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

              <button type="submit" className="cc-offer-handoff__cta" disabled={authBusy}>
                {authBusy ? '…' : 'Code senden'}
              </button>
              <button type="button" className="cc-offer-handoff__skip" onClick={() => setStep('soft')}>
                Zurück
              </button>
            </form>
          )}

          {authPhase === 'code' && (
            <form className="cc-offer-handoff__auth" onSubmit={handleVerifyLoginCode} noValidate>
              <button type="button" className="cc-offer-handoff__back" onClick={handleAuthBack}>
                ← {pendingEmail || form.email}
              </button>
              <p className="cc-soft-identify__code-copy">
                Wir haben Ihnen gerade einen Bestätigungscode geschickt.
              </p>
              {demoCode && (
                <p className="cc-offer-handoff__auth-demo" role="status">
                  <strong>{demoCode}</strong>
                </p>
              )}
              <input
                type="text"
                className="cc-offer-handoff__input cc-soft-identify__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code"
                aria-label="Bestätigungscode"
                value={loginCode}
                onChange={(e) => {
                  codeAutoSubmitRef.current = false;
                  setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
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
        </div>
      )}
    </section>
  );
}
