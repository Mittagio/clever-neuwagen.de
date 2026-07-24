import { useEffect, useRef, useState } from 'react';
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
  mergeWishHandoffNotepadLabels,
  prefillWishHandoffEnrichment,
} from '../../services/consultation/wishHandoffEnrichment.js';
import {
  SOFT_EQUIPMENT_CATEGORY_CHIPS,
  buildEquipmentChipsForCategory,
} from '../../services/consultation/wishHandoffEquipment.js';
import { mergeTextIntoNeedProfile } from '../../services/consultation/needProfileService.js';
import { CleverNotepadSummary } from './CleverHandoffComplete.jsx';
import CleverVehicleModelRail from './CleverVehicleModelRail.jsx';
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

function resizeFreetextArea(el) {
  if (!el) return;
  el.style.height = '0px';
  el.style.height = `${Math.max(44, el.scrollHeight)}px`;
}

function SoftAccordion({ id, title, icon, open, onToggle, summary = null, children }) {
  return (
    <div className={`cc-handoff-acc${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="cc-handoff-acc__head"
        aria-expanded={open}
        aria-controls={`cc-soft-acc-${id}`}
        onClick={() => onToggle(id)}
      >
        <span className="cc-handoff-acc__icon" aria-hidden>{icon}</span>
        <span className="cc-handoff-acc__title">{title}</span>
        {summary && <span className="cc-handoff-acc__summary">{summary}</span>}
        <span className="cc-handoff-acc__chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div id={`cc-soft-acc-${id}`} className="cc-handoff-acc__body">
          {children}
        </div>
      )}
    </div>
  );
}

function SoftChipGroup({
  label = null,
  options,
  value,
  multi = false,
  selectedIds = [],
  flyingId = null,
  onSelect,
}) {
  return (
    <div className="cc-offer-handoff__pick-group">
      {label && <p className="cc-offer-handoff__pick-label">{label}</p>}
      <div className="cc-soft-wish__chips" role="group" aria-label={label || 'Auswahl'}>
        {options.map((option) => {
          const selected = multi
            ? selectedIds.includes(option.id)
            : value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={[
                'cc-soft-wish__chip',
                selected ? 'is-selected' : '',
                flyingId === option.id ? 'is-flying' : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
            >
              {option.icon && (
                <span className="cc-soft-wish__chip-icon" aria-hidden>{option.icon}</span>
              )}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CleverPersonalHandoff({
  handoffView,
  onSubmit,
  onEnrichmentChange,
  onOpenPriceList = null,
}) {
  const [step, setStep] = useState('soft');
  const [enrichment, setEnrichment] = useState(() => prefillWishHandoffEnrichment(
    handoffView?.needProfile ?? {},
    handoffView?.wishLabels ?? [],
  ));
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [authPhase, setAuthPhase] = useState('email');
  const [loginCode, setLoginCode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [freetext, setFreetext] = useState('');
  const [openAcc, setOpenAcc] = useState(null);
  const [equipCategory, setEquipCategory] = useState('comfort');
  const [flyingChipId, setFlyingChipId] = useState(null);
  const codeAutoSubmitRef = useRef(false);
  const freetextRef = useRef(null);
  const flyTimerRef = useRef(null);

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
    resizeFreetextArea(freetextRef.current);
  }, [freetext]);

  useEffect(() => {
    if (isLoggedIn && authEmail) {
      setForm((prev) => ({ ...prev, email: authEmail }));
    }
  }, [isLoggedIn, authEmail]);

  useEffect(() => () => {
    if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
  }, []);

  if (!handoffView) return null;

  const title = handoffView.title || 'Meine Wünsche weitergeben';
  const softHeadline = handoffView.softHeadline || 'Noch etwas?';
  const identifyIntro = handoffView.intro
    || 'Damit Ihre Wünsche beim richtigen Ansprechpartner landen, bestätigen Sie bitte kurz Ihre E-Mail-Adresse.';
  const trustNote = handoffView.trustNote
    || 'Ihr Notizzettel und der bisherige Gesprächsverlauf werden gemeinsam weitergegeben.';
  const privacyText = handoffView.privacyText || 'Datenschutz';
  const privacyLinkHref = handoffView.privacyLinkHref || '/legal/datenschutz';
  const privacyLinkLabel = handoffView.privacyLinkLabel || 'Details';
  const advisor = handoffView.advisor;
  const dealerName = handoffView.dealerName || 'unser Verkaufsteam';

  const timingSummary = VEHICLE_NEED_TIMING_OPTIONS.find(
    (o) => o.id === enrichment.vehicleNeedTiming,
  )?.label;
  const paySummary = ACQUISITION_OPTIONS.find(
    (o) => o.id === enrichment.acquisitionType && o.id !== 'open',
  )?.label;
  const equipCount = enrichment.equipmentWishIds?.length ?? 0;
  const showPurchaseSpecial = enrichment.acquisitionType === 'purchase';
  const showLeasing = enrichment.acquisitionType === 'leasing';
  const showFinance = enrichment.acquisitionType === 'finance';
  const liveNotepadLabels = mergeWishHandoffNotepadLabels(
    handoffView.wishLabels ?? [],
    enrichment,
  );

  function triggerSoftFly(chipId) {
    if (!chipId || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
    setFlyingChipId(chipId);
    flyTimerRef.current = window.setTimeout(() => {
      setFlyingChipId((prev) => (prev === chipId ? null : prev));
      flyTimerRef.current = null;
    }, 520);
  }

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

  function toggleAcc(id) {
    setOpenAcc((prev) => (prev === id ? null : id));
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

  function toggleEquipmentId(equipmentId) {
    if (!equipmentId) return;
    const current = enrichment.equipmentWishIds ?? [];
    const adding = !current.includes(equipmentId);
    if (adding) triggerSoftFly(equipmentId);
    setEnrichment((prev) => {
      const ids = prev.equipmentWishIds ?? [];
      const nextIds = ids.includes(equipmentId)
        ? ids.filter((id) => id !== equipmentId)
        : [...ids, equipmentId];
      return { ...prev, equipmentWishIds: nextIds };
    });
  }

  function selectEquipCategory(categoryId) {
    setEquipCategory(categoryId);
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
    setAuthPhase('email');
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

  const equipmentChips = buildEquipmentChipsForCategory(
    equipCategory,
    enrichment.equipmentWishIds ?? [],
    [
      ...(handoffView.wishLabels ?? []),
      ...(enrichment.softExtraLabels ?? []),
    ],
  );

  return (
    <section className="cc-offer-handoff cc-soft-handoff cc-turn-enter" aria-labelledby="cc-offer-handoff-title">
      {step === 'soft' && (
        <div className="cc-soft-wish" aria-label="Wünsche ergänzen">
          {(handoffView.focusModelCards?.length > 0) && (
            <CleverVehicleModelRail
              cards={handoffView.focusModelCards}
              reactions={handoffView.focusReactions ?? {}}
              needProfile={handoffView.needProfile ?? {}}
              notepadLabels={handoffView.wishLabels ?? []}
              onOpenPriceList={onOpenPriceList}
              ariaLabel="Gewähltes Modell"
            />
          )}

          <h2 id="cc-offer-handoff-title" className="cc-soft-wish__headline">
            {softHeadline}
          </h2>

          <SoftAccordion
            id="equipment"
            title="Ausstattung"
            icon="💺"
            open={openAcc === 'equipment'}
            onToggle={toggleAcc}
            summary={equipCount > 0 ? `${equipCount}` : null}
          >
            <div className="cc-soft-wish__cat-chips" role="group" aria-label="Ausstattungsbereich">
              {SOFT_EQUIPMENT_CATEGORY_CHIPS.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`cc-soft-wish__cat-chip${
                    equipCategory === category.id ? ' is-active' : ''
                  }`}
                  aria-pressed={equipCategory === category.id}
                  onClick={() => selectEquipCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {equipmentChips.length > 0 ? (
              <div className="cc-soft-wish__chips" role="group" aria-label={equipCategory}>
                {equipmentChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={[
                      'cc-soft-wish__chip',
                      chip.selected ? 'is-selected' : '',
                      flyingChipId === chip.id ? 'is-flying' : '',
                    ].filter(Boolean).join(' ')}
                    aria-pressed={chip.selected}
                    onClick={() => toggleEquipmentId(chip.id)}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="cc-soft-wish__empty">Bereits notiert.</p>
            )}
          </SoftAccordion>

          <SoftAccordion
            id="availability"
            title="Verfügbarkeit"
            icon="📅"
            open={openAcc === 'availability'}
            onToggle={toggleAcc}
            summary={timingSummary || null}
          >
            <SoftChipGroup
              options={VEHICLE_NEED_TIMING_OPTIONS}
              value={enrichment.vehicleNeedTiming}
              flyingId={flyingChipId}
              onSelect={(id) => {
                if (enrichment.vehicleNeedTiming !== id) triggerSoftFly(id);
                patchEnrichment({
                  vehicleNeedTiming: enrichment.vehicleNeedTiming === id ? null : id,
                });
              }}
            />
          </SoftAccordion>

          <SoftAccordion
            id="acquisition"
            title="Anschaffung"
            icon="💶"
            open={openAcc === 'acquisition'}
            onToggle={toggleAcc}
            summary={paySummary || null}
          >
            <SoftChipGroup
              options={ACQUISITION_OPTIONS}
              value={enrichment.acquisitionType}
              flyingId={flyingChipId}
              onSelect={(id) => {
                if (enrichment.acquisitionType !== id) triggerSoftFly(id);
                patchEnrichment({
                  acquisitionType: enrichment.acquisitionType === id ? null : id,
                  specialConditionId: id === 'purchase' ? enrichment.specialConditionId : null,
                });
              }}
            />

            {showPurchaseSpecial && (
              <SoftChipGroup
                label="Kundengruppe"
                options={PURCHASE_SPECIAL_OPTIONS}
                value={enrichment.specialConditionId}
                flyingId={flyingChipId}
                onSelect={(id) => {
                  if (enrichment.specialConditionId !== id) triggerSoftFly(id);
                  patchEnrichment({
                    specialConditionId: enrichment.specialConditionId === id ? null : id,
                  });
                }}
              />
            )}

            {showLeasing && (
              <div className="cc-offer-handoff__branch">
                <SoftChipGroup
                  label="Laufzeit"
                  options={LEASING_TERM_OPTIONS}
                  value={enrichment.leasing?.termId}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.leasing?.termId !== id) triggerSoftFly(id);
                    patchNested('leasing', { termId: id });
                  }}
                />
                <SoftChipGroup
                  label="km / Jahr"
                  options={LEASING_MILEAGE_OPTIONS}
                  value={enrichment.leasing?.mileageId}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.leasing?.mileageId !== id) triggerSoftFly(id);
                    patchNested('leasing', { mileageId: id });
                  }}
                />
                <SoftChipGroup
                  label="Anzahlung"
                  options={DOWN_PAYMENT_OPTIONS}
                  value={enrichment.leasing?.downPayment}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.leasing?.downPayment !== id) triggerSoftFly(id);
                    patchNested('leasing', { downPayment: id });
                  }}
                />
              </div>
            )}

            {showFinance && (
              <div className="cc-offer-handoff__branch">
                <SoftChipGroup
                  label="Laufzeit"
                  options={FINANCE_TERM_OPTIONS}
                  value={enrichment.finance?.termId}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.finance?.termId !== id) triggerSoftFly(id);
                    patchNested('finance', { termId: id });
                  }}
                />
                <SoftChipGroup
                  label="Anzahlung"
                  options={DOWN_PAYMENT_OPTIONS}
                  value={enrichment.finance?.downPayment}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.finance?.downPayment !== id) triggerSoftFly(id);
                    patchNested('finance', { downPayment: id });
                  }}
                />
                <SoftChipGroup
                  label="Schlussrate"
                  options={FINANCE_BALLOON_OPTIONS}
                  value={enrichment.finance?.balloon}
                  flyingId={flyingChipId}
                  onSelect={(id) => {
                    if (enrichment.finance?.balloon !== id) triggerSoftFly(id);
                    patchNested('finance', { balloon: id });
                  }}
                />
              </div>
            )}

            <SoftChipGroup
              label="Inzahlungnahme"
              options={HANDOFF_TRADE_IN_OPTIONS}
              value={enrichment.tradeIn}
              flyingId={flyingChipId}
              onSelect={(id) => {
                if (enrichment.tradeIn !== id) triggerSoftFly(id);
                patchEnrichment({
                  tradeIn: enrichment.tradeIn === id ? null : id,
                });
              }}
            />
          </SoftAccordion>

          <div className="cc-soft-wish__freetext">
            <p className="cc-soft-wish__freetext-label">Etwas anderes?</p>
            <div className="cc-soft-wish__freetext-row">
              <textarea
                ref={freetextRef}
                className="cc-offer-handoff__input cc-soft-wish__textarea"
                placeholder="z. B. kein schwarzes Auto …"
                aria-label="Weiteren Wunsch ergänzen"
                rows={1}
                value={freetext}
                onChange={(e) => {
                  setFreetext(e.target.value);
                  resizeFreetextArea(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
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
          <button
            type="button"
            className="cc-offer-handoff__skip"
            onClick={() => {
              setEnrichment(emptyWishHandoffEnrichment());
              goToIdentify();
            }}
          >
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

          {liveNotepadLabels.length > 0 && (
            <CleverNotepadSummary
              labels={liveNotepadLabels}
              heading="Das habe ich für Sie notiert"
              className="cc-note-summary--soft"
            />
          )}

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
                Code geschickt.
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
