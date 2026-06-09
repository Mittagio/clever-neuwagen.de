import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  buildDealerSearchSummary,
  toggleDealerChipId,
  matchDealerChipsFromFilters,
} from '../services/dealer/dealerWishChips.js';
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

  const [freeText, setFreeText] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState([]);
  const [searchRefinements, setSearchRefinements] = useState({});
  const searchInputRef = useRef(null);

  const hasSearch = Boolean(freeText.trim() || selectedChipIds.length > 0);
  const searchSummary = useMemo(
    () => buildDealerSearchSummary(selectedChipIds, freeText),
    [selectedChipIds, freeText],
  );

  const searchIntent = useMemo(() => {
    if (freeText.trim()) return parseSearchIntent(freeText);
    if (!selectedChipIds.length) return null;
    return parseSearchIntent('');
  }, [freeText, selectedChipIds]);

  const searchFilters = useMemo(() => {
    if (!hasSearch) return null;
    const textFilters = freeText.trim()
      ? intentToMarketplaceFilters(parseSearchIntent(freeText))
      : {};
    const chipFilters = mergeDealerChipFilters(selectedChipIds);
    return mergeDealerSearchFilters(textFilters, chipFilters, {
      ...searchRefinements,
      query: freeText.trim(),
      city,
      dealer: dealerId,
    });
  }, [hasSearch, freeText, selectedChipIds, searchSummary, city, dealerId, searchRefinements]);

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
      query: freeText,
      intent: searchIntent,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      chipIds: [...searchChipIds, ...selectedChipIds],
    });
  }, [freeText, searchIntent, searchFilters, searchWishes, searchChipIds, selectedChipIds]);

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
      query: searchSummary,
      intent: searchIntent,
      profile: searchProfile,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      vehicles: dealerSearchPool,
      chipIds: [...searchChipIds, ...selectedChipIds],
      getDisplayRate: (v) => v.displayRate,
      limit: DEALER_MAX_RECOMMENDATIONS + 3,
    });
  }, [
    hasSearch,
    searchSummary,
    searchIntent,
    searchProfile,
    searchFilters,
    searchWishes,
    dealerSearchPool,
    searchChipIds,
    selectedChipIds,
  ]);

  const handleSearch = useCallback((text) => {
    setFreeText(text.trim());
    setSearchRefinements({});
  }, []);

  const handleChipToggle = useCallback((chipId) => {
    setSelectedChipIds((prev) => toggleDealerChipId(prev, chipId));
    setSearchRefinements({});
  }, []);

  const handlePatchSearchFilters = useCallback((patch) => {
    setSearchRefinements((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!hasSearch || !Object.keys(searchRefinements).length || !searchFilters) return;
    const matched = matchDealerChipsFromFilters(searchFilters);
    setSelectedChipIds((prev) => {
      if (prev.length === matched.length && prev.every((id, i) => id === matched[i])) {
        return prev;
      }
      return matched;
    });
  }, [searchRefinements, searchFilters, hasSearch]);

  const handleEditSearch = useCallback(() => {
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchInputRef.current?.focus();
  }, []);

  const handleShowAllResults = useCallback(() => {
    navigate(buildDealerWishSearchUrl(searchSummary || freeText, { city, dealerSlug: dealerId }));
  }, [navigate, searchSummary, freeText, city, dealerId]);

  const searchConflict = useMemo(() => {
    if (!hasSearch || !searchProfile) return null;
    return detectSearchConflict(searchIntent ?? parseSearchIntent(''))
      ?? detectProfileConflict(searchProfile, { intent: searchIntent, filters: searchFilters });
  }, [hasSearch, searchProfile, searchIntent, searchFilters]);

  const hasExact = searchBundle?.hasExactMatch && searchBundle.exact.modelLineGroups?.length > 0;
  const hasAlternatives = !hasExact && (searchBundle?.alternatives?.length ?? 0) > 0;
  const showEmpty = hasSearch && searchBundle && !hasExact && !hasAlternatives;
  const hasSearchResults = hasExact || hasAlternatives;

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
            onChipToggle={handleChipToggle}
            selectedChipIds={selectedChipIds}
            inputRef={searchInputRef}
            queryValue={freeText}
          />

          {!hasSearch && (
            <DealerModelWorld
              city={city}
              dealerSlug={dealerId}
              onSearch={handleSearch}
            />
          )}

          {searchConflict && (
            <SearchConflictBanner conflict={searchConflict} />
          )}

          {hasSearch && searchFilters && searchWishes && (
            <CustomerSearchHub
              filters={searchFilters}
              wishes={searchWishes}
              onEditSearch={handleEditSearch}
              onPatchFilters={handlePatchSearchFilters}
              sticky={hasSearch}
              refineLabel="Verfeinern"
            />
          )}

          {hasExact && (
            <DealerSearchResults
              query={searchSummary}
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
              query={searchSummary}
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
                  <>Für „{searchSummary}“ haben wir aktuell keinen passenden Kia im Bestand.</>
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

          {hasSearch && (
            <DealerModelWorld
              city={city}
              dealerSlug={dealerId}
              onSearch={handleSearch}
              compact
            />
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
