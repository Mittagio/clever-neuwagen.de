import WishMatchScore from './WishMatchScore.jsx';
import { WishMissingHint } from './WishFulfillmentList.jsx';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import './wish.css';

export default function TrimWishComparison({ trimResults, bestTrimId, onSelectTrim }) {
  if (!trimResults.length) return null;

  return (
    <section className="trim-wish-compare" aria-label="Ausstattungsvergleich">
      <h2 className="trim-wish-compare__title">Welche Ausstattung erfüllt Ihre Wünsche?</h2>
      <div className="trim-wish-compare__grid">
        {trimResults.map((trim) => {
          const isBest = trim.trimId === bestTrimId || trim.isBest;
          const missingLabels = trim.missingFeatures?.map(getFeatureLabel) ?? [];

          return (
            <article
              key={trim.trimId}
              className={`trim-wish-card${isBest ? ' trim-wish-card--best' : ''}`}
            >
              {isBest && <p className="trim-wish-card__badge">Beste Empfehlung</p>}
              <h3>{trim.trimName}</h3>
              <WishMatchScore matched={trim.wishesMatched} total={trim.wishesTotal} size="sm" />
              {trim.baseRate && (
                <p className="trim-wish-card__rate">ab {trim.baseRate} €/Monat</p>
              )}
              {trim.availableWithPackage?.length > 0 && (
                <p className="trim-wish-card__hint">
                  {trim.availableWithPackage.map(getFeatureLabel).join(', ')} per Paket
                </p>
              )}
              {missingLabels.length > 0 && (
                <p className="trim-wish-card__missing">Fehlt: {missingLabels.join(', ')}</p>
              )}
              {onSelectTrim && (
                <button type="button" className="trim-wish-card__cta" onClick={() => onSelectTrim(trim.trimId)}>
                  Angebote ansehen
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
