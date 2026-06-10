import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
import DealerSmartAnswerCard from '../components/dealer/DealerSmartAnswerCard.jsx';
import DealerModelFitCard from '../components/dealer/DealerModelFitCard.jsx';
import {
  buildFitPreviewGroups,
  filterSearchBundleToModels,
} from '../services/dealer/smartAnswerJourney.js';
import { classifyCustomerQueryIntent } from '../services/search/customerQueryIntent.js';
import { analyzeVehicleQuery } from '../services/search/vehicleQueryIntent.js';
import { buildDealerSmartAnswer } from '../services/dealer/dealerSmartAnswerService.js';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';
import { adjustRateForTerm } from '../logic/oneSearchService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../services/search/intentToFilters.js';
import { deriveAdvisorChipIds } from '../services/sales/advisorRanking.js';
import { buildSearchProfile } from '../services/search/searchProfile.js';
import { runAdvisorSearchWithAlternatives } from '../services/search/advisorSearchAlternatives.js';
import SearchConflictBanner from '../components/discovery/SearchConflictBanner.jsx';
import { detectSearchConflict } from '../services/search/searchConflictHint.js';
import { detectProfileConflict } from '../services/search/profileConflictHint.js';
import { buildDealerWishSearchUrl } from '../services/wish/wishUrlService.js';
import { DEALER_MAX_RECOMMENDATIONS } from '../data/dealerLandingContent.js';
import {
  mergeDealerChipFilters,
  mergeDealerSearchFilters,
  matchDealerChipIdsFromQuery,
  toggleChipInQueryText,
} from '../services/dealer/dealerWishChips.js';
import './DealerPage.css';
import './dealer-mobile.css';
import '../components/discovery/discovery-results.css';

export default function DealerPage() {
  const navigate = useNavigate();
  const { slug: routeSlug } = useParams();
  const { dealerId: subdomainDealerId, isSubdomain } = useDealerSubdomain();
  const dealerId = useMemo(
    () => subdomainDealerId || routeSlug || DEFAULT_DEALER_ID,
    [subdomainDealerId, routeSlug],
  );
  const { publishedConditions: conditions } = usePublishedDealerConditions(dealerId);
  const contact = conditions.contact ?? {};
  const city = conditions.city ?? '';

  const [queryDraft, setQueryDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [fitRevealed, setFitRevealed] = useState(false);
  const [offersRevealed, setOffersRevealed] = useState(false);
  const searchInputRef = useRef(null);
  const offersSectionRef = useRef(null);

  const draftChipIds = useMemo(
    () => matchDealerChipIdsFromQuery(queryDraft),
    [queryDraft],
  );

  const hasSearch = Boolean(submittedQuery.trim());
  const submittedChipIds = useMemo(
    () => matchDealerChipIdsFromQuery(submittedQuery),
    [submittedQuery],
  );

  const searchIntent = useMemo(() => {
    if (!submittedQuery.trim()) return null;
    return parseSearchIntent(submittedQuery);
  }, [submittedQuery]);

  const searchFilters = useMemo(() => {
    if (!hasSearch) return null;
    const textFilters = intentToMarketplaceFilters(parseSearchIntent(submittedQuery));
    const chipFilters = mergeDealerChipFilters(submittedChipIds);
    return mergeDealerSearchFilters(textFilters, chipFilters, {
      query: submittedQuery.trim(),
      city,
      dealer: dealerId,
    });
  }, [hasSearch, submittedQuery, submittedChipIds, city, dealerId]);

  const searchWishes = useMemo(() => {
    if (!searchFilters) return null;
    const w = parseCustomerWish(searchFilters.query, searchFilters.features ?? []);
    if (searchFilters.fuel === 'elektro' && !w.features.includes('elektro')) {
      w.features = [...w.features, 'elektro'];
    }
    if (searchFilters.maxRate) {
      w.budget = { ...w.budget, maxMonthlyRate: searchFilters.maxRate, type: searchFilters.payment || 'leasing' };
    }
    if (searchFilters.maxPrice) {
      w.budget = {
        ...w.budget,
        maxPrice: searchFilters.maxPrice,
        ...(searchFilters.payment ? { type: searchFilters.payment } : {}),
      };
    }
    return w;
  }, [searchFilters]);

  const searchChipIds = useMemo(() => {
    if (!searchFilters || !searchWishes) return [];
    return deriveAdvisorChipIds(searchFilters, searchWishes);
  }, [searchFilters, searchWishes]);

  const searchProfile = useMemo(() => {
    if (!searchFilters) return null;
    return buildSearchProfile({
      query: submittedQuery,
      intent: searchIntent,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      chipIds: [...searchChipIds, ...submittedChipIds],
    });
  }, [submittedQuery, searchIntent, searchFilters, searchWishes, searchChipIds, submittedChipIds]);

  const dealerSearchPool = useMemo(() => {
    const pool = getMarketplaceVehiclePool().filter(
      (v) => (v.dealerSlug ?? dealerId) === dealerId,
    );
    const termMonths = searchFilters?.termMonths ?? 48;
    return pool.map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, termMonths),
    }));
  }, [dealerId, searchFilters?.termMonths]);

  const searchBundle = useMemo(() => {
    if (!hasSearch || !searchProfile || !searchFilters) return null;
    return runAdvisorSearchWithAlternatives({
      query: submittedQuery,
      intent: searchIntent,
      profile: searchProfile,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      vehicles: dealerSearchPool,
      chipIds: [...searchChipIds, ...submittedChipIds],
      getDisplayRate: (v) => v.displayRate,
      limit: DEALER_MAX_RECOMMENDATIONS + 3,
    });
  }, [
    hasSearch,
    submittedQuery,
    searchIntent,
    searchProfile,
    searchFilters,
    searchWishes,
    dealerSearchPool,
    searchChipIds,
    submittedChipIds,
  ]);

  const handleSearch = useCallback((text) => {
    const value = text.trim();
    setQueryDraft(value);
    setSubmittedQuery(value);
  }, []);

  const handleQueryChange = useCallback((text) => {
    setQueryDraft(text);
  }, []);

  const handleChipToggle = useCallback((chipId) => {
    setQueryDraft((prev) => toggleChipInQueryText(prev, chipId));
    searchInputRef.current?.focus();
  }, []);

  const handleShowAllResults = useCallback(() => {
    navigate(buildDealerWishSearchUrl(submittedQuery, { city, dealerSlug: dealerId }));
  }, [navigate, submittedQuery, city, dealerId]);

  const searchConflict = useMemo(() => {
    if (!hasSearch || !searchProfile) return null;
    return detectSearchConflict(searchIntent ?? parseSearchIntent(''))
      ?? detectProfileConflict(searchProfile, { intent: searchIntent, filters: searchFilters });
  }, [hasSearch, searchProfile, searchIntent, searchFilters]);

  const vehicleQueryAnalysis = useMemo(() => {
    if (!hasSearch || !searchIntent || !searchProfile) return null;
    return analyzeVehicleQuery(submittedQuery, searchIntent, searchProfile);
  }, [hasSearch, submittedQuery, searchIntent, searchProfile]);

  const customerQueryMode = useMemo(() => {
    if (!vehicleQueryAnalysis) return 'search';
    return classifyCustomerQueryIntent(submittedQuery, searchIntent, searchProfile);
  }, [vehicleQueryAnalysis, submittedQuery, searchIntent, searchProfile]);

  const smartAnswer = useMemo(() => {
    if (!hasSearch || customerQueryMode !== 'info') return null;
    return buildDealerSmartAnswer(submittedQuery, dealerSearchPool);
  }, [hasSearch, customerQueryMode, submittedQuery, dealerSearchPool]);

  useEffect(() => {
    setFitRevealed(false);
    setOffersRevealed(false);
  }, [submittedQuery]);

  const infoModelKeys = useMemo(() => {
    if (!smartAnswer || customerQueryMode !== 'info') return [];
    if (smartAnswer.compareModelKeys?.length) return smartAnswer.compareModelKeys;
    if (smartAnswer.primaryModelKey) return [smartAnswer.primaryModelKey];
    return [];
  }, [smartAnswer, customerQueryMode]);

  const activeSearchBundle = useMemo(() => {
    if (!searchBundle) return null;
    if (customerQueryMode !== 'info' || infoModelKeys.length === 0) return searchBundle;
    return filterSearchBundleToModels(searchBundle, infoModelKeys);
  }, [searchBundle, customerQueryMode, infoModelKeys]);

  const fitGroups = useMemo(() => {
    if (!fitRevealed || !activeSearchBundle || !searchProfile) return [];
    return buildFitPreviewGroups(activeSearchBundle, infoModelKeys, searchProfile, smartAnswer);
  }, [fitRevealed, activeSearchBundle, infoModelKeys, searchProfile, smartAnswer]);

  const showSmartAnswer = hasSearch && customerQueryMode === 'info' && Boolean(smartAnswer);
  const showFitCard = showSmartAnswer && fitRevealed && !offersRevealed && fitGroups.length > 0;
  const showVehicleOffers = hasSearch && (customerQueryMode === 'search' || offersRevealed);

  const handleFollowUpQuery = useCallback((text) => {
    handleSearch(text);
  }, [handleSearch]);

  const handleRevealFit = useCallback(() => {
    setFitRevealed(true);
    requestAnimationFrame(() => {
      offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleRevealOffers = useCallback(() => {
    setOffersRevealed(true);
    requestAnimationFrame(() => {
      offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const hasExact = activeSearchBundle?.hasExactMatch && activeSearchBundle.exact.modelLineGroups?.length > 0;
  const hasAlternatives = !hasExact && (activeSearchBundle?.alternatives?.length ?? 0) > 0;
  const showEmpty = hasSearch && activeSearchBundle && !hasExact && !hasAlternatives;
  const hasSearchResults = hasExact || hasAlternatives;
  const modelsChecked = dealerSearchPool.length;

  return (
    <PageShell className="dealer-shell" hideMarketingHeader={isSubdomain}>
      <div className="dealer-page page dealer-page--mf5 dealer-page--clever">
        <div className="container dealer-layout">
          <DealerSearchHero
            dealerName={conditions.dealerName}
            city={city}
            brand="Kia"
            dealerSlug={dealerId}
            onSearch={handleSearch}
            onQueryChange={handleQueryChange}
            onChipToggle={handleChipToggle}
            selectedChipIds={draftChipIds}
            inputRef={searchInputRef}
            queryValue={queryDraft}
          />

          {searchConflict && (
            <SearchConflictBanner conflict={searchConflict} />
          )}

          {showSmartAnswer && (
            <DealerSmartAnswerCard
              answer={smartAnswer}
              dealerId={dealerId}
              onFollowUpQuery={handleFollowUpQuery}
              onShowFit={handleRevealFit}
              fitRevealed={fitRevealed}
            />
          )}

          <div ref={offersSectionRef}>
          {showFitCard && (
            <DealerModelFitCard
              fitPrompt={smartAnswer.fitPrompt}
              groups={fitGroups}
              smartAnswer={smartAnswer}
              onShowOffers={handleRevealOffers}
            />
          )}
          {showVehicleOffers && hasSearch && (hasSearchResults || showEmpty) && (
            <p className="dl-search-results__intro" aria-live="polite">
              Wir haben {modelsChecked} Modelle geprüft.
              {hasExact && (
                <>
                  {' '}
                  Diese {Math.min(DEALER_MAX_RECOMMENDATIONS, activeSearchBundle.exact.modelLineGroups.length)}
                  {' '}
                  passen am besten zu Ihrer Anfrage.
                </>
              )}
              {hasAlternatives && !hasExact && (
                <>
                  {' '}
                  Exakt passend ist schwierig – wir zeigen die nächstbesten Optionen.
                </>
              )}
            </p>
          )}

          {showVehicleOffers && hasExact && (
            <DealerSearchResults
              query={submittedQuery}
              searchProfile={searchProfile}
              modelLineGroups={activeSearchBundle.exact.modelLineGroups}
              filters={searchFilters}
              wishes={searchWishes}
              dealerSlug={dealerId}
              city={city}
              source="local"
              onShowAll={handleShowAllResults}
              hideHeader
            />
          )}

          {showVehicleOffers && hasAlternatives && (
            <DealerSearchAlternatives
              query={submittedQuery}
              searchProfile={searchProfile}
              guidanceMessage={activeSearchBundle.guidanceMessage}
              alternatives={activeSearchBundle.alternatives.slice(0, 1)}
              filters={searchFilters}
              wishes={searchWishes}
              dealerSlug={dealerId}
              city={city}
              source="local"
              onShowAll={handleShowAllResults}
            />
          )}

          {showVehicleOffers && showEmpty && (
            <section className="dl-search-results dl-search-results--empty" aria-live="polite">
              <p className="dl-search-results__empty">
                {activeSearchBundle.guidanceMessage ?? (
                  <>Für „{submittedQuery}“ haben wir aktuell keinen passenden Kia im Bestand.</>
                )}
              </p>
              <button type="button" className="btn btn-secondary" onClick={handleShowAllResults}>
                Alle Fahrzeuge anzeigen
              </button>
            </section>
          )}

          {showVehicleOffers && hasSearchResults && (
            <button
              type="button"
              className="btn btn-secondary dl-search-results__all dl-search-results__all--inline"
              onClick={handleShowAllResults}
            >
              Weitere Modelle auf clever-neuwagen.de
            </button>
          )}
          </div>

          <DealerWhySection
            dealerName={conditions.dealerName}
            contact={contact}
          />
        </div>
      </div>
    </PageShell>
  );
}
