import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { buildVehicleFitReasons, buildSearchCriteriaLabels } from '../../services/dealer/vehicleSalesJourney.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import './dealer-landing.css';

/**
 * Schritt 1 – Fahrzeugempfehlung ohne Preise, ohne Ausstattungslinien.
 */
export default function DealerVehicleRecommendCard({
  group,
  rank = 1,
  dealerId,
  searchProfile,
  searchFilters,
  searchWishes,
  chipIds = [],
  onViewVehicle,
}) {
  if (!group?.primaryMatch) return null;

  const v = group.primaryMatch.vehicle;
  const modelKey = v?.modelKey ?? group.modelLineKey;
  const label = group.label ?? KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? v?.model;
  const quote = group.modelQuote ?? group.primaryMatch.cleverQuote;
  const criteria = buildSearchCriteriaLabels(searchProfile, searchFilters);
  const reasons = buildVehicleFitReasons(group, { searchProfile, searchWishes, chipIds });
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <section className="dl-sales-rec" aria-labelledby="dl-sales-rec-title">
      {criteria.length > 0 && (
        <p className="dl-sales-rec__criteria">{criteria.join(' · ')}</p>
      )}

      <article className="dl-sales-rec__card">
        <div className="dl-sales-rec__visual">
          <VehicleImage
            brand="Kia"
            model={modelKey}
            bodyType={v?.bodyType ?? KIA_MODEL_ATTRIBUTES[modelKey]?.bodyType}
            className="dl-sales-rec__image-wrap vehicle-image--oem-hero"
            imageClassName="dl-sales-rec__image"
            variant="hero"
            glow
          />
        </div>

        <div className="dl-sales-rec__body">
          <p className="dl-sales-rec__rank">
            {medal && <span aria-hidden>{medal} </span>}
            Kia
            {' '}
            {label}
          </p>
          {quote && (
            <CleverQuoteBadge cleverQuote={quote} size="lg" showTier={false} />
          )}

          <h2 id="dl-sales-rec-title" className="dl-sales-rec__why-title">
            Warum passt dieses Fahrzeug?
          </h2>
          {reasons.length > 0 ? (
            <ul className="dl-sales-rec__reasons">
              {reasons.map((line) => (
                <li key={line}>
                  <span aria-hidden>✅</span>
                  {' '}
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dl-sales-rec__fallback">Passt gut zu Ihrer Suche.</p>
          )}

          <button
            type="button"
            className="btn btn-primary dl-sales-rec__cta"
            onClick={() => onViewVehicle?.(modelKey)}
          >
            {label}
            {' '}
            ansehen
          </button>
        </div>
      </article>
    </section>
  );
}
