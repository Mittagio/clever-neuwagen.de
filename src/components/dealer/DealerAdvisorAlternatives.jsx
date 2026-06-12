import VehicleImage from '../shared/VehicleImage.jsx';
import {
  buildDealerFulfillmentHeadline,
  buildDealerMissingWishSummary,
  resolveDealerModelTitle,
} from '../../services/dealer/dealerAdvisorPresentation.js';
import { resolveVehicleImageModel } from '../../services/vehicle/vehicleImageService.js';
import './dealer-landing.css';

const MEDALS = ['🥈', '🥉'];

function AlternativeRow({ group, rank, onViewOffer }) {
  const v = group.primaryMatch?.vehicle;
  if (!v) return null;

  const modelTitle = resolveDealerModelTitle(group);
  const checks = group.modelChecks ?? [];
  const quote = group.modelQuote;
  const percent = quote?.percent ?? 0;
  const summary = buildDealerFulfillmentHeadline(quote, checks);
  const missing = buildDealerMissingWishSummary(checks);
  const medal = MEDALS[rank - 2] ?? `${rank}.`;

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
        <p className="dl-advisor-alt__title">
          <span className="dl-advisor-alt__medal" aria-hidden>{medal}</span>
          {modelTitle}
        </p>
        <p className="dl-advisor-alt__score">
          {percent}
          {' '}
          % passend
          {summary && (
            <span className="dl-advisor-alt__summary">
              {' '}
              ·
              {' '}
              {summary}
            </span>
          )}
        </p>
        {missing?.length > 0 && (
          <p className="dl-advisor-alt__missing">
            Fehlt:
            {' '}
            {missing.map((label) => (
              <span key={label} className="dl-advisor-alt__missing-item">
                ❌
                {' '}
                {label}
              </span>
            ))}
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
        Weitere passende Fahrzeuge
      </h3>
      <div className="dl-advisor-alts__list">
        {groups.map((group, index) => (
          <AlternativeRow
            key={group.modelLineKey ?? group.label}
            group={group}
            rank={index + 2}
            onViewOffer={onViewOffer}
          />
        ))}
      </div>
    </section>
  );
}
