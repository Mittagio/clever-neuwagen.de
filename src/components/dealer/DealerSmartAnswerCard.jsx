import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { submitOpenCustomerQuestion } from '../../services/admin/openCustomerQuestionsService.js';
import './dealer-landing.css';

/**
 * Clever Antwort – Orientierung zuerst: Bild, Antwort, Interesse, dann Fit-Check.
 */
export default function DealerSmartAnswerCard({
  answer,
  dealerId,
  onFollowUpQuery,
  onFollowUpSuggestion,
  onShowFit,
  onSelectModel,
  onStartConsultation,
  onAskDealer,
  onLearningRequest,
  onOptionalModelsSearch,
  fitRevealed = false,
  configuratorRevealed = false,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notifySent, setNotifySent] = useState(false);
  const [learningSent, setLearningSent] = useState(false);

  if (!answer) return null;

  function handleNotify() {
    const oq = answer.openQuestion;
    if (!oq?.query) return;
    submitOpenCustomerQuestion({
      query: oq.query,
      modelKey: oq.modelKey,
      intentId: oq.intentId,
      category: oq.category,
      field: oq.field,
    });
    setNotifySent(true);
  }

  const hasDetails = (answer.facts?.length ?? 0) > 0;
  const showImage = Boolean(answer.primaryModelKey) && answer.mode !== 'advice';
  const isAdvice = answer.mode === 'advice' || answer.intent === 'advice_question';
  const usefulWhen = answer.usefulWhen ?? [];
  const dealerChecks = answer.dealerChecks ?? [];
  const narrative = [
    ...(answer.narrative ?? []),
    ...(answer.summary ? [answer.summary] : []),
  ];

  const followUpItems = answer.followUpSuggestions?.length
    ? answer.followUpSuggestions
    : (answer.relatedTopics ?? []).map((topic) => ({
      label: topic.label,
      query: topic.query,
      type: 'advice_question',
      target: topic.id,
    }));

  function handleFollowUpClick(item) {
    if (onFollowUpSuggestion) {
      onFollowUpSuggestion(item);
      return;
    }
    onFollowUpQuery?.(item.query ?? item);
  }

  return (
    <section className="dl-smart-answer" aria-labelledby="dl-smart-answer-title">
      <div className={`dl-smart-answer__hero${showImage ? ' dl-smart-answer__hero--with-image' : ''}`}>
        {showImage && (
          <div className="dl-smart-answer__visual">
            <VehicleImage
              brand="Kia"
              model={answer.primaryModelKey}
              bodyType={answer.bodyType ?? 'suv'}
              className="dl-smart-answer__image-wrap vehicle-image--oem-hero"
              imageClassName="dl-smart-answer__image"
              variant="hero"
              glow
            />
          </div>
        )}

        <div className="dl-smart-answer__content">
          <header className="dl-smart-answer__head">
            <span className="dl-smart-answer__icon" aria-hidden>✨</span>
            <div>
              <p className="dl-smart-answer__kicker">{answer.kicker ?? 'Clever Antwort'}</p>
              {answer.primaryModelLabel && (
                <p className="dl-smart-answer__model-label">Kia {answer.primaryModelLabel}</p>
              )}
              <h2 id="dl-smart-answer-title" className="dl-smart-answer__title">{answer.title}</h2>
            </div>
          </header>

          {answer.lead && (
            <p className="dl-smart-answer__lead">{answer.lead}</p>
          )}

          {isAdvice && usefulWhen.length > 0 && (
            <div className="dl-smart-answer__advice-section">
              <p className="dl-smart-answer__advice-label">Wichtig dabei:</p>
              <ul className="dl-smart-answer__advice-list">
                {usefulWhen.map((item) => (
                  <li key={item} className="dl-smart-answer__advice-item">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {isAdvice && dealerChecks.length > 0 && (
            <div className="dl-smart-answer__advice-section">
              <p className="dl-smart-answer__advice-label">Das prüft Ihr Autohaus:</p>
              <ul className="dl-smart-answer__advice-list dl-smart-answer__advice-list--dealer">
                {dealerChecks.map((item) => (
                  <li key={item} className="dl-smart-answer__advice-item">{item}</li>
                ))}
              </ul>
              {answer.dealerHint && (
                <p className="dl-smart-answer__advice-hint">{answer.dealerHint}</p>
              )}
            </div>
          )}

          {hasDetails && (
            <ul className="dl-smart-answer__key-facts" aria-label="Wichtige Daten">
              {answer.facts.map((fact) => (
                <li key={fact.label} className="dl-smart-answer__key-fact">
                  <span className="dl-smart-answer__key-fact-value">{fact.value}</span>
                  <span className="dl-smart-answer__key-fact-label">{fact.label}</span>
                </li>
              ))}
            </ul>
          )}

          {answer.kiaBridge && (
            <p className="dl-smart-answer__advice-hint dl-smart-answer__kia-bridge">{answer.kiaBridge}</p>
          )}

          {narrative.length > 0 && (
            <div className="dl-smart-answer__story">
              {narrative.map((line) => (
                <p key={line} className="dl-smart-answer__story-p">{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {answer.modelCards?.length > 0 && (
        <div className="dl-smart-answer__models">
          {answer.modelCards.map((card) => (
            <article key={card.modelKey} className="dl-smart-answer__model-card">
              <h3 className="dl-smart-answer__model-name">{card.name}</h3>
              <ul className="dl-smart-answer__model-bullets">
                {card.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {answer.interestOptions?.length > 1 && !configuratorRevealed && (
        <div className="dl-smart-answer__interest">
          <p className="dl-smart-answer__interest-label">
            {answer.fitPrompt ?? 'Wofür interessieren Sie sich?'}
          </p>
          <div className="dl-smart-answer__interest-chips">
            {answer.interestOptions.map((option) => (
              <button
                key={option.modelKey}
                type="button"
                className="dl-smart-answer__interest-chip"
                onClick={() => onSelectModel?.(option.modelKey)}
              >
                {option.cta}
              </button>
            ))}
          </div>
        </div>
      )}

      {!answer.modelCards?.length && answer.highlights?.length > 0 && (
        <ul className="dl-smart-answer__highlights">
          {answer.highlights.map((item) => (
            <li key={item.modelKey} className="dl-smart-answer__highlight">
              <span className="dl-smart-answer__model">{item.label}</span>
              {item.detail && (
                <span className="dl-smart-answer__detail">{item.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {answer.tip && (
        <p className="dl-smart-answer__tip">
          <strong>Tipp:</strong>
          {' '}
          {answer.tip}
        </p>
      )}

      {followUpItems.length > 0 && (
        <div className="dl-smart-answer__related">
          <p className="dl-smart-answer__related-label">
            {answer.followUpLabel ?? (isAdvice ? 'Nächster Schritt' : 'Das könnten Sie auch fragen:')}
          </p>
          <div className="dl-smart-answer__related-chips">
            {followUpItems.map((item) => (
              <button
                key={`${item.label}-${item.query}`}
                type="button"
                className="dl-smart-answer__related-chip"
                onClick={() => handleFollowUpClick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasDetails && (
        <div className="dl-smart-answer__details">
          <button
            type="button"
            className="dl-smart-answer__details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? 'Technische Details ausblenden' : 'Technische Details anzeigen'}
          </button>
          {detailsOpen && (
            <dl className="dl-smart-answer__facts">
              {answer.facts.map((fact) => (
                <div key={fact.label} className="dl-smart-answer__fact">
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {answer.dataGap && answer.showNotifyCta && (
        <div className="dl-smart-answer__data-gap">
          {notifySent ? (
            <p className="dl-smart-answer__data-gap-ok">
              Danke – wir melden uns, sobald die Antwort verfügbar ist.
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-secondary dl-smart-answer__notify-cta"
              onClick={handleNotify}
            >
              {answer.notifyCta ?? 'Benachrichtigen, sobald die Antwort verfügbar ist'}
            </button>
          )}
        </div>
      )}

      {answer.showDealerCta && onAskDealer && (
        <button
          type="button"
          className="btn btn-primary dl-smart-answer__consult-cta"
          onClick={onAskDealer}
        >
          {answer.dealerCtaLabel ?? 'Verkäufer dazu fragen'}
        </button>
      )}

      {answer.showSecondaryCta && onAskDealer && (
        <button
          type="button"
          className="btn btn-secondary dl-smart-answer__fit-cta"
          onClick={onAskDealer}
        >
          {answer.secondaryCtaLabel}
        </button>
      )}

      {answer.showOptionalModelsCta && onOptionalModelsSearch && (
        <button
          type="button"
          className="btn btn-secondary dl-smart-answer__fit-cta"
          onClick={() => onOptionalModelsSearch(answer)}
        >
          {answer.optionalModelsCtaLabel ?? 'Passende Modelle ansehen'}
        </button>
      )}

      {answer.showLearningCta && onLearningRequest && (
        <div className="dl-smart-answer__data-gap">
          {learningSent ? (
            <p className="dl-smart-answer__data-gap-ok">
              Danke – Clever merkt sich Ihre Frage für die Beratungsdatenbank.
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-secondary dl-smart-answer__notify-cta"
              onClick={() => {
                onLearningRequest(answer);
                setLearningSent(true);
              }}
            >
              {answer.learningCtaLabel ?? 'Clever soll das lernen'}
            </button>
          )}
        </div>
      )}

      {answer.showViewModelCta && answer.viewModelCta && answer.primaryModelKey && (
        <button
          type="button"
          className="btn btn-primary dl-smart-answer__fit-cta"
          onClick={() => onSelectModel?.(answer.primaryModelKey)}
        >
          {answer.viewModelCta}
        </button>
      )}

      {answer.showConfiguratorCta && answer.configuratorCta && !configuratorRevealed && (
        <button
          type="button"
          className="btn btn-primary dl-smart-answer__fit-cta"
          onClick={() => onSelectModel?.(answer.primaryModelKey)}
        >
          {answer.configuratorCta}
        </button>
      )}

      {answer.consultationFollowUp && (
        <p className="dl-smart-answer__consult-followup">
          <span className="dl-smart-answer__consult-followup-label">Clever fragt als Nächstes</span>
          {answer.consultationFollowUp}
        </p>
      )}

      {answer.showConsultationCta && onStartConsultation && (
        <button
          type="button"
          className="btn btn-primary dl-smart-answer__consult-cta"
          onClick={onStartConsultation}
        >
          {answer.consultationCtaLabel ?? 'Beratung fortsetzen'}
        </button>
      )}

      {answer.showFitCheck && answer.fitPrompt && !fitRevealed && !configuratorRevealed && (
        <button
          type="button"
          className="btn btn-secondary dl-smart-answer__fit-cta"
          onClick={onShowFit}
        >
          {answer.fitPrompt}
        </button>
      )}
    </section>
  );
}
