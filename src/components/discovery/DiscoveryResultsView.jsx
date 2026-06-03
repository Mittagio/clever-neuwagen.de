import { useMemo } from 'react';
import { CompactSearchSummary } from '../search/SearchFlowComponents.jsx';
import SearchPlausibilityBanner from '../search/SearchPlausibilityBanner.jsx';
import ResultsBrandModelFilter from './ResultsBrandModelFilter.jsx';
import ResultsOfferCount from './ResultsOfferCount.jsx';
import AllBrandsHiddenCard from './AllBrandsHiddenCard.jsx';
import SearchConflictBanner from './SearchConflictBanner.jsx';
import LocationPromptBanner, { LocationRadiusBar } from '../search/LocationPromptBanner.jsx';
import ResultsPageHeadline from './ResultsPageHeadline.jsx';
import DiscoveryHeroCard from './DiscoveryHeroCard.jsx';
import DiscoveryCompareSection from './DiscoveryCompareSection.jsx';
import DiscoveryAlternativesStrip from './DiscoveryAlternativesStrip.jsx';
import PopularOffersStrip from './PopularOffersStrip.jsx';
import DiscoveryDealerTrust from './DiscoveryDealerTrust.jsx';
import { WishVehicleGridCard } from '../wish/WishVehicleCards.jsx';
import { buildCompactSearchChips } from '../../logic/northStarPresentation.js';
import { pickDiscoveryAlternatives } from '../../logic/discoveryResultsPresentation.js';
import { hasLocalizedSearch } from '../../logic/oneSearchService.js';
import { getSimilarVehiclesNearby } from '../../services/pricing/dealerOfferPricing.js';
import { matchVehiclesToWish } from '../../services/wish/wishMatchEngine.js';
import { hasCleverQuoteWishes } from '../../services/cleverQuote/cleverQuoteService.js';
import { RESULT_STATES } from '../../logic/neverEmptyResultsService.js';
import { isAllBrandsExcluded } from '../../logic/brandResultsFilter.js';
import '../search/locationPromptBanner.css';
import './discovery-results.css';

function LocationBlock({
  localized,
  filters,
  variant,
  onAllowLocation,
  onLocationSubmit,
  onPatchFilters,
}) {
  if (localized) {
    return <LocationRadiusBar filters={filters} onPatch={onPatchFilters} variant={variant} />;
  }
  return (
    <LocationPromptBanner
      variant={variant}
      onAllowLocation={onAllowLocation}
      onLocationSubmit={onLocationSubmit}
    />
  );
}

export default function DiscoveryResultsView({
  filters,
  wishes,
  results,
  onEditChip,
  onViewOffer,
  onCustomize,
  onCompare,
  onExpandRadius,
  onAllowLocation,
  onLocationSubmit,
  onPatchFilters,
  onPlausibilityChoice,
  resultCatalog = { brands: [] },
  excludedBrands = [],
  excludedModels = [],
  offerStats = null,
  searchConflict = null,
  onResolveSearchConflict,
  onToggleBrand,
  onToggleModel,
  onShowAllBrands,
  onResetSearch,
  onDealerProfile,
  refineSlot = null,
}) {
  const {
    state,
    headline,
    topMatch,
    restMatches = [],
    alternativeMatches = [],
    popularMatches = [],
    showAlternativeSection,
    isFallbackHero,
    heroBadge,
    dealerCount = 1,
  } = results;

  const compactChips = useMemo(
    () => buildCompactSearchChips(filters, wishes),
    [filters, wishes],
  );

  const allBrandsHidden = isAllBrandsExcluded(resultCatalog, excludedBrands);

  const localized = hasLocalizedSearch(filters);
  const showLocation = localized ? Boolean(onPatchFilters) : true;
  const hideHeadlineSub = compactChips.length > 0;

  const stripAlternatives = useMemo(() => {
    if (state === RESULT_STATES.EXACT) {
      const fromRest = pickDiscoveryAlternatives(topMatch, restMatches);
      if (fromRest.length > 0) return fromRest;
      if (!topMatch?.vehicle) return [];
      const similar = getSimilarVehiclesNearby(topMatch.vehicle, 6);
      return matchVehiclesToWish({
        wishes,
        vehicles: similar.map((v) => ({ ...v, displayRate: v.monthlyRate })),
        getDisplayRate: (v) => v.monthlyRate,
      });
    }
    return alternativeMatches;
  }, [state, topMatch, restMatches, alternativeMatches, wishes]);

  const radiusKm = filters.radius ?? 25;
  const sectionLabel = isFallbackHero ? 'Ihre beste Alternative' : 'Ihr Treffer';
  const moreTitle = showAlternativeSection
    ? 'Weitere Alternativen'
    : 'Weitere passende Angebote';

  const popularTitle = localized
    ? 'Beliebte Angebote in Ihrer Nähe'
    : 'Beliebte Angebote – zur Inspiration';

  const showVehicles = !allBrandsHidden;

  return (
    <div className="discovery-results north-star-results north-star-results--v26 north-star-results--booking">
      <div className="booking-selection-card">
        <CompactSearchSummary chips={compactChips} onEditChip={onEditChip} title="Ihre Suche" />

        <ResultsBrandModelFilter
          catalog={resultCatalog}
          excludedBrands={excludedBrands}
          excludedModels={excludedModels}
          onToggleBrand={onToggleBrand}
          onToggleModel={onToggleModel}
          showSection={resultCatalog.brands?.length > 0}
          visibleCount={offerStats?.visible ?? 0}
        />

        <ResultsOfferCount stats={offerStats} cleverQuoteMode={hasCleverQuoteWishes(wishes)} />

        {allBrandsHidden && (
          <AllBrandsHiddenCard
            onShowAllBrands={onShowAllBrands}
            onResetSearch={onResetSearch}
          />
        )}
      </div>

      {(filters.searchWarnings?.length > 0 || filters.searchCorrections?.some((c) => c.requiresChoice)) && (
        <SearchPlausibilityBanner
          warnings={filters.searchWarnings}
          corrections={filters.searchCorrections}
          onChoose={onPlausibilityChoice}
        />
      )}

      {!allBrandsHidden && (
        <>
          {headline?.title && !hideHeadlineSub && (
            <ResultsPageHeadline
              title={headline.title}
              subtitle={headline.subtitle}
              hideSubtitle={Boolean(hideHeadlineSub)}
            />
          )}

          <SearchConflictBanner conflict={searchConflict} onResolve={onResolveSearchConflict} />

          {showVehicles && (
            <section className="disc-section disc-section--hit" aria-labelledby="disc-hit-title">
              <h2 id="disc-hit-title" className="disc-section__label">{sectionLabel}</h2>

              {topMatch && (
                <DiscoveryHeroCard
                  match={topMatch}
                  onViewOffer={onViewOffer}
                  onCustomize={onCustomize}
                  heroBadge={heroBadge}
                />
              )}

              <DiscoveryCompareSection
                dealerCount={dealerCount}
                radiusKm={radiusKm}
                localized={localized}
                onCompare={dealerCount > 1 && state === RESULT_STATES.EXACT ? onCompare : undefined}
                onExpandRadius={dealerCount <= 1 ? onExpandRadius : undefined}
              />

              {restMatches.length > 0 && !showAlternativeSection && (
                <div className="north-star-results__more">
                  <h3 className="north-star-results__more-title">{moreTitle}</h3>
                  <div className="wish-grid-list__grid">
                    {restMatches.map((match) => (
                      <WishVehicleGridCard
                        key={match.vehicleId}
                        match={match}
                        onViewOffer={() => onViewOffer?.(match.vehicle)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {showVehicles && showAlternativeSection && stripAlternatives.length > 0 && (
            <DiscoveryAlternativesStrip
              matches={stripAlternatives}
              max={5}
              title="Diese Angebote könnten stattdessen passen"
              subtitle="Ähnliches Budget, Modell oder Antrieb."
            />
          )}

          {showVehicles && state === RESULT_STATES.EXACT && stripAlternatives.length > 0 && (
            <DiscoveryAlternativesStrip matches={stripAlternatives} max={5} />
          )}

          {showVehicles && (
            <DiscoveryDealerTrust match={topMatch} onMoreFromDealer={onDealerProfile} />
          )}

          {showVehicles && (
            <PopularOffersStrip
              matches={popularMatches}
              title={popularTitle}
              subtitle={localized ? 'Gerade oft angesehen.' : 'Aktuell deutschlandweit – mit Standort sehen Sie Händler in Ihrer Nähe.'}
            />
          )}
        </>
      )}

      {showLocation && !allBrandsHidden && (
        <div className="disc-loc-slot disc-loc-slot--bottom">
          <LocationBlock
            localized={localized}
            filters={filters}
            variant="compact"
            onAllowLocation={onAllowLocation}
            onLocationSubmit={onLocationSubmit}
            onPatchFilters={onPatchFilters}
          />
        </div>
      )}

      {refineSlot && (
        <div className="north-star-results__refine-slot">{refineSlot}</div>
      )}
    </div>
  );
}
