import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import {
  fetchCustomerOfferPortfolioContext,
  postCustomerOfferPortfolioEvent,
  postCustomerOfferPortfolioMessage,
  postCustomerPortalAccessOpen,
  postCustomerPortalAccessVerify,
  postCustomerPortalAccessViewed,
  isPortfolioAccessVerifiedLocally,
  markPortfolioAccessVerifiedLocally,
  PORTFOLIO_EVENTS,
} from '../services/customer/customerOfferPortfolioApi.js';
import { PORTFOLIO_CHANGE_DIMENSIONS, PORTFOLIO_DECLINE_REASONS, PORTFOLIO_REACTION_STATUS } from '../services/crm/customerOfferPortfolioService.js';
import CustomerPortalMessagesSection from '../components/customer/CustomerPortalMessagesSection.jsx';
import CustomerPortalDocumentsSection from '../components/customer/CustomerPortalDocumentsSection.jsx';
import CustomerPortalShellNav from '../components/customer/CustomerPortalShellNav.jsx';
import CustomerPortalCodeGate from '../components/customer/CustomerPortalCodeGate.jsx';
import PkwEnVkvBox from '../components/compliance/PkwEnVkvBox.jsx';
import { ENVKV_CHANNEL } from '../services/vehicle/requiresPkwEnVkv.js';
import { PORTAL_NAV_IDS } from '../services/crm/customerPortalShellPresenter.js';
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
  const [changeDimension, setChangeDimension] = useState('');
  const [portalMessage, setPortalMessage] = useState('');
  const [messageFeedback, setMessageFeedback] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [accessVerified, setAccessVerified] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [activeSection, setActiveSection] = useState(PORTAL_NAV_IDS.MESSAGES);
  const portfolioOpenedRef = useRef(false);
  const viewedReportedRef = useRef(false);

  const firstName = context?.customerFirstName ?? 'Hallo';
  const itemCount = context?.items?.length ?? 0;

  usePageSeo({
    title: `${firstName} – Ihre Angebote`,
    description: 'Ihr persönlicher Clever-Angebotsraum.',
    path: `/angebot/auswahl/${customerSlug ?? 'kunde'}`,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!leadId || !token) {
        setError('Diese Auswahl ist gerade nicht verfügbar.');
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
        const next = await fetchCustomerOfferPortfolioContext({
          leadId,
          token,
          customerSlug,
          accessVerified: locallyVerified,
        });
        if (!cancelled) {
          setContext(next);
          setAccessVerified(locallyVerified || !next?.requiresCode);
        }
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
    if (!context?.leadId || context.requiresCode || !accessVerified) return;

    if (!portfolioOpenedRef.current) {
      portfolioOpenedRef.current = true;
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
    }

    if (!viewedReportedRef.current) {
      viewedReportedRef.current = true;
      postCustomerPortalAccessViewed({ leadId: context.leadId, token, customerSlug })
        .then((data) => {
          if (data.context) setContext(data.context);
        })
        .catch(() => {
          /* Angesehen ist best-effort */
        });
    }
  }, [context, accessVerified, token, customerSlug]);

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
    } catch {
      setCodeError('Code ungültig. Bitte prüfen Sie Ihre E-Mail.');
    } finally {
      setVerifyingCode(false);
    }
  }

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

  async function sendPortalMessage(text) {
    if (!context?.leadId || !text.trim()) return;
    setSendingMessage(true);
    setMessageFeedback('');
    try {
      const data = await postCustomerOfferPortfolioMessage({
        leadId: context.leadId,
        token,
        text: text.trim(),
      });
      if (data.context) setContext(data.context);
      setPortalMessage('');
      setMessageFeedback('Nachricht wurde an das Autohaus gesendet.');
    } catch {
      setMessageFeedback('Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.');
    } finally {
      setSendingMessage(false);
    }
  }

  const sortedItems = useMemo(
    () => [...(context?.items ?? [])],
    [context?.items],
  );

  const shell = context?.shell ?? null;
  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case PORTAL_NAV_IDS.MESSAGES:
        return context?.dealerName || 'Ihr Autohaus';
      case PORTAL_NAV_IDS.DOCUMENTS:
        return 'Ihre Unterlagen';
      case PORTAL_NAV_IDS.SELF_DISCLOSURE:
        return 'Selbstauskunft';
      case PORTAL_NAV_IDS.OFFERS:
        return `Hallo ${firstName} 👋`;
      default:
        return `Hallo ${firstName} 👋`;
    }
  }, [activeSection, firstName, context?.dealerName]);

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

  return (
    <div className="cop-page">
      <div className="cop-shell">
        <header className="cop-header">
          <p className="cop-eyebrow">
            {activeSection === PORTAL_NAV_IDS.MESSAGES
              ? (context.advisorName ? `Ihr Ansprechpartner: ${context.advisorName}` : 'Clever Arbeitsraum')
              : 'Ihr Clever-Angebotsraum'}
          </p>
          <h1 className="cop-title">{sectionTitle}</h1>
          {activeSection === PORTAL_NAV_IDS.OFFERS ? (
            <>
              <p className="cop-offers-heading">Ihre Angebote</p>
              {context.updatedLabel ? (
                <p className="cop-subline">Aktualisiert: {context.updatedLabel}</p>
              ) : (
                <p className="cop-subline">
                  Schauen Sie sich jedes Angebot an – ohne komplizierte Vergleichstabelle.
                </p>
              )}
            </>
          ) : null}
        </header>

        {shell ? (
          <CustomerPortalShellNav
            sections={shell.navSections}
            activeId={activeSection}
            badges={shell.badges}
            onChange={setActiveSection}
          />
        ) : null}

        {activeSection === PORTAL_NAV_IDS.OFFERS ? (
          <>
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

            <div className="cop-list cop-offer-grid">
          {sortedItems.map((item) => {
            const reaction = item.customerReaction?.status ?? PORTFOLIO_REACTION_STATUS.NONE;
            const hasReacted = reaction !== PORTFOLIO_REACTION_STATUS.NONE;
            const isDeclineOpen = activeItemId === item.id && !declineReason;
            const isDeclineForm = activeItemId === item.id && declineReason;
            const isQuestionOpen = activeItemId === `${item.id}:question`;
            const isChangeOpen = activeItemId === `${item.id}:change`;
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

                  <PkwEnVkvBox
                    className="cop-card__envkv"
                    variant="detail"
                    channel={ENVKV_CHANNEL.PORTAL}
                    environmentalData={item.vehicleEnvironmentalData}
                    vehicleRef={{
                      modelKey: item.modelKey,
                      engineId: item.engineId,
                      trimId: item.trimId,
                      paymentType: item.paymentType,
                      isNewPassengerCar: true,
                    }}
                  />

                  {item.requiresPdf && !item.hasPdf ? (
                    <p className="cop-card__pdf-hint">
                      Das verbindliche Originalangebot erhalten Sie bei Bedarf als PDF von uns.
                    </p>
                  ) : null}
                  {item.hasPdf && item.pdfFileName && item.pdfDataUrl ? (
                    <a
                      className="cop-card__pdf-link"
                      href={item.pdfDataUrl}
                      download={item.pdfFileName}
                    >
                      Originalangebot ansehen
                    </a>
                  ) : null}

                  {hasReacted ? (
                    <p className="cop-card__done">
                      {reaction === PORTFOLIO_REACTION_STATUS.INTERESTED && '✓ Das gefällt Ihnen – wir melden uns.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.CALL_REQUESTED && '✓ Rückruf gewünscht – wir rufen an.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.MORE_INFO && '✓ Frage erhalten – wir melden uns.'}
                      {reaction === PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED && '✓ Änderungswunsch notiert – ohne Neuberechnung hier.'}
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
                        Das gefällt mir ❤️
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--secondary"
                        disabled={busy}
                        onClick={() => {
                          setActiveItemId(`${item.id}:question`);
                          setDeclineReason('');
                          setChangeDimension('');
                          setQuestion('');
                        }}
                      >
                        Dazu habe ich eine Frage
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--secondary"
                        disabled={busy}
                        onClick={() => {
                          setActiveItemId(`${item.id}:change`);
                          setDeclineReason('');
                          setChangeDimension('');
                          setQuestion('');
                        }}
                      >
                        Ich möchte etwas ändern
                      </button>
                      <button
                        type="button"
                        className="cop-btn cop-btn--ghost"
                        disabled={busy}
                        onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_CALL_REQUEST)}
                      >
                        Bitte anrufen
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
                        placeholder="Was möchten Sie zu diesem Angebot wissen?"
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
                          Frage senden
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

                  {isChangeOpen && !hasReacted ? (
                    <div className="cop-card__form">
                      <p className="cop-form-label">Was möchten Sie ändern?</p>
                      <p className="cop-form-hint">
                        Keine automatische Ratenberechnung – Ihr Verkäufer prüft den Wunsch.
                      </p>
                      <div className="cop-decline-chips">
                        {Object.entries(PORTFOLIO_CHANGE_DIMENSIONS).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`cop-chip${changeDimension === id ? ' is-active' : ''}`}
                            onClick={() => {
                              setChangeDimension(id);
                              if (id !== 'other' && !question.trim()) {
                                setQuestion(`Lieber: ${label}`);
                              }
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="cop-textarea"
                        rows={3}
                        placeholder='z. B. „Lieber 36 Monate.“'
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                      <div className="cop-form-row">
                        <button
                          type="button"
                          className="cop-btn cop-btn--secondary"
                          disabled={busy || !question.trim()}
                          onClick={() => sendEvent(item.id, PORTFOLIO_EVENTS.OFFER_CHANGE_REQUEST, {
                            questionText: question.trim(),
                          })}
                        >
                          Änderungswunsch senden
                        </button>
                        <button
                          type="button"
                          className="cop-btn cop-btn--ghost"
                          onClick={() => {
                            setActiveItemId(null);
                            setChangeDimension('');
                          }}
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
          </>
        ) : null}

        {activeSection === PORTAL_NAV_IDS.MESSAGES ? (
          <CustomerPortalMessagesSection
            items={context.workspace?.items ?? []}
            threads={context.messageThreads ?? []}
            draft={portalMessage}
            onDraftChange={setPortalMessage}
            onSend={sendPortalMessage}
            sending={sendingMessage}
            sendFeedback={messageFeedback}
            dealerName={context.dealerName || 'Autohaus'}
            onOpenOffer={() => setActiveSection(PORTAL_NAV_IDS.OFFERS)}
            onUploadDocument={(payload) => {
              const url = payload?.uploadUrl
                || shell?.documents?.uploadUrl
                || shell?.documents?.documentsArea?.uploadAction?.url;
              if (url) window.location.href = url;
              else setActiveSection(PORTAL_NAV_IDS.DOCUMENTS);
            }}
            onStartSelfDisclosure={() => {
              window.location.href = `/angebot/auswahl/${customerSlug}/selbstauskunft?leadId=${leadId}&token=${token}`;
            }}
            plusActions={[
              {
                id: 'photo',
                icon: '📷',
                label: 'Foto',
                onClick: () => {
                  const url = shell?.documents?.uploadUrl;
                  if (url) window.location.href = url;
                  else setActiveSection(PORTAL_NAV_IDS.DOCUMENTS);
                },
              },
              {
                id: 'file',
                icon: '📄',
                label: 'Datei',
                onClick: () => {
                  const url = shell?.documents?.uploadUrl;
                  if (url) window.location.href = url;
                  else setActiveSection(PORTAL_NAV_IDS.DOCUMENTS);
                },
              },
              {
                id: 'sa',
                icon: '✍️',
                label: 'Selbstauskunft',
                onClick: () => {
                  window.location.href = `/angebot/auswahl/${customerSlug}/selbstauskunft?leadId=${leadId}&token=${token}`;
                },
              },
              {
                id: 'offers',
                icon: '🚗',
                label: 'Angebote',
                onClick: () => setActiveSection(PORTAL_NAV_IDS.OFFERS),
              },
            ]}
          />
        ) : null}

        {activeSection === PORTAL_NAV_IDS.DOCUMENTS ? (
          <CustomerPortalDocumentsSection
            documents={shell?.documents}
            selfDisclosureHref={`/angebot/auswahl/${customerSlug}/selbstauskunft?leadId=${leadId}&token=${token}`}
          />
        ) : null}

        {activeSection === PORTAL_NAV_IDS.SELF_DISCLOSURE ? (
          <CustomerPortalDocumentsSection
            documents={shell?.documents}
            selfDisclosureHref={`/angebot/auswahl/${customerSlug}/selbstauskunft?leadId=${leadId}&token=${token}`}
            focusSelfDisclosure
          />
        ) : null}
      </div>
    </div>
  );
}
