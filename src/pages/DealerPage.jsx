import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerModelWorld from '../components/dealer/DealerModelWorld.jsx';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
import CustomerSearchHub from '../components/search/CustomerSearchHub.jsx';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { useDealerShowcase } from '../services/dealer/useDealerShowcase.js';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';
import { adjustRateForTerm } from '../logic/oneSearchService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../services/search/intentToFilters.js';
import { deriveAdvisorChipIds } from '../services/sales/advisorRanking.js';
import { buildSearchProfile } from '../services/search/searchProfile.js';
import { runAdvisorSearchWithAlternatives } from '../services/search/advisorSearchAlternatives.js';
import { buildDealerWishSearchUrl } from '../services/wish/wishUrlService.js';
import './DealerPage.css';
import './dealer-mobile.css';
import '../components/discovery/discovery-results.css';
import '../components/search/CustomerSearchHub.css';

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

  const [activeQuery, setActiveQuery] = useState('');
  const [searchRefinements, setSearchRefinements] = useState({});
  const searchInputRef = useRef(null);

  const {
    modelLineGroups: showcaseGroups,
    loading: showcaseLoading,
    source: showcaseSource,
  } = useDealerShowcase({ dealerSlug: dealerId, limit: 14 });

  const searchIntent = useMemo(
    () => (activeQuery.trim() ? parseSearchIntent(activeQuery) : null),
    [activeQuery],
  );

  const searchFilters = useMemo(() => {
    if (!searchIntent) return null;
    return {
      ...intentToMarketplaceFilters(searchIntent),
      ...searchRefinements,
      query: activeQuery,
      city,
      dealer: dealerId,
    };
  }, [searchIntent, activeQuery, city, dealerId, searchRefinements]);

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
    if (!searchIntent || !searchFilters) return null;
    return buildSearchProfile({
      query: activeQuery,
      intent: searchIntent,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      chipIds: searchChipIds,
    });
  }, [activeQuery, searchIntent, searchFilters, searchWishes, searchChipIds]);

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
    if (!activeQuery.trim() || !searchProfile || !searchFilters) return null;
    return runAdvisorSearchWithAlternatives({
      query: activeQuery,
      intent: searchIntent,
      profile: searchProfile,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      vehicles: dealerSearchPool,
      chipIds: searchChipIds,
      getDisplayRate: (v) => v.displayRate,
      limit: 12,
    });
  }, [
    activeQuery,
    searchIntent,
    searchProfile,
    searchFilters,
    searchWishes,
    dealerSearchPool,
    searchChipIds,
  ]);

  const handleSearch = useCallback((text) => {
    const value = text.trim();
    if (!value) return;
    setSearchRefinements({});
    setActiveQuery(value);
  }, []);

  const handlePatchSearchFilters = useCallback((patch) => {
    setSearchRefinements((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleEditSearch = useCallback(() => {
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchInputRef.current?.focus();
  }, []);

  const handleShowAllResults = useCallback(() => {
    navigate(buildDealerWishSearchUrl(activeQuery, { city, dealerSlug: dealerId }));
  }, [navigate, activeQuery, city, dealerId]);

  const hasExact = searchBundle?.hasExactMatch && searchBundle.exact.modelLineGroups?.length > 0;
  const hasAlternatives = !hasExact && (searchBundle?.alternatives?.length ?? 0) > 0;
  const showEmpty = activeQuery && searchBundle && !hasExact && !hasAlternatives;

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
            inputRef={searchInputRef}
            queryValue={activeQuery}
          />

          {activeQuery.trim() && searchFilters && searchWishes && (
            <CustomerSearchHub
              filters={searchFilters}
              wishes={searchWishes}
              onEditSearch={handleEditSearch}
              onPatchFilters={handlePatchSearchFilters}
            />
          )}

          {hasExact && (
            <DealerSearchResults
              query={activeQuery}
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
              query={activeQuery}
              searchProfile={searchProfile}
              guidanceMessage={searchBundle.guidanceMessage}
              alternatives={searchBundle.alternatives}
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
              <h2 className="dl-section__title">Passende Modelle</h2>
              <p className="dl-search-results__empty">
                {searchBundle.guidanceMessage ?? (
                  <>Für „{activeQuery}“ haben wir aktuell keinen passenden Kia im Bestand.</>
                )}
              </p>
              <button type="button" className="btn btn-secondary" onClick={handleShowAllResults}>
                Alle Fahrzeuge anzeigen
              </button>
            </section>
          )}

          <DealerModelWorld
            city={city}
            dealerSlug={dealerId}
            modelLineGroups={showcaseGroups}
            loading={showcaseLoading}
            source={showcaseSource}
          />

          <DealerWhySection
            dealerName={conditions.dealerName}
            contact={contact}
          />
        </div>
      </div>
    </PageShell>
  );
}
