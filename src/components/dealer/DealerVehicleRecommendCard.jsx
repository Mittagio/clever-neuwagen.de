import VehicleImage from '../shared/VehicleImage.jsx';
import CustomerSearchAssessment from './CustomerSearchAssessment.jsx';
import { buildVehicleFitReasons, buildSearchCriteriaLabels } from '../../services/dealer/vehicleSalesJourney.js';
import {
  buildCustomerModelCtaLabel,
} from '../../services/dealer/customerSearchResultPresentation.js';
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
  const modelChecks = group.modelChecks ?? [];

  return (
    <section className="dl-sales-rec" aria-label={`Kia ${label}`}>
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
            Kia
            {' '}
            {label}
          </p>

          <CustomerSearchAssessment
            cleverQuote={quote}
            checks={modelChecks}
            wishLines={reasons}
          />

          <button
            type="button"
            className="btn btn-primary dl-sales-rec__cta"
            onClick={() => onViewVehicle?.(modelKey)}
          >
            {buildCustomerModelCtaLabel(label)}
          </button>
        </div>
      </article>
    </section>
  );
}
