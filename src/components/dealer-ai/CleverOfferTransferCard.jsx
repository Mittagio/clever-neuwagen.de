import './CustomerOfferEdit.css';

/**
 * Hinweiskarte im Angebotsflow – Daten aus Frag Clever übernommen.
 */
export default function CleverOfferTransferCard({ transfer }) {
  if (!transfer?.customerWish) return null;

  const {
    customerWish,
    recommendationTitle,
    recommendationSummary,
    requirementChips = [],
    openQuestions = [],
  } = transfer;

  return (
    <section className="cn-clever-transfer" aria-labelledby="cn-clever-transfer-title">
      <header className="cn-clever-transfer__head">
        <h2 id="cn-clever-transfer-title" className="cn-clever-transfer__title">
          Aus Clever-Beratung übernommen
        </h2>
        <p className="cn-clever-transfer__hint">Vorbefüllt – bitte prüfen und ergänzen</p>
      </header>

      <div className="cn-clever-transfer__body">
        <div className="cn-clever-transfer__block">
          <p className="cn-clever-transfer__label">Wunsch</p>
          <p className="cn-clever-transfer__text">&ldquo;{customerWish}&rdquo;</p>
        </div>

        {(recommendationTitle || recommendationSummary) && (
          <div className="cn-clever-transfer__block">
            <p className="cn-clever-transfer__label">Empfehlung</p>
            {recommendationTitle && (
              <p className="cn-clever-transfer__rec">{recommendationTitle}</p>
            )}
            {recommendationSummary && (
              <p className="cn-clever-transfer__text">{recommendationSummary}</p>
            )}
          </div>
        )}

        {requirementChips.length > 0 && (
          <div className="cn-clever-transfer__block">
            <p className="cn-clever-transfer__label">Anforderungen</p>
            <ul className="cn-clever-transfer__chips">
              {requirementChips.map((chip) => (
                <li key={chip.id}>
                  <span className="cn-clever-transfer__chip">{chip.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {openQuestions.length > 0 && (
          <div className="cn-clever-transfer__block cn-clever-transfer__block--open">
            <p className="cn-clever-transfer__label">Noch offen</p>
            <ul className="cn-clever-transfer__open">
              {openQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
