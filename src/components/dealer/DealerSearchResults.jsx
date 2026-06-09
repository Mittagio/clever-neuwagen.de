import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DiscoveryModelLineCard from '../discovery/DiscoveryModelLineCard.jsx';
import { buildFahrzeugeSearchUrl } from '../../logic/oneSearchService.js';
import { deriveAdvisorChipIds } from '../../services/sales/advisorRanking.js';
import { enrichModelLineGroupWithProfileQuote } from '../../services/cleverQuote/cleverQuoteService.js';
import { DEALER_MAX_RECOMMENDATIONS } from '../../data/dealerLandingContent.js';
import '../discovery/discovery-results.css';
import './dealer-landing.css';

export default function DealerSearchResults({
  query,
  searchProfile = null,
  modelLineGroups = [],
  filters = null,
  wishes = null,
  dealerSlug,
  city = '',
  source = 'local',
  onShowAll,
  hideHeader = false,
  alternativeTier = false,
  maxRecommendations = DEALER_MAX_RECOMMENDATIONS,
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const paymentMode = filters?.payment || 'cash';
  const paymentNeutral = !filters?.payment;
  const chipIds = filters && wishes ? deriveAdvisorChipIds(filters, wishes) : [];

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

  const groups = searchProfile
    ? modelLineGroups.map((group) => enrichModelLineGroupWithProfileQuote(group, searchProfile))
    : modelLineGroups;

  const hasMore = groups.length > maxRecommendations;
  const visibleGroups = expanded ? groups : groups.slice(0, maxRecommendations);

  return (
    <section
      className={`dl-search-results${alternativeTier ? ' dl-search-results--tier' : ''}`}
      aria-labelledby={hideHeader ? undefined : 'dl-search-results-heading'}
    >
      {!hideHeader && (
        <div className="dl-search-results__head">
          <h2 id="dl-search-results-heading" className="dl-section__title">
            Unsere Empfehlungen
          </h2>
          <p className="dl-search-results__meta">
            {Math.min(groups.length, maxRecommendations)} von {groups.length} Modelllinien
            {source === 'server' && <span className="dl-search-results__sync"> · Berater-Sync</span>}
          </p>
        </div>
      )}

      <div className="dl-search-results__list">
        {visibleGroups.map((group, index) => (
          <DiscoveryModelLineCard
            key={group.modelLineKey ?? group.label}
            group={{ ...group, rank: index + 1 }}
            rank={index + 1}
            paymentMode={paymentMode}
            paymentNeutral={paymentNeutral}
            wishes={wishes}
            chipIds={chipIds}
            searchProfile={searchProfile}
            onViewOffer={handleViewOffer}
            defaultVariantsOpen={index === 0}
          />
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          type="button"
          className="btn btn-secondary dl-search-results__more"
          onClick={() => setExpanded(true)}
        >
          Weitere Modelle anzeigen ({groups.length - maxRecommendations})
        </button>
      )}

      {!hideHeader && (
        <button type="button" className="btn btn-secondary dl-search-results__all" onClick={handleShowAll}>
          Alle Ergebnisse auf clever-neuwagen.de
        </button>
      )}
    </section>
  );
}
