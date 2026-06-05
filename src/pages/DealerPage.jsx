import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerModelWorld from '../components/dealer/DealerModelWorld.jsx';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { useDealerShowcase } from '../services/dealer/useDealerShowcase.js';
import { useAdvisorDiscoverySearch } from '../services/advisor/useAdvisorDiscoverySearch.js';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';
import { filterMarketplaceVehicles } from '../logic/marketplaceService.js';
import { adjustRateForTerm } from '../logic/oneSearchService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';
import { intentToMarketplaceFilters, toAdvisorMarketplaceFilters } from '../services/search/intentToFilters.js';
import { deriveAdvisorChipIds } from '../services/sales/advisorRanking.js';
import { buildSearchProfile } from '../services/search/searchProfile.js';
import { buildDealerWishSearchUrl } from '../services/wish/wishUrlService.js';
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

  const [activeQuery, setActiveQuery] = useState('');

  const {
    modelLineGroups: showcaseGroups,
    loading: showcaseLoading,
    source: showcaseSource,
  } = useDealerShowcase({ dealerSlug: dealerId, limit: 14 });

  const searchFilters = useMemo(() => {
    if (!activeQuery.trim()) return null;
    const intent = parseSearchIntent(activeQuery);
    const filters = {
      ...intentToMarketplaceFilters(intent),
      query: activeQuery,
      city,
      dealer: dealerId,
    };
    return filters;
  }, [activeQuery, city, dealerId]);

  const searchWishes = useMemo(() => {
    if (!searchFilters) return null;
    const w = parseCustomerWish(searchFilters.query, searchFilters.features ?? []);
    if (searchFilters.fuel === 'elektro' && !w.features.includes('elektro')) {
      w.features = [...w.features, 'elektro'];
    }
    if (searchFilters.maxRate) {
      w.budget = { ...w.budget, maxMonthlyRate: searchFilters.maxRate, type: searchFilters.payment || 'leasing' };
    }
    return w;
  }, [searchFilters]);

  const searchChipIds = useMemo(() => {
    if (!searchFilters || !searchWishes) return [];
    return deriveAdvisorChipIds(searchFilters, searchWishes);
  }, [searchFilters, searchWishes]);

  const dealerVehicles = useMemo(() => {
    const pool = getMarketplaceVehiclePool().filter(
      (v) => (v.dealerSlug ?? dealerId) === dealerId,
    );
    const termMonths = searchFilters?.termMonths ?? 48;
    const filtered = searchFilters
      ? filterMarketplaceVehicles(pool, toAdvisorMarketplaceFilters(searchFilters))
      : pool;
    return filtered.map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, termMonths),
    }));
  }, [dealerId, searchFilters]);

  const { discoverySearch, source: searchSource } = useAdvisorDiscoverySearch({
    wishes: searchWishes ?? { features: [], budget: { type: 'leasing' }, rawQuery: '' },
    filters: searchFilters ?? { query: '', city, dealer: dealerId },
    vehicles: dealerVehicles,
    getDisplayRate: (v) => v.displayRate,
    limit: 12,
    chipIds: searchChipIds,
    dealerSlug: dealerId,
    enabled: Boolean(activeQuery.trim()),
  });

  const searchProfile = useMemo(() => {
    if (!activeQuery.trim() || !searchFilters) return null;
    const intent = parseSearchIntent(activeQuery);
    return buildSearchProfile({
      query: activeQuery,
      intent,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      chipIds: searchChipIds,
    });
  }, [activeQuery, searchFilters, searchWishes, searchChipIds]);

  const handleSearch = useCallback((text) => {
    const value = text.trim();
    if (!value) return;
    setActiveQuery(value);
  }, []);

  const handleShowAllResults = useCallback(() => {
    navigate(buildDealerWishSearchUrl(activeQuery, { city, dealerSlug: dealerId }));
  }, [navigate, activeQuery, city, dealerId]);

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
          />

          {activeQuery && discoverySearch.modelLineGroups?.length > 0 && (
            <DealerSearchResults
              query={activeQuery}
              searchProfile={searchProfile}
              modelLineGroups={discoverySearch.modelLineGroups}
              dealerSlug={dealerId}
              city={city}
              source={searchSource}
              onShowAll={handleShowAllResults}
            />
          )}

          {activeQuery && !discoverySearch.modelLineGroups?.length && (
            <section className="dl-search-results dl-search-results--empty" aria-live="polite">
              <h2 className="dl-section__title">Passende Modelle</h2>
              <p className="dl-search-results__empty">
                Für „{activeQuery}“ haben wir aktuell keinen passenden Kia im Bestand.
                Probieren Sie weniger Ausstattungswünsche auf einmal – oder alle Modelle ansehen.
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
