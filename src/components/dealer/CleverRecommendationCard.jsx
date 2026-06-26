import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import './clever-consultation.css';

/**
 * Passende Richtung – Fahrzeug + Ausstattung mit Alternativen.
 */
export default function CleverRecommendationCard({
  recommendation,
  dealerId,
  onTalkToSeller,
  onConfigureClassic,
  onSelectAlternative,
}) {
  if (!recommendation?.ready) {
    return (
      <section className="dl-clever-rec dl-clever-rec--empty">
        <p>{recommendation?.message ?? 'Clever prüft passende Richtungen …'}</p>
      </section>
    );
  }

  const {
    modelKey,
    modelLabel,
    trimLabel,
    vehicleTitle,
    whyLines = [],
    alternatives = [],
    cleverQuotePercent,
    group,
  } = recommendation;

  const quote = group?.modelQuote ?? group?.primaryMatch?.cleverQuote;
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];

  return (
    <section className="dl-clever-rec" aria-labelledby="dl-clever-rec-title">
      <header className="dl-clever-rec__head">
        <p className="dl-clever-rec__eyebrow">Das könnte passen</p>
        <h2 id="dl-clever-rec-title" className="dl-clever-rec__title">
          Kia
          {' '}
          {modelLabel}
          {trimLabel ? ` ${trimLabel}` : ''}
        </h2>
      </header>

      <article className="dl-clever-rec__card">
        <div className="dl-clever-rec__visual">
          <VehicleImage
            brand="Kia"
            model={modelKey}
            bodyType={attrs?.bodyType ?? 'suv'}
            variant="hero"
            className="dl-clever-rec__image-wrap vehicle-image--oem-hero"
            imageClassName="dl-clever-rec__image"
            glow
          />
        </div>

        <div className="dl-clever-rec__body">
          {(quote || cleverQuotePercent != null) && (
            <CleverQuoteBadge
              cleverQuote={quote ?? { percent: cleverQuotePercent }}
              size="lg"
              showTier={false}
            />
          )}

          <h3 className="dl-clever-rec__why-title">Warum das passen könnte</h3>
          <ul className="dl-clever-rec__reasons">
            {whyLines.map((line) => (
              <li key={line}>
                <span aria-hidden>✓</span>
                {' '}
                {line}
              </li>
            ))}
          </ul>

          {alternatives.length > 0 && (
            <div className="dl-clever-rec__alts">
              <p className="dl-clever-rec__alts-label">Alternativen</p>
              <ul className="dl-clever-rec__alts-list">
                {alternatives.filter(Boolean).map((alt) => (
                  <li key={alt.trimId ?? alt.trimLabel}>
                    <button
                      type="button"
                      className="dl-clever-rec__alt-btn"
                      onClick={() => onSelectAlternative?.(alt.trimId)}
                    >
                      {alt.medal && <span aria-hidden>{alt.medal} </span>}
                      <strong>{alt?.trimLabel ?? 'Ausstattung'}</strong>
                      {alt.tagline && (
                        <span className="dl-clever-rec__alt-tag">
                          (
                          {alt.tagline}
                          )
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="dl-clever-rec__actions">
            <button
              type="button"
              className="btn btn-primary dl-clever-rec__cta-primary"
              onClick={() => onTalkToSeller?.(recommendation)}
            >
              Verkäufer soll mich kontaktieren
            </button>
            <button
              type="button"
              className="btn btn-secondary dl-clever-rec__cta-secondary"
              onClick={() => onConfigureClassic?.(recommendation)}
            >
              Im Konfigurator weiter
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
