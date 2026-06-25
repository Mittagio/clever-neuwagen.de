import VehicleImage from '../shared/VehicleImage.jsx';
import CustomerSearchAssessment from './CustomerSearchAssessment.jsx';
import { buildVehicleFitReasons } from '../../services/dealer/vehicleSalesJourney.js';
import {
  buildCustomerModelCtaLabel,
  CUSTOMER_SEARCH_COPY,
} from '../../services/dealer/customerSearchResultPresentation.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { buildCompareFitSummary } from '../../services/dealer/modelFitRecommendation.js';
import './dealer-landing.css';

function CompareModelColumn({
  group,
  dealerId,
  searchProfile,
  searchWishes,
  chipIds,
  onSelectModel,
}) {
  const v = group.primaryMatch?.vehicle;
  const modelKey = v?.modelKey ?? group.modelLineKey;
  const label = group.label ?? KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? v?.model;
  const quote = group.modelQuote ?? group.primaryMatch?.cleverQuote;
  const reasons = buildVehicleFitReasons(group, { searchProfile, searchWishes, chipIds }).slice(0, 3);
  const modelChecks = group.modelChecks ?? [];

  return (
    <article className="dl-sales-compare__col">
      <VehicleImage
        brand="Kia"
        model={modelKey}
        bodyType={v?.bodyType ?? KIA_MODEL_ATTRIBUTES[modelKey]?.bodyType}
        className="dl-sales-compare__image-wrap vehicle-image--oem-hero"
        imageClassName="dl-sales-compare__image"
        variant="hero"
        glow
      />
      <h3 className="dl-sales-compare__name">
        Kia
        {' '}
        {label}
      </h3>
      <CustomerSearchAssessment
        cleverQuote={quote}
        checks={modelChecks}
        wishLines={reasons}
      />
      <button
        type="button"
        className="btn btn-primary dl-sales-compare__cta"
        onClick={() => onSelectModel?.(modelKey)}
      >
        {buildCustomerModelCtaLabel(label)}
      </button>
    </article>
  );
}

/**
 * Zwei-Fahrzeug-Vergleich in der Verkäufer-Journey (z. B. EV9 vs. Sorento).
 */
export default function DealerJourneyCompareCard({
  groups = [],
  dealerId,
  searchProfile,
  searchWishes,
  chipIds = [],
  onSelectModel,
}) {
  if (groups.length < 2) return null;

  const summary = buildCompareFitSummary(groups);

  return (
    <section className="dl-sales-compare" aria-labelledby="dl-sales-compare-title">
      <h2 id="dl-sales-compare-title" className="dl-sales-compare__title">
        {CUSTOMER_SEARCH_COPY.compareTitle}
      </h2>
      {summary && (
        <p className="dl-sales-compare__summary">{summary}</p>
      )}
      <div className="dl-sales-compare__grid">
        {groups.slice(0, 2).map((group) => (
          <CompareModelColumn
            key={group.modelLineKey ?? group.label}
            group={group}
            dealerId={dealerId}
            searchProfile={searchProfile}
            searchWishes={searchWishes}
            chipIds={chipIds}
            onSelectModel={onSelectModel}
          />
        ))}
      </div>
    </section>
  );
}
