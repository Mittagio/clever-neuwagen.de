import DealerInquiryLeadNotice from './DealerInquiryLeadNotice.jsx';
import './dealer-landing.css';

/**
 * Clever-Antwort bei Bedürfnis-Anfragen – Wünsche + Top-Modelle.
 */
export default function DealerNeedAnswerCard({
  recognizedWishes = [],
  answer,
  inquiryLeadSync = null,
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
          Clever Antwort
        </p>
        <h2 id="dl-need-answer-title" className="dl-need-answer__title">
          Ich habe folgende Wünsche erkannt:
        </h2>
        <ul className="dl-need-answer__wishes">
          {recognizedWishes.map((wish) => (
            <li key={wish.id}>
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
            Clever hat
            {' '}
            {modelCount}
            {' '}
            passende
            {' '}
            {modelCount === 1 ? 'Modell' : 'Modelle'}
            {' '}
            gefunden
          </h3>
          <ol className="dl-need-answer__picks">
            {picks.map((pick) => (
              <li key={pick.modelKey ?? pick.title} className="dl-need-answer__pick">
                <p className="dl-need-answer__pick-title">
                  <span aria-hidden>{pick.medal}</span>
                  {' '}
                  {pick.title}
                </p>
                {pick.lines?.length > 0 && (
                  <ul className="dl-need-answer__pick-lines">
                    {pick.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
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
