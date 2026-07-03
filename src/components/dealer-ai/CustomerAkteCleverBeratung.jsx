import { Link } from 'react-router-dom';
import './CustomerAkte.css';

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`cust-clever-beratung__status cust-clever-beratung__status--${status.tone}`}>
      {status.label}
    </span>
  );
}

/**
 * Kundenakte – Zusammenfassung der Frag-Clever-Beratung für Verkäufer.
 */
export default function CustomerAkteCleverBeratung({
  view,
  telHref,
  onPrepareOffer,
  onCreateMessage,
  onChangeRecommendation,
}) {
  if (!view?.customerWish) return null;

  const { status, customerWish, requirementChips, recommendation, openQuestions, configuratorUrl, understoodLabels = [] } = view;

  return (
    <section className="cust-clever-beratung" aria-labelledby="cust-clever-beratung-title">
      <header className="cust-clever-beratung__head">
        <div className="cust-clever-beratung__title-row">
          <h2 id="cust-clever-beratung-title" className="cust-clever-beratung__title">
            Clever Beratung
          </h2>
          <StatusBadge status={status} />
        </div>
        <p className="cust-clever-beratung__hint">
          Clever hat den Kunden bereits beraten – hier die Kurzfassung für Sie.
        </p>
      </header>

      <div className="cust-clever-beratung__card">
        <div className="cust-clever-beratung__block">
          <p className="cust-clever-beratung__label">Kundenwunsch</p>
          <p className="cust-clever-beratung__wish">&ldquo;{customerWish}&rdquo;</p>
        </div>

        {understoodLabels.length > 0 && (
          <div className="cust-clever-beratung__block">
            <p className="cust-clever-beratung__label">Clever hat verstanden</p>
            <ul className="cust-clever-beratung__chips">
              {understoodLabels.map((label) => (
                <li key={label}>
                  <span className="cust-clever-beratung__chip">✓ {label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {requirementChips.length > 0 && (
          <div className="cust-clever-beratung__block">
            <p className="cust-clever-beratung__label">Erkannte Anforderungen</p>
            <ul className="cust-clever-beratung__chips">
              {requirementChips.map((chip) => (
                <li key={chip.id}>
                  <span className="cust-clever-beratung__chip">{chip.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendation?.vehicleTitle && (
          <div className="cust-clever-beratung__block cust-clever-beratung__block--highlight">
            <p className="cust-clever-beratung__label">Clever empfiehlt</p>
            {recommendation.headline ? (
              <p className="cust-clever-beratung__rec-summary">{recommendation.headline}</p>
            ) : null}
            <p className="cust-clever-beratung__rec-title">{recommendation.vehicleTitle}</p>
            <dl className="cust-clever-beratung__rec-meta">
              {recommendation.trimLabel && (
                <div>
                  <dt>Ausstattung</dt>
                  <dd>{recommendation.trimLabel}</dd>
                </div>
              )}
              {recommendation.batteryOrMotor && (
                <div>
                  <dt>Batterie / Motor</dt>
                  <dd>{recommendation.batteryOrMotor}</dd>
                </div>
              )}
              {recommendation.priceLine && (
                <div>
                  <dt>Rate / Preis</dt>
                  <dd>{recommendation.priceLine}</dd>
                </div>
              )}
            </dl>
            {recommendation.whyLines?.length > 0 && (
              <ul className="cust-clever-beratung__reasons">
                {recommendation.whyLines.slice(0, 4).map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
            )}
            {recommendation.alternatives?.length > 0 && (
              <div className="cust-clever-beratung__block">
                <p className="cust-clever-beratung__label">Alternativen</p>
                <ul className="cust-clever-beratung__open">
                  {recommendation.alternatives.map((alt) => (
                    <li key={alt.modelKey ?? alt.vehicleTitle}>{alt.vehicleTitle ?? alt.modelLabel}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {openQuestions.length > 0 && (
          <div className="cust-clever-beratung__block">
            <p className="cust-clever-beratung__label">Offene Fragen</p>
            <ul className="cust-clever-beratung__open">
              {openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="cust-clever-beratung__actions">
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--primary"
            onClick={onPrepareOffer}
          >
            Angebot vorbereiten
          </button>
          {telHref && (
            <a
              href={telHref}
              className="cust-clever-beratung__action"
            >
              Kunde anrufen
            </a>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action"
            onClick={onCreateMessage}
          >
            Nachricht erstellen
          </button>
          {configuratorUrl && (
            <Link
              to={configuratorUrl}
              className="cust-clever-beratung__action"
              target="_blank"
              rel="noopener noreferrer"
            >
              Im Konfigurator öffnen
            </Link>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--ghost"
            onClick={onChangeRecommendation}
          >
            Richtung anpassen
          </button>
        </div>
      </div>
    </section>
  );
}
