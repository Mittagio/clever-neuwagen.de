import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
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
  const searchInputRef = useRef(null);

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

  const hasExact = searchBundle?.hasExactMatch && searchBundle.exact.modelLineGroups?.length > 0;
  const hasAlternatives = !hasExact && (searchBundle?.alternatives?.length ?? 0) > 0;
  const showEmpty = hasSearch && searchBundle && !hasExact && !hasAlternatives;
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

          {hasSearch && (hasSearchResults || showEmpty) && (
            <p className="dl-search-results__intro" aria-live="polite">
              Wir haben {modelsChecked} Modelle geprüft.
              {hasExact && (
                <>
                  {' '}
                  Diese {Math.min(DEALER_MAX_RECOMMENDATIONS, searchBundle.exact.modelLineGroups.length)}
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

          {hasExact && (
            <DealerSearchResults
              query={submittedQuery}
              searchProfile={searchProfile}
              modelLineGroups={searchBundle.exact.modelLineGroups}
              filters={searchFilters}
              wishes={searchWishes}
              dealerSlug={dealerId}
              city={city}
              source="local"
              onShowAll={handleShowAllResults}
              hideHeader
            />
          )}

          {hasAlternatives && (
            <DealerSearchAlternatives
              query={submittedQuery}
              searchProfile={searchProfile}
              guidanceMessage={searchBundle.guidanceMessage}
              alternatives={searchBundle.alternatives.slice(0, 1)}
              filters={searchFilters}
              wishes={searchWishes}
              dealerSlug={dealerId}
              city={city}
              source="local"
              onShowAll={handleShowAllResults}
            />
          )}

          {showEmpty && (
            <section className="dl-search-results dl-search-results--empty" aria-live="polite">
              <p className="dl-search-results__empty">
                {searchBundle.guidanceMessage ?? (
                  <>Für „{submittedQuery}“ haben wir aktuell keinen passenden Kia im Bestand.</>
                )}
              </p>
              <button type="button" className="btn btn-secondary" onClick={handleShowAllResults}>
                Alle Fahrzeuge anzeigen
              </button>
            </section>
          )}

          {hasSearchResults && (
            <button
              type="button"
              className="btn btn-secondary dl-search-results__all dl-search-results__all--inline"
              onClick={handleShowAllResults}
            >
              Weitere Modelle auf clever-neuwagen.de
            </button>
          )}

          <DealerWhySection
            dealerName={conditions.dealerName}
            contact={contact}
          />
        </div>
      </div>
    </PageShell>
  );
}
