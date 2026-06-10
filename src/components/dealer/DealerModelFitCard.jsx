import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { buildCompareFitSummary } from '../../services/dealer/modelFitRecommendation.js';
import './dealer-landing.css';

function FitModelRow({ group }) {
  const v = group.primaryMatch?.vehicle;
  const label = group.label ?? KIA_MODEL_ATTRIBUTES[v?.modelKey]?.label ?? v?.model;
  const quote = group.modelQuote ?? group.primaryMatch?.cleverQuote;
  const recommendation = group.fitRecommendation;

  if (!v) return null;

  return (
    <article className="dl-fit-card__model">
      <VehicleImage
        brand={v.brand ?? 'Kia'}
        model={v.imageModel ?? v.modelKey ?? v.model}
        bodyType={v.bodyType ?? KIA_MODEL_ATTRIBUTES[v.modelKey]?.bodyType}
        className="dl-fit-card__image-wrap"
        imageClassName="dl-fit-card__image"
        variant="card"
        glow
      />
      <div className="dl-fit-card__model-body">
        <h3 className="dl-fit-card__model-name">{label}</h3>
        {recommendation && (
          <p className="dl-fit-card__recommendation">{recommendation}</p>
        )}
        {quote && (
          <CleverQuoteBadge cleverQuote={quote} size="md" showTier={false} />
        )}
      </div>
    </article>
  );
}

/**
 * Phase 3 – Passt das Modell? CleverQuote ohne Preis.
 */
export default function DealerModelFitCard({
  fitPrompt,
  groups = [],
  smartAnswer = null,
  onShowOffers,
}) {
  if (!groups.length) return null;

  const compareSummary = groups.length > 1
    ? buildCompareFitSummary(groups, smartAnswer)
    : null;

  return (
    <section className="dl-fit-card" aria-labelledby="dl-fit-card-title">
      <h2 id="dl-fit-card-title" className="dl-fit-card__title">{fitPrompt}</h2>
      {compareSummary ? (
        <p className="dl-fit-card__summary">{compareSummary}</p>
      ) : (
        <p className="dl-fit-card__subtitle">
          CleverQuote zeigt, wie gut das Modell zu typischen Wünschen passt – ohne Preisdruck.
        </p>
      )}

      <div className={`dl-fit-card__models${groups.length > 1 ? ' dl-fit-card__models--compare' : ''}`}>
        {groups.map((group) => (
          <FitModelRow key={group.modelLineKey ?? group.label} group={group} />
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary dl-fit-card__cta"
        onClick={onShowOffers}
      >
        Passende Angebote ansehen
      </button>
    </section>
  );
}
