import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DiscoveryModelLineCard from '../discovery/DiscoveryModelLineCard.jsx';
import { buildFahrzeugeSearchUrl } from '../../logic/oneSearchService.js';
import { deriveAdvisorChipIds } from '../../services/sales/advisorRanking.js';
import { enrichModelLineGroupWithProfileQuote } from '../../services/cleverQuote/cleverQuoteService.js';
import {
  buildCustomerSearchSectionMeta,
  CUSTOMER_SEARCH_COPY,
} from '../../services/dealer/customerSearchResultPresentation.js';
import { DEALER_MAX_RECOMMENDATIONS } from '../../data/dealerLandingContent.js';
import DealerAdvisorAlternatives from './DealerAdvisorAlternatives.jsx';
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
  dealerAdvisor = true,
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
  const primaryGroup = visibleGroups[0] ?? null;
  const alternateGroups = visibleGroups.slice(1);

  return (
    <section
      className={`dl-search-results${alternativeTier ? ' dl-search-results--tier' : ''}`}
      aria-labelledby={hideHeader ? undefined : 'dl-search-results-heading'}
    >
      {!hideHeader && (
        <div className="dl-search-results__head">
          <h2 id="dl-search-results-heading" className="dl-section__title">
            {CUSTOMER_SEARCH_COPY.searchSectionTitle}
          </h2>
          <p className="dl-search-results__meta">
            {buildCustomerSearchSectionMeta(
              Math.min(groups.length, maxRecommendations),
              groups.length,
            )}
            {source === 'server' && <span className="dl-search-results__sync"> · Berater-Sync</span>}
          </p>
        </div>
      )}

      <div className="dl-search-results__list">
        {primaryGroup && (
          <DiscoveryModelLineCard
            key={primaryGroup.modelLineKey ?? primaryGroup.label}
            group={{ ...primaryGroup, rank: 1 }}
            rank={1}
            paymentMode={paymentMode}
            paymentNeutral={paymentNeutral}
            wishes={wishes}
            chipIds={chipIds}
            searchProfile={searchProfile}
            onViewOffer={handleViewOffer}
            defaultVariantsOpen={false}
            dealerAdvisor={dealerAdvisor}
            allGroups={visibleGroups}
          />
        )}
        {!dealerAdvisor && alternateGroups.map((group, index) => (
          <DiscoveryModelLineCard
            key={group.modelLineKey ?? group.label}
            group={{ ...group, rank: index + 2 }}
            rank={index + 2}
            paymentMode={paymentMode}
            paymentNeutral={paymentNeutral}
            wishes={wishes}
            chipIds={chipIds}
            searchProfile={searchProfile}
            onViewOffer={handleViewOffer}
            defaultVariantsOpen={false}
          />
        ))}
      </div>

      {dealerAdvisor && alternateGroups.length > 0 && (
        <DealerAdvisorAlternatives
          groups={alternateGroups}
          onViewOffer={handleViewOffer}
        />
      )}

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
