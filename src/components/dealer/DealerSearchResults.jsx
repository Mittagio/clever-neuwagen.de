import { useNavigate } from 'react-router-dom';
import DiscoveryModelLineCard from '../discovery/DiscoveryModelLineCard.jsx';
import { buildFahrzeugeSearchUrl } from '../../logic/oneSearchService.js';
import '../discovery/discovery-results.css';
import './dealer-landing.css';

export default function DealerSearchResults({
  query,
  modelLineGroups = [],
  dealerSlug,
  city = '',
  source = 'local',
  onShowAll,
}) {
  const navigate = useNavigate();

  if (!modelLineGroups.length) return null;

  function handleViewOffer(vehicle) {
    if (vehicle?.slug) {
      navigate(`/fahrzeug/${vehicle.slug}`);
    }
  }

  function handleShowAll() {
    if (onShowAll) {
      onShowAll();
      return;
    }
    navigate(buildFahrzeugeSearchUrl({
      query,
      city,
      dealer: dealerSlug,
    }));
  }

  return (
    <section className="dl-search-results" aria-labelledby="dl-search-results-heading">
      <div className="dl-search-results__head">
        <h2 id="dl-search-results-heading" className="dl-section__title">
          Passende Modelle
        </h2>
        <p className="dl-search-results__meta">
          {modelLineGroups.length} Modelllinien
          {source === 'server' && <span className="dl-search-results__sync"> · Berater-Sync</span>}
        </p>
      </div>

      <div className="dl-search-results__list">
        {modelLineGroups.slice(0, 5).map((group) => (
          <DiscoveryModelLineCard
            key={group.modelLineKey ?? group.label}
            group={group}
            rank={group.rank ?? 1}
            paymentMode="leasing"
            onViewOffer={handleViewOffer}
            defaultVariantsOpen={group.rank <= 2}
          />
        ))}
      </div>

      <button type="button" className="btn btn-secondary dl-search-results__all" onClick={handleShowAll}>
        Alle Ergebnisse anzeigen
      </button>
    </section>
  );
}
