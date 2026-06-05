import { useMemo, useState } from 'react';

import { CompactSearchSummary } from '../search/SearchFlowComponents.jsx';

import SearchPlausibilityBanner from '../search/SearchPlausibilityBanner.jsx';

import ResultsBrandModelFilter from './ResultsBrandModelFilter.jsx';

import ResultsOfferCount from './ResultsOfferCount.jsx';

import AllBrandsHiddenCard from './AllBrandsHiddenCard.jsx';

import SearchConflictBanner from './SearchConflictBanner.jsx';

import LocationPromptBanner, { LocationRadiusBar } from '../search/LocationPromptBanner.jsx';

import ResultsPageHeadline from './ResultsPageHeadline.jsx';

import DiscoveryHeroCard from './DiscoveryHeroCard.jsx';

import DiscoveryModelLineCard from './DiscoveryModelLineCard.jsx';
import DiscoveryCuratedCard from './DiscoveryCuratedCard.jsx';

import DiscoveryCompareSection from './DiscoveryCompareSection.jsx';

import DiscoveryAlternativesStrip from './DiscoveryAlternativesStrip.jsx';

import PopularOffersStrip from './PopularOffersStrip.jsx';

import DiscoveryDealerTrust from './DiscoveryDealerTrust.jsx';

import { WishVehicleGridCard } from '../wish/WishVehicleCards.jsx';

import { CleverQuoteBreakdown } from '../cleverQuote/CleverQuoteBadge.jsx';

import { buildCompactSearchChips } from '../../logic/northStarPresentation.js';

import { pickDiscoveryAlternatives } from '../../logic/discoveryResultsPresentation.js';

import { hasLocalizedSearch } from '../../logic/oneSearchService.js';

import { getSimilarVehiclesNearby } from '../../services/pricing/dealerOfferPricing.js';

import { matchVehiclesToWish } from '../../services/wish/wishMatchEngine.js';

import { hasCleverQuoteWishes, buildCuratedResultsLine } from '../../services/cleverQuote/cleverQuoteService.js';
import { buildAdvisorDiscoveryResultsLine } from '../../services/cleverQuote/cleverQuoteConstants.js';
import { deriveAdvisorChipIds } from '../../services/sales/advisorRanking.js';
import { buildWishMatchBullets } from '../../services/cleverQuote/cleverQuoteRecommendation.js';

import { RESULT_STATES } from '../../logic/neverEmptyResultsService.js';

import { isAllBrandsExcluded } from '../../logic/brandResultsFilter.js';

import '../search/locationPromptBanner.css';

import './discovery-results.css';



const CURATED_MAX = 3;



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

  onEditSearch,

  refineSlot = null,

  exclusionHint = null,

  noExactMatchMessage = null,

  modelLineGroups = null,

}) {

  const [cleverQuoteOpen, setCleverQuoteOpen] = useState(false);

  const [cleverQuoteMatch, setCleverQuoteMatch] = useState(null);

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [overflowOpen, setOverflowOpen] = useState(false);



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



  const paymentMode = filters?.payment ?? 'leasing';

  const handleChangePaymentMode = (mode) => {
    onPatchFilters?.({ payment: mode });
  };



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

  const isAdvisorResults = Boolean(topMatch?.cleverQuote?.advisorMode);
  const advisorGroups = (modelLineGroups?.length ? modelLineGroups : null);
  const allRankedMatchesEarly = useMemo(
    () => [topMatch, ...restMatches].filter(Boolean),
    [topMatch, restMatches],
  );

  const curatedLine = isAdvisorResults
    ? buildAdvisorDiscoveryResultsLine(allRankedMatchesEarly.length)
    : buildCuratedResultsLine(offerStats?.total ?? offerStats?.visible ?? 0, CURATED_MAX);

  const popularTitle = localized
    ? 'Beliebte Angebote in Ihrer Nähe'
    : 'Beliebte Angebote – zur Inspiration';

  const secondaryHits = useMemo(
    () => (isAdvisorResults ? restMatches : restMatches.slice(0, CURATED_MAX - 1)),
    [restMatches, isAdvisorResults],
  );

  const overflowMatches = useMemo(
    () => (isAdvisorResults ? [] : restMatches.slice(CURATED_MAX - 1)),
    [restMatches, isAdvisorResults],
  );



  const showVehicles = !allBrandsHidden;



  const advisorChipIds = useMemo(
    () => deriveAdvisorChipIds(filters, wishes),
    [filters, wishes],
  );

  const allRankedMatches = allRankedMatchesEarly;

  const wishBullets = useMemo(() => {

    if (!topMatch) return [];

    return buildWishMatchBullets(topMatch, {
      wishes,
      maxReasons: 5,
      allMatches: allRankedMatches,
      chipIds: advisorChipIds,
    });

  }, [topMatch, allRankedMatches, wishes, advisorChipIds]);



  const showCompareAction = (
    (secondaryHits.length >= 2 || dealerCount > 1)
    && state === RESULT_STATES.EXACT
    && Boolean(onCompare)
  );



  function openCleverQuoteBreakdown(match) {

    setCleverQuoteMatch(match ?? topMatch);

    setCleverQuoteOpen(true);

  }



  return (

    <div className="discovery-results north-star-results north-star-results--v26 north-star-results--booking north-star-results--mf2 north-star-results--s36">

      <div className="booking-selection-card booking-selection-card--hub">

        <CompactSearchSummary chips={compactChips} onEditChip={onEditChip} title="Ihre Suche" />



        {showVehicles && offerStats && (

          <p className="disc-curated-line" role="status">{curatedLine}</p>

        )}



        <div className="disc-desktop-only">

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

        </div>



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

      {(exclusionHint || noExactMatchMessage) && (
        <p className="disc-rule-hint" role="status">
          {noExactMatchMessage ?? exclusionHint}
        </p>
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
              <h2 id="disc-hit-title" className="disc-section__label disc-section__label--s36">
                {isFallbackHero
                  ? 'Beste Alternative'
                  : (isAdvisorResults && advisorGroups?.length > 1
                    ? 'Ihre Kia-Empfehlungen'
                    : 'Bester Treffer')}
              </h2>

              {isAdvisorResults && advisorGroups?.length > 0 ? (
                <div className="disc-model-line-list">
                  {advisorGroups.map((group) => (
                    <DiscoveryModelLineCard
                      key={group.modelLineKey}
                      group={group}
                      rank={group.rank}
                      paymentMode={paymentMode}
                      wishes={wishes}
                      chipIds={advisorChipIds}
                      allMatches={allRankedMatches}
                      onViewOffer={onViewOffer}
                      onCleverQuoteWhy={openCleverQuoteBreakdown}
                      onChangePaymentMode={handleChangePaymentMode}
                      heroBadge={heroBadge}
                      whyTitle={
                        group.primaryMatch?.cleverQuote?.advisorMode
                          ? `Warum empfehlen wir den ${group.label}?`
                          : undefined
                      }
                      recommendReasons={
                        group.rank === 1 ? wishBullets : undefined
                      }
                      defaultVariantsOpen={group.rank <= 2}
                    />
                  ))}
                </div>
              ) : (
                <>
              {topMatch && (
                <DiscoveryHeroCard
                  match={topMatch}
                  paymentMode={paymentMode}
                  onChangePaymentMode={handleChangePaymentMode}
                  onViewOffer={onViewOffer}
                  onCleverQuoteWhy={() => openCleverQuoteBreakdown(topMatch)}
                  onUnderstandEquipment={() => openCleverQuoteBreakdown(topMatch)}
                  recommendReasons={wishBullets}
                  whyTitle={
                    topMatch?.cleverQuote?.advisorMode
                      ? `Warum empfehlen wir den ${topMatch.model ?? topMatch.vehicle?.model}?`
                      : undefined
                  }
                  heroBadge={heroBadge}
                />
              )}



              {secondaryHits.length > 0 && !showAlternativeSection && (

                <div className="disc-curated-list">

                  {secondaryHits.map((match, index) => (

                    <DiscoveryCuratedCard
                      key={match.vehicleId ?? match.slug}
                      match={match}
                      rank={index + 2}
                      paymentMode={paymentMode}
                      wishes={wishes}
                      chipIds={advisorChipIds}
                      allMatches={allRankedMatches}
                      onViewOffer={onViewOffer}
                      onCleverQuoteWhy={openCleverQuoteBreakdown}
                    />

                  ))}

                </div>

              )}

              {secondaryHits.length >= 1 && onCompare && (
                <button
                  type="button"
                  className="disc-alt-compare-cta"
                  onClick={onCompare}
                >
                  Mit Alternativen vergleichen
                </button>
              )}
                </>
              )}

              <CleverQuoteBreakdown

                cleverQuote={(cleverQuoteMatch ?? topMatch)?.cleverQuote}

                open={cleverQuoteOpen}

                onClose={() => {

                  setCleverQuoteOpen(false);

                  setCleverQuoteMatch(null);

                }}

                paymentMode={paymentMode}

              />



              <div className="disc-desktop-only">

              <DiscoveryCompareSection

                dealerCount={dealerCount}

                radiusKm={radiusKm}

                localized={localized}

                onCompare={showCompareAction ? onCompare : undefined}

                onExpandRadius={dealerCount <= 1 ? onExpandRadius : undefined}

              />

              </div>



              {overflowMatches.length > 0 && !showAlternativeSection && (

                <div className="disc-overflow">

                  {!overflowOpen ? (

                    <button

                      type="button"

                      className="disc-overflow__toggle"

                      onClick={() => setOverflowOpen(true)}

                    >

                      Weitere passende Fahrzeuge anzeigen ({overflowMatches.length})

                    </button>

                  ) : (

                    <div className="disc-overflow__grid wish-grid-list__grid">

                      {overflowMatches.map((match) => (

                        <WishVehicleGridCard

                          key={match.vehicleId}

                          match={match}

                          onViewOffer={() => onViewOffer?.(match.vehicle)}

                        />

                      ))}

                    </div>

                  )}

                </div>

              )}

            </section>

          )}



          {showVehicles && showAlternativeSection && stripAlternatives.length > 0 && (

            <DiscoveryAlternativesStrip

              matches={stripAlternatives}

              max={5}

              title="Weitere geprüfte Alternativen"

              subtitle="Ähnliches Budget, Modell oder Antrieb."

            />

          )}



          {showVehicles && state === RESULT_STATES.EXACT && stripAlternatives.length > 0 && !showAlternativeSection && !isAdvisorResults && (

            <DiscoveryAlternativesStrip
              matches={stripAlternatives}
              max={3}
              paymentMode={paymentMode}
              title="Weitere passende Fahrzeuge"
            />

          )}



          <div className="disc-mobile-more">

            {!mobileMoreOpen ? (

              <button

                type="button"

                className="disc-mobile-more__toggle"

                onClick={() => setMobileMoreOpen(true)}

              >

                Mehr: Händler, Inspiration & Standort

              </button>

            ) : (

              <>

                {showVehicles && (

                  <DiscoveryDealerTrust match={topMatch} onMoreFromDealer={onDealerProfile} />

                )}



                {showVehicles && !isAdvisorResults && (
                  <PopularOffersStrip
                    matches={popularMatches}
                    paymentMode={paymentMode}
                    title={popularTitle}
                    subtitle={localized ? 'Gerade oft angesehen.' : 'Aktuell deutschlandweit – mit Standort sehen Sie Händler in Ihrer Nähe.'}
                  />
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

              </>

            )}

          </div>



          <div className="disc-desktop-only">

          {showVehicles && (

            <DiscoveryDealerTrust match={topMatch} onMoreFromDealer={onDealerProfile} />

          )}



          {showVehicles && !isAdvisorResults && (

            <PopularOffersStrip
              matches={popularMatches}
              paymentMode={paymentMode}
              title={popularTitle}
              subtitle={localized ? 'Gerade oft angesehen.' : 'Aktuell deutschlandweit – mit Standort sehen Sie Händler in Ihrer Nähe.'}
            />

          )}

          </div>

        </>

      )}



      {showLocation && !allBrandsHidden && (

        <div className="disc-loc-slot disc-loc-slot--bottom disc-desktop-only">

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

        <div className="north-star-results__refine-slot disc-desktop-only">{refineSlot}</div>

      )}

    </div>

  );

}


