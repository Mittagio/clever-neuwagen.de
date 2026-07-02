import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import CustomerPortalCodeGate from '../components/customer/CustomerPortalCodeGate.jsx';
import {
  fetchCustomerOfferPortfolioContext,
  fetchCustomerPortalSelfDisclosure,
  postCustomerPortalAccessOpen,
  postCustomerPortalAccessVerify,
  postCustomerPortalSelfDisclosureSave,
  postCustomerPortalSelfDisclosureStart,
  postCustomerPortalSelfDisclosureSubmit,
  isPortfolioAccessVerifiedLocally,
  markPortfolioAccessVerifiedLocally,
} from '../services/customer/customerOfferPortfolioApi.js';
import {
  SELF_DISCLOSURE_TYPE_LABELS,
  getStepsForType,
} from '../services/crm/customerPortalSelfDisclosureService.js';
import './CustomerOfferPortfolioPage.css';

function normalizeFieldValue(field, value) {
  if (field.type === 'yesno') {
    if (value === true || value === 'yes') return true;
    if (value === false || value === 'no') return false;
    return value;
  }
  return String(value ?? '').trim();
}

export default function CustomerPortalSelfDisclosurePage() {
  const { customerSlug } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const token = searchParams.get('token');

  const [context, setContext] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessVerified, setAccessVerified] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');

  const portfolioHref = `/angebot/auswahl/${customerSlug ?? 'kunde'}?leadId=${leadId}&token=${token}`;

  usePageSeo({
    title: 'Selbstauskunft – Kundenportal',
    description: 'Digitale Selbstauskunft Schritt für Schritt ausfüllen.',
    path: `/angebot/auswahl/${customerSlug ?? 'kunde'}/selbstauskunft`,
  });

  async function loadInterview(verified) {
    const nextContext = await fetchCustomerOfferPortfolioContext({
      leadId,
      token,
      customerSlug,
      accessVerified: verified,
    });
    const nextInterview = await fetchCustomerPortalSelfDisclosure({
      leadId,
      token,
      customerSlug,
    });
    setContext(nextContext);
    setInterview(nextInterview);
    if (nextInterview?.currentStep?.values) {
      setFormValues(nextInterview.currentStep.values);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!leadId || !token) {
        setError('Diese Selbstauskunft ist gerade nicht verfügbar.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const locallyVerified = isPortfolioAccessVerifiedLocally(leadId, token);
        await postCustomerPortalAccessOpen({
          leadId,
          token,
          customerSlug,
          accessVerified: locallyVerified,
        });
        if (!cancelled) {
          await loadInterview(locallyVerified);
          setAccessVerified(locallyVerified);
        }
      } catch {
        if (!cancelled) setError('Diese Selbstauskunft ist gerade nicht verfügbar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [leadId, token, customerSlug]);

  useEffect(() => {
    if (interview?.currentStep?.values) {
      setFormValues(interview.currentStep.values);
    }
  }, [interview?.currentStep?.id]);

  const typeOptions = useMemo(
    () => Object.entries(SELF_DISCLOSURE_TYPE_LABELS).map(([id, label]) => ({ id, label })),
    [],
  );

  async function handleVerifyCode(code) {
    setVerifyingCode(true);
    setCodeError('');
    try {
      const data = await postCustomerPortalAccessVerify({
        leadId,
        token,
        customerSlug,
        code,
      });
      markPortfolioAccessVerifiedLocally(leadId, token);
      setAccessVerified(true);
      setContext(data.context);
      await loadInterview(true);
    } catch {
      setCodeError('Code ungültig. Bitte prüfen Sie Ihre E-Mail.');
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleStartType(type) {
    setBusy('start');
    setFeedback('');
    try {
      const data = await postCustomerPortalSelfDisclosureStart({
        leadId,
        token,
        customerSlug,
        type,
      });
      setInterview(data.interview);
      setContext(data.context);
      if (data.interview?.currentStep?.values) {
        setFormValues(data.interview.currentStep.values);
      }
    } catch {
      setFeedback('Start fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setBusy('');
    }
  }

  async function handleSave({ advance = true, exitAfter = false } = {}) {
    if (!interview?.currentStep) return;
    setBusy(advance ? 'next' : 'save');
    setFeedback('');
    try {
      const data = await postCustomerPortalSelfDisclosureSave({
        leadId,
        token,
        customerSlug,
        stepId: interview.currentStep.id,
        data: formValues,
        advance,
      });
      setInterview(data.interview);
      setContext(data.context);
      if (exitAfter) {
        setFeedback('Gespeichert. Sie können später hier weitermachen.');
      }
    } catch {
      setFeedback('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setBusy('');
    }
  }

  async function handleSubmit() {
    setBusy('submit');
    setFeedback('');
    try {
      await postCustomerPortalSelfDisclosureSave({
        leadId,
        token,
        customerSlug,
        stepId: 'review',
        data: formValues,
        advance: false,
      });
      const data = await postCustomerPortalSelfDisclosureSubmit({
        leadId,
        token,
        customerSlug,
      });
      setInterview(data.interview);
      setContext(data.context);
      setFeedback('Vielen Dank – Ihre Selbstauskunft wurde abgesendet. Das Autohaus prüft Ihre Angaben.');
    } catch {
      setFeedback('Absenden fehlgeschlagen. Bitte prüfen Sie alle Pflichtfelder.');
    } finally {
      setBusy('');
    }
  }

  function handleFieldChange(field, rawValue) {
    setFormValues((prev) => ({
      ...prev,
      [field.key]: normalizeFieldValue(field, rawValue),
    }));
  }

  function goToPreviousStep() {
    if (!interview?.selfDisclosure?.type || !interview?.currentStep) return;
    const steps = getStepsForType(interview.selfDisclosure.type);
    const idx = steps.findIndex((step) => step.id === interview.currentStep.id);
    const prev = steps[idx - 1];
    if (!prev) return;
    setInterview({
      ...interview,
      currentStep: {
        ...prev,
        index: idx - 1,
        values: interview.selfDisclosure.sections?.[prev.sectionKey] ?? {},
      },
    });
  }

  if (loading) {
    return (
      <div className="cop-page">
        <div className="cop-shell">
          <p className="cop-muted">Selbstauskunft wird geladen …</p>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="cop-page">
        <div className="cop-shell">
          <h1 className="cop-title">Selbstauskunft nicht verfügbar</h1>
          <p className="cop-muted">{error || 'Bitte wenden Sie sich an Ihren Verkäufer.'}</p>
        </div>
      </div>
    );
  }

  if (context.requiresCode && !accessVerified) {
    return (
      <CustomerPortalCodeGate
        customerFirstName={context.customerFirstName}
        emailHint={context.portalAccess?.emailHint}
        onVerify={handleVerifyCode}
        verifying={verifyingCode}
        error={codeError}
      />
    );
  }

  if (interview?.needsTypeSelection) {
    return (
      <div className="cop-page">
        <div className="cop-shell cop-sd-flow">
          <header className="cop-header">
            <p className="cop-eyebrow">Digitale Selbstauskunft</p>
            <h1 className="cop-title">Welche Selbstauskunft möchten Sie ausfüllen?</h1>
          </header>
          <div className="cop-sd-type-grid">
            {typeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="cop-sd-type-btn"
                disabled={busy === 'start'}
                onClick={() => handleStartType(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Link className="cop-btn cop-btn--ghost" to={portfolioHref}>
            Zurück zu Ihren Unterlagen
          </Link>
          {feedback ? <p className="cop-feedback" role="status">{feedback}</p> : null}
        </div>
      </div>
    );
  }

  const currentStep = interview?.currentStep;
  const progress = interview?.progress ?? 0;
  const readOnly = interview?.readOnly;

  return (
    <div className="cop-page">
      <div className="cop-shell cop-sd-flow">
        {interview?.correctionNotice ? (
          <div className="cop-sd-correction-notice" role="status">
            <p className="cop-sd-correction-notice__title">{interview.correctionNotice}</p>
            {interview.correctionItems?.length > 0 ? (
              <ul className="cop-sd-correction-notice__list">
                {interview.correctionItems.map((item) => (
                  <li key={`${item.sectionId}:${item.fieldId}`}>{item.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <header className="cop-header">
          <p className="cop-eyebrow">
            {interview?.typeLabel ?? 'Selbstauskunft'}
            {' · '}
            Schritt
            {' '}
            {(currentStep?.index ?? 0) + 1}
            {' '}
            von
            {' '}
            {interview?.steps?.length ?? 0}
          </p>
          <h1 className="cop-title">{currentStep?.title ?? 'Selbstauskunft'}</h1>
          <div className="cop-sd-progress" aria-label={`Fortschritt ${progress} Prozent`}>
            <div className="cop-sd-progress__bar" style={{ width: `${progress}%` }} />
            <span className="cop-sd-progress__label">{progress} %</span>
          </div>
        </header>

        {currentStep?.id === 'review' ? (
          <section className="cop-sd-review" aria-label="Zusammenfassung">
            <p className="cop-panel__hint">
              Bitte prüfen Sie Ihre Angaben. Das Autohaus prüft die Selbstauskunft, bevor sie weiterverwendet wird.
            </p>
            {Object.entries(interview?.selfDisclosure?.sections ?? {}).map(([sectionKey, values]) => {
              if (!values || Object.keys(values).length === 0) return null;
              return (
                <div key={sectionKey} className="cop-sd-review__block">
                  <h2 className="cop-sd-review__title">{sectionKey}</h2>
                  <dl className="cop-sd-review__list">
                    {Object.entries(values).map(([key, value]) => (
                      <div key={key} className="cop-sd-review__row">
                        <dt>{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
            {!readOnly ? (
              <label className="cop-sd-field cop-sd-field--yesno">
                <span className="cop-sd-field__label">Angaben sind vollständig und richtig *</span>
                <select
                  className="cop-sd-field__input"
                  value={formValues.confirmed === true ? 'yes' : formValues.confirmed === false ? 'no' : ''}
                  onChange={(e) => handleFieldChange({ key: 'confirmed', type: 'yesno' }, e.target.value)}
                >
                  <option value="">Bitte wählen</option>
                  <option value="yes">Ja</option>
                  <option value="no">Nein</option>
                </select>
              </label>
            ) : null}
          </section>
        ) : (
          <form
            className="cop-sd-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave({ advance: true });
            }}
          >
            {(currentStep?.fields ?? []).map((field) => (
              <label key={field.key} className={`cop-sd-field cop-sd-field--${field.type}`}>
                <span className="cop-sd-field__label">
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {field.type === 'yesno' ? (
                  <select
                    className="cop-sd-field__input"
                    disabled={readOnly}
                    value={formValues[field.key] === true ? 'yes' : formValues[field.key] === false ? 'no' : ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                  >
                    <option value="">Bitte wählen</option>
                    <option value="yes">Ja</option>
                    <option value="no">Nein</option>
                  </select>
                ) : (
                  <input
                    className="cop-sd-field__input"
                    type={field.type === 'number' ? 'text' : field.type}
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    disabled={readOnly}
                    value={formValues[field.key] ?? ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                  />
                )}
              </label>
            ))}
          </form>
        )}

        <div className="cop-sd-actions">
          {!readOnly && currentStep?.id !== 'review' ? (
            <>
              {currentStep?.index > 0 ? (
                <button type="button" className="cop-btn cop-btn--ghost" onClick={goToPreviousStep}>
                  Zurück
                </button>
              ) : null}
              <button
                type="button"
                className="cop-btn cop-btn--secondary"
                disabled={busy === 'save'}
                onClick={() => handleSave({ advance: false, exitAfter: true })}
              >
                Speichern &amp; später fortsetzen
              </button>
              <button
                type="button"
                className="cop-btn cop-btn--primary"
                disabled={busy === 'next'}
                onClick={() => handleSave({ advance: true })}
              >
                Weiter
              </button>
            </>
          ) : null}
          {!readOnly && currentStep?.id === 'review' ? (
            <button
              type="button"
              className="cop-btn cop-btn--primary"
              disabled={busy === 'submit'}
              onClick={handleSubmit}
            >
              Selbstauskunft absenden
            </button>
          ) : null}
          <Link className="cop-btn cop-btn--ghost" to={portfolioHref}>
            Zurück zum Portal
          </Link>
        </div>

        {interview?.selfDisclosure?.lastSavedAt ? (
          <p className="cop-panel__hint">
            Zuletzt gespeichert:
            {' '}
            {new Date(interview.selfDisclosure.lastSavedAt).toLocaleString('de-DE')}
          </p>
        ) : null}

        {feedback ? <p className="cop-feedback" role="status">{feedback}</p> : null}
      </div>
    </div>
  );
}
