import DealerInquiryLeadNotice from './DealerInquiryLeadNotice.jsx';
import DealerModelSwipeCarousel from './DealerModelSwipeCarousel.jsx';
import { buildCustomerSearchResultsHeadline, CUSTOMER_SEARCH_COPY } from '../../services/dealer/customerSearchResultPresentation.js';
import './dealer-landing.css';

/**
 * Clever-Antwort bei Bedürfnis-Anfragen – Wünsche + Swipe-Empfehlungen (kein Modell-Katalog).
 */
export default function DealerNeedAnswerCard({
  recognizedWishes = [],
  answer,
  inquiryLeadSync = null,
  dealerId,
  activeModelKey = null,
  onActivePickChange,
  onSelectModel,
  onClarify,
}) {
  if (!answer || !recognizedWishes.length) return null;

  const { modelCount, picks = [], clarification } = answer;

  return (
    <section className="dl-need-answer" aria-labelledby="dl-need-answer-title">
      <header className="dl-need-answer__head">
        <p className="dl-need-answer__kicker">
          <span aria-hidden>🧠</span>
          {' '}
          {CUSTOMER_SEARCH_COPY.needAnswerKicker}
        </p>
        <h2 id="dl-need-answer-title" className="dl-need-answer__title">
          {CUSTOMER_SEARCH_COPY.wishesRecognizedTitle}
        </h2>
        <ul className="dl-need-answer__wishes">
          {recognizedWishes.map((wish) => (
            <li key={wish.id} className="dl-need-answer__wish-tag">
              <span aria-hidden>✓</span>
              {' '}
              {wish.label}
            </li>
          ))}
        </ul>
        <DealerInquiryLeadNotice syncResult={inquiryLeadSync} />
      </header>

      {modelCount > 0 && (
        <div className="dl-need-answer__results">
          <h3 className="dl-need-answer__results-title">
            {buildCustomerSearchResultsHeadline(Math.min(modelCount, picks.length || modelCount))}
          </h3>
          <DealerModelSwipeCarousel
            picks={picks}
            dealerId={dealerId}
            activeModelKey={activeModelKey}
            onActiveChange={onActivePickChange}
            onSelectModel={onSelectModel}
          />
        </div>
      )}

      {clarification && (
        <div className="dl-need-answer__clarify">
          <p className="dl-need-answer__clarify-title">{clarification.title}</p>
          <div className="dl-need-answer__clarify-options">
            {clarification.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="btn btn-secondary dl-need-answer__clarify-btn"
                onClick={() => onClarify?.(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
