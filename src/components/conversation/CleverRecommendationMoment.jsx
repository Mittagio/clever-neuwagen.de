import { resolveManufacturerImageUrl } from '../../services/media/manufacturerMediaService.js';
import CleverLearnedBlock from './CleverLearnedBlock.jsx';
import './clever-conversation.css';

export default function CleverRecommendationMoment({
  recommendation,
  notepadLabels = [],
  onSelectPrimary,
  onDiscussAlternatives,
}) {
  if (!recommendation?.ready) return null;

  const { primary, alternatives = [] } = recommendation;
  const imageUrl = resolveManufacturerImageUrl('Kia', primary.modelLabel, { view: 'hero' })
    ?? resolveManufacturerImageUrl('Kia', primary.modelKey, { view: 'hero' });

  return (
    <section className="cc-recommendation cc-turn-enter" aria-labelledby="cc-recommendation-title">
      <CleverLearnedBlock labels={notepadLabels} compact />

      <div className="cc-recommendation__divider" aria-hidden />

      {recommendation.personalLead && (
        <p className="cc-recommendation__personal">{recommendation.personalLead}</p>
      )}

      <div className="cc-recommendation__headline-block">
        <p id="cc-recommendation-title" className="cc-recommendation__headline">
          {recommendation.headline}
        </p>
        <p className="cc-recommendation__model cc-recommendation__model--hero">
          {recommendation.modelName ?? `Kia ${primary.modelLabel}`}
        </p>
        {recommendation.modelSubline && (
          <p className="cc-recommendation__subline">{recommendation.modelSubline}</p>
        )}
      </div>

      <div className="cc-recommendation__hero">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={`Kia ${primary.modelLabel}`}
            className="cc-recommendation__image"
            loading="lazy"
          />
        )}
      </div>

      {primary.whyLines?.length > 0 && (
        <div className="cc-recommendation__why">
          <p className="cc-recommendation__why-title">Warum?</p>
          <ul className="cc-recommendation__why-list">
            {primary.whyLines.map((line) => (
              <li key={line} className="cc-recommendation__why-item">
                <span aria-hidden>✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="cc-recommendation__alternatives">
          <p className="cc-recommendation__alt-label">Alternativen</p>
          <ul className="cc-recommendation__alt-list">
            {alternatives.map((alt) => (
              <li key={alt.modelKey} className="cc-recommendation__alt-item">
                <span className="cc-recommendation__alt-name">{alt.modelLabel}</span>
                {alt.tagline && (
                  <span className="cc-recommendation__alt-tag">{alt.tagline}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="cc-recommendation__cta"
        onClick={() => onSelectPrimary?.(primary.modelKey)}
      >
        {primary.modelLabel} genauer ansehen
      </button>

      <button
        type="button"
        className="cc-recommendation__secondary"
        onClick={onDiscussAlternatives}
      >
        Passt nicht ganz? Andere Richtung besprechen
      </button>
    </section>
  );
}
