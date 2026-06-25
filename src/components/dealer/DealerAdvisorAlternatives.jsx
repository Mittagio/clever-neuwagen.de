import VehicleImage from '../shared/VehicleImage.jsx';
import {
  buildDealerMissingWishSummary,
  buildDealerWishCheckLines,
  resolveDealerModelTitle,
} from '../../services/dealer/dealerAdvisorPresentation.js';
import { CUSTOMER_SEARCH_COPY } from '../../services/dealer/customerSearchResultPresentation.js';
import { resolveVehicleImageModel } from '../../services/vehicle/vehicleImageService.js';
import './dealer-landing.css';

function AlternativeRow({ group, onViewOffer }) {
  const v = group.primaryMatch?.vehicle;
  if (!v) return null;

  const modelTitle = resolveDealerModelTitle(group);
  const checks = group.modelChecks ?? [];
  const fitLines = buildDealerWishCheckLines(checks).slice(0, 2);
  const missing = buildDealerMissingWishSummary(checks);

  return (
    <button
      type="button"
      className="dl-advisor-alt"
      onClick={() => onViewOffer?.(v)}
    >
      <VehicleImage
        brand="Kia"
        model={resolveVehicleImageModel(v) ?? group.modelLineKey}
        bodyType={v.bodyType}
        className="dl-advisor-alt__image vehicle-image--oem-hero"
        variant="hero"
      />
      <div className="dl-advisor-alt__body">
        <p className="dl-advisor-alt__title">{modelTitle}</p>
        {fitLines.length > 0 && (
          <p className="dl-advisor-alt__score">
            {fitLines.map((line) => `✓ ${line}`).join(' · ')}
          </p>
        )}
        {missing?.length > 0 && (
          <p className="dl-advisor-alt__missing">
            Vom Autohaus prüfen:
            {' '}
            {missing.join(', ')}
          </p>
        )}
      </div>
      <span className="dl-advisor-alt__arrow" aria-hidden>→</span>
    </button>
  );
}

export default function DealerAdvisorAlternatives({ groups = [], onViewOffer }) {
  if (groups.length < 1) return null;

  return (
    <section className="dl-advisor-alts" aria-labelledby="dl-advisor-alts-title">
      <h3 id="dl-advisor-alts-title" className="dl-advisor-alts__title">
        {CUSTOMER_SEARCH_COPY.multiResultHeadline}
      </h3>
      <div className="dl-advisor-alts__list">
        {groups.map((group) => (
          <AlternativeRow
            key={group.modelLineKey ?? group.label}
            group={group}
            onViewOffer={onViewOffer}
          />
        ))}
      </div>
    </section>
  );
}
