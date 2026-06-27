import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import {
  fetchCustomerOfferPortfolioContext,
  postCustomerOfferPortfolioEvent,
  PORTFOLIO_EVENTS,
} from '../services/customer/customerOfferPortfolioApi.js';
import { PORTFOLIO_DECLINE_REASONS, PORTFOLIO_REACTION_STATUS } from '../services/crm/customerOfferPortfolioService.js';
import './CustomerOfferPortfolioPage.css';

const DECLINE_OPTIONS = Object.entries(PORTFOLIO_DECLINE_REASONS).map(([id, label]) => ({
  id,
  label,
}));

export default function CustomerOfferPortfolioPage() {
  const { customerSlug } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const token = searchParams.get('token');

  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [activeItemId, setActiveItemId] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [question, setQuestion] = useState('');
  const [feedback, setFeedback] = useState('');
  const openedRef = useRef(false);

  const firstName = context?.customerFirstName ?? 'Hallo';
  const itemCount = context?.items?.length ?? 0;

  usePageSeo({
    title: `${firstName} – Ihre Angebotsauswahl`,
    description: 'Vergleichen Sie Ihre persönlichen Fahrzeugvorschläge.',
    path: `/angebot/auswahl/${customerSlug ?? 'kunde'}`,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const next = await fetchCustomerOfferPortfolioContext({
          leadId,
          token,
          customerSlug,
        });
        if (!cancelled) setContext(next);
      } catch {
        if (!cancelled) setError('Diese Auswahl ist gerade nicht verfügbar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [leadId, token, customerSlug]);

  useEffect(() => {
    if (!context?.leadId || openedRef.current) return;
    openedRef.current = true;
    postCustomerOfferPortfolioEvent({
      leadId: context.leadId,
      token,
      eventType: PORTFOLIO_EVENTS.OPENED,
    })
      .then((data) => {
        if (data.context) setContext(data.context);
      })
      .catch(() => {
        /* Öffnen ist best-effort */
      });
  }, [context?.leadId, token]);

  async function sendEvent(itemId, eventType, extra = {}) {
    if (!context?.leadId || !itemId) return;
    setSubmitting(`${itemId}:${eventType}`);
    setFeedback('');
    try {
      const data = await postCustomerOfferPortfolioEvent({
        leadId: context.leadId,
        token,
        offerUnitId: itemId,
        eventType,
        ...extra,
      });
      if (data.context) setContext(data.context);
      setActiveItemId(null);
      setDeclineReason('');
      setDeclineNote('');
      setQuestion('');
      if (eventType === PORTFOLIO_EVENTS.OFFER_INTERESTED) {
        setFeedback('Danke – wir melden uns bei Ihnen.');
      } else if (eventType === PORTFOLIO_EVENTS.OFFER_CALL_REQUEST) {
        setFeedback('Wir rufen Sie an – danke für Ihr Interesse!');
      } else if (eventType === PORTFOLIO_EVENTS.OFFER_DECLINED) {
        setFeedback('Danke für Ihre ehrliche Rückmeldung.');
      } else if (eventType === PORTFOLIO_EVENTS.OFFER_MORE_INFO) {
        setFeedback('Ihre Anfrage ist bei uns eingegangen.');
      }
    } catch {
      setFeedback('Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting('');
    }
  }

  const sortedItems = useMemo(
    () => [...(context?.items ?? [])],
    [context?.items],
  );

  if (loading) {
    return (
      <div className="cop-page">
        <div className="cop-shell">
          <p className="cop-muted">Ihre Auswahl wird geladen …</p>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="cop-page">
        <div className="cop-shell">
          <h1 className="cop-title">Auswahl nicht gefunden</h1>
          <p className="cop-muted">{error || 'Bitte wenden Sie sich an Ihren Verkäufer.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cop-page">
      <div className="cop-shell">
        <header className="cop-header">
          <p className="cop-eyebrow">Persönliche Angebotsauswahl</p>
          <h1 className="cop-title">
            {firstName}
            , hier sind Ihre Optionen
          </h1>
          {context.summaryTitle ? (
            <p className="cop-subline">{context.summaryTitle}</p>
          ) : (
            <p className="cop-subline">
              Schauen Sie sich jedes Angebot an und geben Sie uns pro Vorschlag Ihre Rückmeldung.
            </p>
          )}
        </header>

        {context.summaryLines?.length > 0 ? (
          <section className="cop-summary" aria-label="Übersicht aller Optionen">
            <h2 className="cop-summary__title">Clever-Zusammenfassung</h2>
            <ul className="cop-summary__list">
              {context.summaryLines.map((line) => (
                <li key={line}>{line.replace(/^•\s*/, '')}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="cop-list">
          {sortedItems.map((item) => {
            const reaction = item.customerReaction?.status ?? PORTFOLIO_REACTION_STATUS.NONE;
            const hasReacted = reaction !== PORTFOLIO_REACTION_STATUS.NONE;
            const isDeclineOpen = activeItemId === item.id && !declineReason;
            const isDeclineForm = activeItemId === item.id && declineReason;
            const isQuestionOpen = activeItemId === `${item.id}:question`;
            const busy = submitting.startsWith(`${item.id}:`);

            return (
              <article key={item.id} className={`cop-card${hasReacted ? ' cop-card--reacted' : ''}`}>
                {item.heroImage ? (
                  <div className="cop-card__hero">
                    <img src={item.heroImage} alt={item.title} />
                  </div>
                ) : null}

                <div className="cop-card__body">
                  <h2 className="cop-card__title">{item.title}</h2>
                  {item.roleLabel ? (
                    <p className="cop-card__role">{item.roleLabel}</p>
                  ) : null}
                  {item.conditionsLine ? (
                    <p className="cop-card__conditions">{item.conditionsLine}</p>
                  ) : null}
                  {item.upeLine ? (
                    <p className="cop-card__upe">{item.upeLine}</p>
                  ) : null}
                  {item.rateLine ? (
                    <p className="cop-card__rate">{item.rateLine}</p>
                  ) : null}
                  {!item.rateLine && item.priceLine ? (
                    <p className="cop-card__rate">{item.priceLine}</p>
                  ) : null}

                  {item.requiresPdf && !item.hasPdf ? (
                    <p className="cop-card__pdf-hint">
                      Für Leasing/Finanzierung erhalten Sie das verbindliche Angebot als PDF von uns.
                    </p>
                  ) : null}
                  {item.hasPdf && item.pdfFileName && item.pdfDataUrl ? (
                    <a
                      className="cop-card__pdf-link"
                      href={item.pdfDataUrl}
                      download={item.pdfFileName}
                    >
                      Offizielles Angebot (PDF) herunterladen
                    </a>
                  ) : null}

                  {hasReacted ? (
                    <p className="cop-card__done">
                      {reaction === PORTFOLIO_REACTION_STATUS.INTERESTED && '✓ Sehr interessant – wir melden uns.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.CALL_REQUESTED && '✓ Rückruf gewünscht – wir rufen an.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.MORE_INFO && '✓ Mehr Infos angefragt – wir melden uns.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.DECLINED && '✓ Rückmeldung erhalten – danke.'}
                    </p>
                  ) : (
                    <div className="cop-card__actions">
                      <button
                        type="button"
                        className="cop-btn cop-btn--primary"
                        disabled={busy}
                        onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_INTERESTED)}
                      >
                        Sehr interessant
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--call"
                        disabled={busy}
                        onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_CALL_REQUEST)}
                      >
                        Bitte rufen Sie mich an
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--secondary"
                        disabled={busy}
                        onClick={() => {
                          setActiveItemId(`${item.id}:question`);
                          setDeclineReason('');
                          setQuestion('');
                        }}
                      >
                        Mehr Infos
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--ghost"
                        disabled={busy}
                        onClick={() => {
                          setActiveItemId(item.id);
                          setDeclineReason('');
                          setDeclineNote('');
                        }}
                      >
                        Passt nicht
                      </button>
                    </div>
                  )}

                  {isQuestionOpen && !hasReacted ? (
                    <div className="cop-card__form">
                      <textarea
                        className="cop-textarea"
                        rows={3}
                        placeholder="Was möchten Sie wissen?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                      <div className="cop-form-row">
                        <button
                          type="button"
                          className="cop-btn cop-btn--secondary"
                          disabled={busy || !question.trim()}
                          onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_MORE_INFO, { questionText: question.trim() })}
                        >
                          Anfrage senden
                        </button>
                        <button
                          type="button"
                          className="cop-btn cop-btn--ghost"
                          onClick={() => setActiveItemId(null)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isDeclineOpen && !hasReacted ? (
                    <div className="cop-card__form">
                      <p className="cop-form-label">Warum passt es nicht?</p>
                      <div className="cop-decline-chips">
                        {DECLINE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="cop-decline-chip"
                            onClick={() => setDeclineReason(option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="cop-btn cop-btn--ghost"
                        onClick={() => setActiveItemId(null)}
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : null}

                  {isDeclineForm && !hasReacted ? (
                    <div className="cop-card__form">
                      <p className="cop-form-label">
                        {PORTFOLIO_DECLINE_REASONS[declineReason] ?? 'Passt nicht'}
                      </p>
                      <textarea
                        className="cop-textarea"
                        rows={2}
                        placeholder="Optional: kurz ergänzen …"
                        value={declineNote}
                        onChange={(e) => setDeclineNote(e.target.value)}
                      />
                      <div className="cop-form-row">
                        <button
                          type="button"
                          className="cop-btn cop-btn--ghost"
                          disabled={busy}
                          onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_DECLINED, {
                            declineReason,
                            declineNote: declineNote.trim(),
                          })}
                        >
                          Absenden
                        </button>
                        <button
                          type="button"
                          className="cop-btn cop-btn--ghost"
                          onClick={() => {
                            setDeclineReason('');
                            setActiveItemId(null);
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {feedback ? <p className="cop-feedback" role="status">{feedback}</p> : null}
      </div>
    </div>
  );
}
