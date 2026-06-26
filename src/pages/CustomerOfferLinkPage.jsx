import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import {
  CUSTOMER_LINK_EVENTS,
  fetchCustomerOfferLinkContext,
  postCustomerOfferLinkEvent,
} from '../services/customer/customerOfferLinkApi.js';
import './CustomerOfferLinkPage.css';

function formatRate(context) {
  if (!context?.rateLabel) return null;
  const rate = Number(context.rateLabel);
  if (!Number.isFinite(rate)) return String(context.rateLabel);
  return `${rate.toLocaleString('de-DE')} € / Monat`;
}

export default function CustomerOfferLinkPage() {
  const { modelSlug, customerSlug } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const vehicleCardId = searchParams.get('cardId');

  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [feedback, setFeedback] = useState('');
  const openedRef = useRef(false);

  const title = context?.vehicleLabel ?? 'Ihr Angebot';
  const firstName = context?.customerFirstName ?? 'Hallo';
  const rateLabel = useMemo(() => formatRate(context), [context]);

  usePageSeo({
    title: `${title} – Angebot`,
    description: 'Ihr persönliches Fahrzeugangebot.',
    path: `/angebot/online/${modelSlug}/${customerSlug}`,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const next = await fetchCustomerOfferLinkContext({
          leadId,
          vehicleCardId,
          modelSlug,
          customerSlug,
        });
        if (!cancelled) setContext(next);
      } catch {
        if (!cancelled) setError('Dieses Angebot ist gerade nicht verfügbar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [leadId, vehicleCardId, modelSlug, customerSlug]);

  useEffect(() => {
    if (!context?.leadId || openedRef.current) return;
    openedRef.current = true;
    postCustomerOfferLinkEvent({
      leadId: context.leadId,
      vehicleCardId: context.vehicleCardId,
      eventType: CUSTOMER_LINK_EVENTS.OPENED,
    })
      .then((data) => {
        if (data.context) setContext(data.context);
      })
      .catch(() => {
        /* Öffnen ist best-effort */
      });
  }, [context?.leadId, context?.vehicleCardId]);

  async function sendEvent(eventType, extra = {}) {
    if (!context?.leadId) return;
    setSubmitting(eventType);
    setFeedback('');
    try {
      const data = await postCustomerOfferLinkEvent({
        leadId: context.leadId,
        vehicleCardId: context.vehicleCardId,
        eventType,
        ...extra,
      });
      if (data.context) setContext(data.context);
      if (eventType === CUSTOMER_LINK_EVENTS.INTERESTED) {
        setFeedback('Danke – wir melden uns bei Ihnen.');
      }
      if (eventType === CUSTOMER_LINK_EVENTS.DECLINED) {
        setFeedback('Danke für Ihre Rückmeldung.');
      }
      if (eventType === CUSTOMER_LINK_EVENTS.QUESTION) {
        setQuestion('');
        setFeedback('Ihre Frage wurde übermittelt.');
      }
    } catch {
      setFeedback('Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting('');
    }
  }

  if (loading) {
    return (
      <div className="col-page">
        <div className="col-shell">
          <p className="col-muted">Angebot wird geladen …</p>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="col-page">
        <div className="col-shell">
          <h1 className="col-title">Angebot nicht gefunden</h1>
          <p className="col-muted">{error || 'Bitte wenden Sie sich an Ihren Verkäufer.'}</p>
        </div>
      </div>
    );
  }

  const interestStatus = context.interaction?.interestStatus;
  const hasQuestion = (context.interaction?.customerQuestions ?? []).some((q) => q.status === 'open');

  return (
    <div className="col-page">
      <div className="col-shell">
        <header className="col-header">
          <p className="col-eyebrow">Persönliches Angebot</p>
          <h1 className="col-title">{firstName}, hier ist Ihr Vorschlag</h1>
          <p className="col-vehicle">{title}</p>
          {rateLabel ? <p className="col-rate">{rateLabel}</p> : null}
        </header>

        {context.heroImage ? (
          <div className="col-hero">
            <img src={context.heroImage} alt={title} />
          </div>
        ) : null}

        <section className="col-actions" aria-label="Ihre Rückmeldung">
          <h2 className="col-section-title">Wie passt der Vorschlag?</h2>
          <div className="col-action-row">
            <button
              type="button"
              className="col-btn col-btn--primary"
              disabled={!!submitting || interestStatus === 'interested'}
              onClick={() => sendEvent(CUSTOMER_LINK_EVENTS.INTERESTED)}
            >
              {submitting === CUSTOMER_LINK_EVENTS.INTERESTED ? 'Wird gesendet …' : 'Interessiert mich'}
            </button>
            <button
              type="button"
              className="col-btn col-btn--ghost"
              disabled={!!submitting || interestStatus === 'not_interested'}
              onClick={() => sendEvent(CUSTOMER_LINK_EVENTS.DECLINED)}
            >
              {submitting === CUSTOMER_LINK_EVENTS.DECLINED ? 'Wird gesendet …' : 'Passt nicht'}
            </button>
          </div>
        </section>

        <section className="col-question" aria-label="Frage stellen">
          <h2 className="col-section-title">Frage stellen</h2>
          {hasQuestion ? (
            <p className="col-muted">Ihre Frage ist bei uns eingegangen – wir melden uns.</p>
          ) : (
            <>
              <textarea
                className="col-textarea"
                rows={4}
                placeholder="Was möchten Sie wissen?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button
                type="button"
                className="col-btn col-btn--secondary"
                disabled={!!submitting || !question.trim()}
                onClick={() => sendEvent(CUSTOMER_LINK_EVENTS.QUESTION, { questionText: question.trim() })}
              >
                {submitting === CUSTOMER_LINK_EVENTS.QUESTION ? 'Wird gesendet …' : 'Frage absenden'}
              </button>
            </>
          )}
        </section>

        {feedback ? <p className="col-feedback" role="status">{feedback}</p> : null}
      </div>
    </div>
  );
}
