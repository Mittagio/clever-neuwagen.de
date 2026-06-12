import VehicleImage from '../shared/VehicleImage.jsx';
import {
  resolveDealerModelTitle,
  resolveDealerRecommendedTrim,
} from '../../services/dealer/dealerAdvisorPresentation.js';
import { resolveVehicleImageModel } from '../../services/vehicle/vehicleImageService.js';
import DealerAdvisorCleverQuote from './DealerAdvisorCleverQuote.jsx';
import DealerAdvisorCoreSpecs from './DealerAdvisorCoreSpecs.jsx';
import DealerAdvisorWhyPanel from './DealerAdvisorWhyPanel.jsx';
import { buildDealerRecommendationLead } from '../../services/dealer/dealerAdvisorPresentation.js';
import './dealer-landing.css';

export default function DealerAdvisorHeroCard({
  group,
  allGroups = [],
  onViewOffer,
  onExploreTrims,
  exploreTrimsLabel,
}) {
  const { primaryMatch, modelQuote, modelChecks = [], hasMultipleVariants } = group ?? {};
  if (!primaryMatch) return null;

  const v = primaryMatch.vehicle;
  const modelTitle = resolveDealerModelTitle(group);
  const trimLabel = resolveDealerRecommendedTrim(group);
  const shortName = modelTitle.replace(/^Kia\s+/i, '');
  const modelKey = v?.modelKey ?? group.modelLineKey;
  const lead = buildDealerRecommendationLead(group, allGroups);

  return (
    <article className="dl-advisor-hero">
      {lead && (
        <p className="dl-advisor-hero__lead">{lead}</p>
      )}
      <div className="dl-advisor-hero__grid">
        <div className="dl-advisor-hero__visual">
          <VehicleImage
            brand="Kia"
            model={resolveVehicleImageModel(v) ?? modelKey}
            bodyType={v?.bodyType}
            className="dl-advisor-hero__image-wrap vehicle-image--oem-hero"
            imageClassName="dl-advisor-hero__image"
            variant="hero"
            glow
          />
        </div>

        <div className="dl-advisor-hero__body">
          <h2 className="dl-advisor-hero__title">{modelTitle}</h2>

          <DealerAdvisorCoreSpecs vehicle={v} />

          <DealerAdvisorCleverQuote cleverQuote={modelQuote} checks={modelChecks} />

          {trimLabel && trimLabel !== shortName && (
            <p className="dl-advisor-hero__trim">
              Empfohlene Ausstattung:
              {' '}
              <span>{trimLabel}</span>
            </p>
          )}

          <DealerAdvisorWhyPanel checks={modelChecks} />

          {hasMultipleVariants && onExploreTrims ? (
            <button
              type="button"
              className="btn btn-primary dl-advisor-hero__cta"
              onClick={onExploreTrims}
            >
              {exploreTrimsLabel ?? `${shortName} ansehen`}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary dl-advisor-hero__cta"
              onClick={() => onViewOffer?.(v)}
            >
              {shortName}
              {' '}
              ansehen
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
