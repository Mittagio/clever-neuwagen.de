import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
import DealerSmartAnswerCard from '../components/dealer/DealerSmartAnswerCard.jsx';
import DealerJourneyProgress from '../components/dealer/DealerJourneyProgress.jsx';
import DealerVehicleRecommendCard from '../components/dealer/DealerVehicleRecommendCard.jsx';
import DealerVehicleUnderstandCard from '../components/dealer/DealerVehicleUnderstandCard.jsx';
import DealerTrimRecommendCard from '../components/dealer/DealerTrimRecommendCard.jsx';
import DealerPurchaseTypeCard from '../components/dealer/DealerPurchaseTypeCard.jsx';
import DealerSpecialConditionsCard from '../components/dealer/DealerSpecialConditionsCard.jsx';
import DealerJourneySummary from '../components/dealer/DealerJourneySummary.jsx';
import DealerJourneyOfferPanel from '../components/dealer/DealerJourneyOfferPanel.jsx';
import DealerJourneyLeadSheet from '../components/dealer/DealerJourneyLeadSheet.jsx';
import DealerJourneyLeadSuccess from '../components/dealer/DealerJourneyLeadSuccess.jsx';
import { buildDealerJourneySnapshot } from '../services/dealer/purchaseTypeOptions.js';
import { buildJourneyOffers } from '../services/dealer/journeyOfferService.js';
import {
  createLeadFromJourney,
  prepareJourneyLeadContext,
} from '../services/dealer/journeyLeadService.js';
import {
  toggleWishChipIds,
  resolveWishFeaturesFromChips,
} from '../data/dealer/dealerWishCatalog.js';
import {
  buildConfigSummaryFromTrim,
  buildConfigurationFromTrim,
  recommendTrimForWishes,
} from '../services/dealer/vehicleSalesJourney.js';
import {
  filterSearchBundleToModels,
  findModelLineGroup,
} from '../services/dealer/smartAnswerJourney.js';
import {
  buildProfileCleverQuote,
  enrichModelLineGroupWithProfileQuote,
} from '../services/cleverQuote/cleverQuoteService.js';
import { useLeads } from '../context/LeadsContext.jsx';
import { classifyCustomerQueryIntent } from '../services/search/customerQueryIntent.js';
import { analyzeVehicleQuery } from '../services/search/vehicleQueryIntent.js';
import { buildDealerSmartAnswer } from '../services/dealer/dealerSmartAnswerService.js';
import { resolveModelConditions } from '../data/dealerConditionsSchema.js';
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
import { inferWishChipsFromSearch } from '../services/dealer/dealerWishCatalogService.js';
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
  const [salesStep, setSalesStep] = useState(null);
  const [selectedModelKey, setSelectedModelKey] = useState(null);
  const [wishChipIds, setWishChipIds] = useState([]);
  const [prefilledWishCount, setPrefilledWishCount] = useState(0);
  const [trimRecommendation, setTrimRecommendation] = useState(null);
  const [vehicleConfiguration, setVehicleConfiguration] = useState(null);
  const [configSummary, setConfigSummary] = useState(null);
  const [purchaseType, setPurchaseType] = useState(null);
  const [purchaseTypeComplete, setPurchaseTypeComplete] = useState(false);
  const [specialConditions, setSpecialConditions] = useState([]);
  const [specialConditionsComplete, setSpecialConditionsComplete] = useState(false);
  const [offersRevealed, setOffersRevealed] = useState(false);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(null);
  const { addLead } = useLeads();
  const searchInputRef = useRef(null);
  const offersSectionRef = useRef(null);
  const configuratorSectionRef = useRef(null);

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
    setSalesStep(null);
    setSelectedModelKey(null);
    setWishChipIds([]);
    setPrefilledWishCount(0);
    setTrimRecommendation(null);
    setVehicleConfiguration(null);
    setConfigSummary(null);
    setPurchaseType(null);
    setPurchaseTypeComplete(false);
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
    setOffersRevealed(false);
    setLeadSheetOpen(false);
    setLeadSubmitted(null);
  }, [submittedQuery]);

  const infoModelKeys = useMemo(() => {
    if (!smartAnswer || customerQueryMode !== 'info') return [];
    if (configSummary?.modelKey) return [configSummary.modelKey];
    if (selectedModelKey) return [selectedModelKey];
    if (smartAnswer.compareModelKeys?.length) return smartAnswer.compareModelKeys;
    if (smartAnswer.primaryModelKey) return [smartAnswer.primaryModelKey];
    return [];
  }, [smartAnswer, customerQueryMode, selectedModelKey, configSummary]);

  const activeSearchBundle = useMemo(() => {
    if (!searchBundle) return null;
    if (customerQueryMode !== 'info' || infoModelKeys.length === 0) return searchBundle;
    return filterSearchBundleToModels(searchBundle, infoModelKeys);
  }, [searchBundle, customerQueryMode, infoModelKeys]);

  const isFactOnly = customerQueryMode === 'info' && smartAnswer?.journeyKind === 'fact';
  const hasExact = activeSearchBundle?.hasExactMatch && activeSearchBundle.exact.modelLineGroups?.length > 0;

  const primaryRecommendGroup = useMemo(() => {
    const exactGroups = activeSearchBundle?.exact?.modelLineGroups ?? [];
    const altGroups = activeSearchBundle?.alternatives?.[0]?.modelLineGroups ?? [];
    const first = exactGroups[0] ?? altGroups[0] ?? null;
    if (!first) return null;
    return searchProfile ? enrichModelLineGroupWithProfileQuote(first, searchProfile) : first;
  }, [activeSearchBundle, searchProfile]);

  const useSalesJourney = hasSearch && Boolean(primaryRecommendGroup) && !isFactOnly;

  const effectiveSalesStep = useMemo(() => {
    if (!useSalesJourney) return null;
    if (salesStep) return salesStep;
    return 'recommend';
  }, [useSalesJourney, salesStep]);

  const showSmartAnswer = hasSearch && customerQueryMode === 'info' && Boolean(smartAnswer)
    && (isFactOnly || !useSalesJourney);
  const showSalesRecommend = useSalesJourney && effectiveSalesStep === 'recommend' && primaryRecommendGroup;
  const showSalesUnderstand = useSalesJourney && effectiveSalesStep === 'understand' && selectedModelKey;
  const showSalesTrim = useSalesJourney && effectiveSalesStep === 'trim' && trimRecommendation;
  const showSpecialConditions = useSalesJourney && effectiveSalesStep === 'special' && Boolean(configSummary);
  const showPurchaseType = useSalesJourney && effectiveSalesStep === 'purchase' && specialConditionsComplete;
  const showJourneySummary = useSalesJourney && effectiveSalesStep === 'summary' && purchaseTypeComplete;

  const journeySnapshot = useMemo(
    () => buildDealerJourneySnapshot({
      configSummary,
      purchaseType,
      specialConditions,
      configuration: vehicleConfiguration,
    }),
    [configSummary, purchaseType, specialConditions, vehicleConfiguration],
  );
  const journeyOfferBundle = useMemo(() => {
    if (!journeySnapshot?.configuration || !specialConditionsComplete) return null;
    return buildJourneyOffers(journeySnapshot, conditions);
  }, [journeySnapshot, conditions, specialConditionsComplete]);

  const journeyCleverQuote = useMemo(() => {
    const modelKey = journeySnapshot?.vehicle?.modelKey ?? configSummary?.modelKey;
    if (!modelKey || !activeSearchBundle) return null;
    const group = findModelLineGroup(activeSearchBundle, modelKey);
    if (!group) return null;
    if (group.modelQuote) return group.modelQuote;
    if (group.primaryMatch?.cleverQuote) return group.primaryMatch.cleverQuote;
    if (searchProfile && group.primaryMatch) {
      return buildProfileCleverQuote(group.primaryMatch, searchProfile, { preserveAdvisorMode: true });
    }
    return null;
  }, [journeySnapshot, configSummary, activeSearchBundle, searchProfile]);

  const showJourneyOffer = useSalesJourney
    && effectiveSalesStep === 'offer'
    && Boolean(configSummary)
    && specialConditionsComplete
    && purchaseTypeComplete
    && !leadSubmitted;
  const showJourneyLeadSuccess = Boolean(leadSubmitted);
  const showVehicleOffers = hasSearch && !useSalesJourney;
  const showLegacySearchResults = showVehicleOffers && !useSalesJourney;

  const handleFollowUpQuery = useCallback((text) => {
    handleSearch(text);
  }, [handleSearch]);

  const scrollToJourney = useCallback(() => {
    requestAnimationFrame(() => {
      configuratorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const activeSearchChipIds = useMemo(
    () => [...searchChipIds, ...submittedChipIds],
    [searchChipIds, submittedChipIds],
  );

  const selectedModelDelivery = useMemo(() => {
    if (!selectedModelKey) return null;
    const resolved = resolveModelConditions(conditions, selectedModelKey);
    return resolved.deliveryTime ?? null;
  }, [conditions, selectedModelKey]);

  const handleViewVehicle = useCallback((modelKey) => {
    const prefilled = inferWishChipsFromSearch(modelKey, {
      searchProfile,
      searchFilters,
      searchChipIds: activeSearchChipIds,
    });
    setSelectedModelKey(modelKey);
    setWishChipIds(prefilled);
    setPrefilledWishCount(prefilled.length);
    setTrimRecommendation(null);
    setConfigSummary(null);
    setVehicleConfiguration(null);
    setSalesStep('understand');
    scrollToJourney();
  }, [searchProfile, searchFilters, activeSearchChipIds, scrollToJourney]);

  const wishFeatures = useMemo(
    () => resolveWishFeaturesFromChips(wishChipIds),
    [wishChipIds],
  );

  const handleToggleWish = useCallback((chipId) => {
    setWishChipIds((prev) => toggleWishChipIds(prev, chipId));
  }, []);

  const handleUnderstandContinue = useCallback(() => {
    const modelKey = selectedModelKey;
    if (!modelKey) return;
    const rec = recommendTrimForWishes(modelKey, wishFeatures, searchProfile, searchFilters);
    setTrimRecommendation(rec);
    setSalesStep('trim');
    scrollToJourney();
  }, [selectedModelKey, wishFeatures, searchProfile, searchFilters, scrollToJourney]);

  const handleTrimConfirm = useCallback((recommendation) => {
    const modelKey = selectedModelKey ?? recommendation?.modelKey;
    if (!modelKey) return;
    setTrimRecommendation(recommendation);
    setConfigSummary(buildConfigSummaryFromTrim(modelKey, recommendation, wishFeatures, wishChipIds));
    setVehicleConfiguration(buildConfigurationFromTrim(modelKey, recommendation));
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
    setPurchaseType(null);
    setPurchaseTypeComplete(false);
    setSalesStep('special');
    scrollToJourney();
  }, [selectedModelKey, wishFeatures, wishChipIds, scrollToJourney]);

  const handleTrimBack = useCallback(() => {
    setSalesStep('understand');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleSpecialConditionsContinue = useCallback((nextConditions) => {
    setSpecialConditions(nextConditions);
    setSpecialConditionsComplete(true);
    setPurchaseType(null);
    setPurchaseTypeComplete(false);
    setSalesStep('purchase');
    scrollToJourney();
  }, [scrollToJourney]);

  const handlePurchaseTypeContinue = useCallback((type) => {
    setPurchaseType(type);
    setPurchaseTypeComplete(true);
    setSalesStep('summary');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleRevealOffers = useCallback(() => {
    setOffersRevealed(true);
    setSalesStep('offer');
    requestAnimationFrame(() => {
      offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleRequestLead = useCallback(() => {
    setLeadSheetOpen(true);
  }, []);

  const handleLeadSheetClose = useCallback(() => {
    setLeadSheetOpen(false);
  }, []);

  const handleLeadSubmit = useCallback((contact) => {
    const { offerBundle } = prepareJourneyLeadContext(journeySnapshot, conditions);
    const lead = createLeadFromJourney({
      contact,
      journeySnapshot,
      offerBundle,
      cleverQuote: journeyCleverQuote,
      searchQuery: submittedQuery,
      dealerConditions: conditions,
      message: contact.message,
    });
    addLead(lead);
    setLeadSheetOpen(false);
    setLeadSubmitted({
      contactName: contact.name,
      inquiryBrief: lead.inquiryBrief,
      cleverQuotePercent: lead.cleverQuotePercent,
    });
    requestAnimationFrame(() => {
      offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [journeySnapshot, conditions, journeyCleverQuote, submittedQuery, addLead]);

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
            />
          )}

          <div ref={configuratorSectionRef} className="dl-sales-journey">
          {useSalesJourney && effectiveSalesStep && (
            <DealerJourneyProgress salesStep={effectiveSalesStep} />
          )}
          {showSalesRecommend && (
            <DealerVehicleRecommendCard
              group={primaryRecommendGroup}
              dealerId={dealerId}
              searchProfile={searchProfile}
              searchFilters={searchFilters}
              searchWishes={searchWishes}
              chipIds={activeSearchChipIds}
              onViewVehicle={handleViewVehicle}
            />
          )}
          {showSalesUnderstand && (
            <DealerVehicleUnderstandCard
              modelKey={selectedModelKey}
              dealerId={dealerId}
              wishChipIds={wishChipIds}
              searchProfile={searchProfile}
              searchFilters={searchFilters}
              searchChipIds={activeSearchChipIds}
              deliveryLabel={selectedModelDelivery}
              prefilledWishCount={prefilledWishCount}
              onToggleWish={handleToggleWish}
              onContinue={handleUnderstandContinue}
            />
          )}
          {showSalesTrim && (
            <DealerTrimRecommendCard
              recommendation={trimRecommendation}
              modelKey={selectedModelKey}
              dealerId={dealerId}
              onConfirm={handleTrimConfirm}
              onBack={handleTrimBack}
            />
          )}
          {showSpecialConditions && (
            <DealerSpecialConditionsCard
              configSummary={configSummary}
              value={specialConditions}
              onContinue={handleSpecialConditionsContinue}
            />
          )}
          {showPurchaseType && (
            <DealerPurchaseTypeCard
              configSummary={configSummary}
              value={purchaseType}
              onContinue={handlePurchaseTypeContinue}
            />
          )}
          {showJourneySummary && (
            <DealerJourneySummary
              configSummary={configSummary}
              purchaseType={purchaseType}
              specialConditions={specialConditions}
              onShowOffers={handleRevealOffers}
            />
          )}
          </div>

          <div ref={offersSectionRef}>
          {showJourneyOffer && (
            <DealerJourneyOfferPanel
              journeySnapshot={journeySnapshot}
              dealerConditions={conditions}
              dealerName={conditions.dealerName}
              onRequestLead={handleRequestLead}
            />
          )}
          {showJourneyLeadSuccess && (
            <DealerJourneyLeadSuccess
              contactName={leadSubmitted.contactName}
              dealerName={conditions.dealerName}
              inquiryBrief={leadSubmitted.inquiryBrief}
              cleverQuotePercent={leadSubmitted.cleverQuotePercent}
            />
          )}
          {showLegacySearchResults && hasSearch && (hasSearchResults || showEmpty) && (
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

          {showLegacySearchResults && hasExact && (
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

          {showLegacySearchResults && hasAlternatives && (
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

          {showLegacySearchResults && showEmpty && (
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

          {showLegacySearchResults && hasSearchResults && (
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

      {leadSheetOpen && (
        <DealerJourneyLeadSheet
          dealerName={conditions.dealerName}
          vehicleTitle={
            journeyOfferBundle?.vehicleTitle
            ?? (configSummary
              ? `${configSummary.modelLabel ?? ''} ${configSummary.trimLabel ?? ''}`.trim()
              : undefined)
          }
          onClose={handleLeadSheetClose}
          onSubmit={handleLeadSubmit}
        />
      )}
    </PageShell>
  );
}
