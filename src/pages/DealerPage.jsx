import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerNeedAnswerCard from '../components/dealer/DealerNeedAnswerCard.jsx';
import { buildRecognizedCustomerWishes, shouldShowNeedAnswer } from '../services/dealer/customerWishRecognition.js';
import { buildNeedSearchAnswer } from '../services/dealer/buildNeedSearchAnswer.js';
import { syncDealerSearchInquiryLead } from '../services/dealer/dealerInquiryLeadService.js';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
import DealerWhySection from '../components/dealer/DealerWhySection.jsx';
import DealerSmartAnswerCard from '../components/dealer/DealerSmartAnswerCard.jsx';
import DealerJourneyProgress from '../components/dealer/DealerJourneyProgress.jsx';
import DealerJourneyResumeBanner from '../components/dealer/DealerJourneyResumeBanner.jsx';
import DealerJourneyCompareCard from '../components/dealer/DealerJourneyCompareCard.jsx';
import DealerBudgetCard from '../components/dealer/DealerBudgetCard.jsx';
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
} from '../services/dealer/vehicleSalesJourney.js';
import {
  recommendTrimForWishes,
  resolveTrimPick,
} from '../services/dealer/trimWishRecommendation.js';
import {
  filterSearchBundleToModels,
  findModelLineGroup,
  resolveJourneyCompareModelGroups,
} from '../services/dealer/smartAnswerJourney.js';
import {
  buildProfileCleverQuote,
  enrichModelLineGroupWithProfileQuote,
} from '../services/cleverQuote/cleverQuoteService.js';
import { useLeads } from '../context/LeadsContext.jsx';
import {
  classifyCustomerQueryIntent,
  getCustomerQueryType,
} from '../services/search/customerQueryIntent.js';
import { detectModelKeyInQuery } from '../services/search/modelAttributeQuestion.js';
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
import { KIA_MODEL_ATTRIBUTES } from '../data/kia/kiaModelAttributes.js';
import {
  mergeDealerChipFilters,
  mergeDealerSearchFilters,
  matchDealerChipIdsFromDraft,
  toggleChipInQueryText,
} from '../services/dealer/dealerWishChips.js';
import { inferWishChipsFromSearch } from '../services/dealer/dealerWishCatalogService.js';
import {
  clearJourneyState,
  loadJourneyState,
  saveJourneyState,
} from '../services/dealer/journeyPersistenceService.js';
import { hydrateStammdatenFromServer } from '../services/admin/stammdatenHydration.js';
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
  const [journeyWasRestored, setJourneyWasRestored] = useState(false);
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);
  const [trimRecommendation, setTrimRecommendation] = useState(null);
  const [vehicleConfiguration, setVehicleConfiguration] = useState(null);
  const [configSummary, setConfigSummary] = useState(null);
  const [purchaseType, setPurchaseType] = useState(null);
  const [purchaseTypeComplete, setPurchaseTypeComplete] = useState(false);
  const [journeyBudget, setJourneyBudget] = useState(null);
  const [budgetComplete, setBudgetComplete] = useState(false);
  const [specialConditions, setSpecialConditions] = useState([]);
  const [specialConditionsComplete, setSpecialConditionsComplete] = useState(false);
  const [offersRevealed, setOffersRevealed] = useState(false);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(null);
  const { leads, addLead, updateLead, addHistory } = useLeads();
  const [inquiryLeadSync, setInquiryLeadSync] = useState(null);
  const searchInputRef = useRef(null);
  const offersSectionRef = useRef(null);
  const configuratorSectionRef = useRef(null);
  const lastInquirySyncKeyRef = useRef(null);

  const buildRecognizedWishesForText = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const intent = parseSearchIntent(trimmed);
    const textFilters = intentToMarketplaceFilters(intent);
    const chipIds = matchDealerChipIdsFromDraft(trimmed, textFilters);
    const mergedFilters = mergeDealerSearchFilters(
      textFilters,
      mergeDealerChipFilters(chipIds),
      { query: trimmed },
    );
    return buildRecognizedCustomerWishes({ intent, filters: mergedFilters });
  }, []);

  const draftRecognizedWishes = useMemo(
    () => buildRecognizedWishesForText(queryDraft),
    [queryDraft, buildRecognizedWishesForText],
  );

  const draftChipIds = useMemo(() => {
    const text = queryDraft.trim();
    if (!text) return [];
    const intent = parseSearchIntent(text);
    const textFilters = intentToMarketplaceFilters(intent);
    return matchDealerChipIdsFromDraft(text, textFilters);
  }, [queryDraft]);

  const hasSearch = Boolean(submittedQuery.trim());
  const submittedChipIds = useMemo(() => {
    const text = submittedQuery.trim();
    if (!text) return [];
    const intent = parseSearchIntent(text);
    const textFilters = intentToMarketplaceFilters(intent);
    return matchDealerChipIdsFromDraft(text, textFilters);
  }, [submittedQuery]);

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

  const recognizedWishes = useMemo(
    () => buildRecognizedWishesForText(submittedQuery),
    [submittedQuery, buildRecognizedWishesForText, searchProfile],
  );

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

  const handleNeedClarify = useCallback((option) => {
    if (!option || option.id === 'fuel_any') return;
    const fragment = option.label;
    if (!fragment || fragment === 'Beides egal') return;
    handleSearch(`${submittedQuery} – bevorzugt ${fragment}`);
  }, [submittedQuery, handleSearch]);

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

  const customerQueryType = useMemo(() => {
    if (!hasSearch || !searchIntent || !searchProfile) return 'search';
    return getCustomerQueryType(submittedQuery, searchIntent, searchProfile);
  }, [hasSearch, submittedQuery, searchIntent, searchProfile]);

  const customerQueryMode = useMemo(() => {
    if (!hasSearch || !searchIntent || !searchProfile) return 'search';
    return classifyCustomerQueryIntent(submittedQuery, searchIntent, searchProfile);
  }, [hasSearch, submittedQuery, searchIntent, searchProfile]);

  const smartAnswer = useMemo(() => {
    if (!hasSearch || customerQueryMode !== 'info') return null;
    return buildDealerSmartAnswer(submittedQuery, dealerSearchPool);
  }, [hasSearch, customerQueryMode, submittedQuery, dealerSearchPool]);

  useEffect(() => {
    hydrateStammdatenFromServer();
  }, []);

  useEffect(() => {
    if (!hasSearch || !searchIntent?.existingLead) {
      setInquiryLeadSync(null);
      lastInquirySyncKeyRef.current = null;
      return;
    }
    const syncKey = `${dealerId}:${submittedQuery}`;
    if (lastInquirySyncKeyRef.current === syncKey) return;
    lastInquirySyncKeyRef.current = syncKey;

    const syncResult = syncDealerSearchInquiryLead({
      leads,
      addLead,
      updateLead,
      addHistory,
      dealerId,
      searchQuery: submittedQuery,
      recognizedWishes,
      searchProfile,
      existingLeadMentioned: true,
    });
    setInquiryLeadSync(syncResult);
  }, [
    hasSearch,
    searchIntent?.existingLead,
    submittedQuery,
    recognizedWishes,
    searchProfile,
    dealerId,
    leads,
    addLead,
    updateLead,
    addHistory,
  ]);

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
    setJourneyBudget(null);
    setBudgetComplete(false);
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
    setOffersRevealed(false);
    setLeadSheetOpen(false);
    setLeadSubmitted(null);
    setInquiryLeadSync(null);
    lastInquirySyncKeyRef.current = null;
    setJourneyWasRestored(false);
    setResumeBannerDismissed(false);
  }, [submittedQuery]);

  useEffect(() => {
    if (!hasSearch || !submittedQuery.trim()) return;
    const saved = loadJourneyState(dealerId, submittedQuery);
    if (!saved?.salesStep) return;
    if (saved.salesStep !== 'recommend') {
      setJourneyWasRestored(true);
      setResumeBannerDismissed(false);
    }
    setSalesStep(saved.salesStep);
    if (saved.selectedModelKey) setSelectedModelKey(saved.selectedModelKey);
    if (saved.wishChipIds) setWishChipIds(saved.wishChipIds);
    if (saved.prefilledWishCount != null) setPrefilledWishCount(saved.prefilledWishCount);
    if (saved.trimRecommendation) setTrimRecommendation(saved.trimRecommendation);
    if (saved.vehicleConfiguration) setVehicleConfiguration(saved.vehicleConfiguration);
    if (saved.configSummary) setConfigSummary(saved.configSummary);
    if (saved.purchaseType) setPurchaseType(saved.purchaseType);
    if (saved.purchaseTypeComplete) setPurchaseTypeComplete(true);
    if (saved.journeyBudget) setJourneyBudget(saved.journeyBudget);
    if (saved.budgetComplete) setBudgetComplete(true);
    if (saved.specialConditions) setSpecialConditions(saved.specialConditions);
    if (saved.specialConditionsComplete) setSpecialConditionsComplete(true);
    if (saved.offersRevealed) setOffersRevealed(true);
  }, [dealerId, hasSearch, submittedQuery]);

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

  const needSearchAnswer = useMemo(() => {
    if (!hasSearch || !shouldShowNeedAnswer(recognizedWishes, {
      existingLeadMentioned: Boolean(searchIntent?.existingLead),
    })) return null;
    const groups = activeSearchBundle?.exact?.modelLineGroups ?? [];
    return buildNeedSearchAnswer({
      recognizedWishes,
      modelLineGroups: groups,
      searchProfile,
      filters: searchFilters,
      wishes: searchWishes,
    });
  }, [
    hasSearch,
    recognizedWishes,
    searchIntent?.existingLead,
    activeSearchBundle,
    searchProfile,
    searchFilters,
    searchWishes,
  ]);

  const isFactOnly = customerQueryMode === 'info' && (
    smartAnswer?.journeyKind === 'fact'
    || smartAnswer?.journeyKind === 'lineup'
    || customerQueryType === 'knowledge'
  );
  const hasExact = activeSearchBundle?.hasExactMatch && activeSearchBundle.exact.modelLineGroups?.length > 0;

  const primaryRecommendGroup = useMemo(() => {
    const exactGroups = activeSearchBundle?.exact?.modelLineGroups ?? [];
    const altGroups = activeSearchBundle?.alternatives?.[0]?.modelLineGroups ?? [];
    const first = exactGroups[0] ?? altGroups[0] ?? null;
    if (!first) return null;
    return searchProfile ? enrichModelLineGroupWithProfileQuote(first, searchProfile) : first;
  }, [activeSearchBundle, searchProfile]);

  const journeyCompareGroups = useMemo(() => {
    if (customerQueryType !== 'compare') return null;

    const compareKeys = vehicleQueryAnalysis?.compare
      ? [vehicleQueryAnalysis.compare.modelKeyA, vehicleQueryAnalysis.compare.modelKeyB]
      : smartAnswer?.compareModelKeys;

    if (compareKeys?.length >= 2 && activeSearchBundle) {
      const groups = compareKeys
        .map((modelKey) => findModelLineGroup(activeSearchBundle, modelKey))
        .filter(Boolean);
      if (groups.length >= 2) {
        return groups.map((group) => (
          searchProfile ? enrichModelLineGroupWithProfileQuote(group, searchProfile) : group
        ));
      }
    }

    const raw = resolveJourneyCompareModelGroups(activeSearchBundle, 2);
    if (raw.length < 2) return null;
    return raw.map((group) => (
      searchProfile ? enrichModelLineGroupWithProfileQuote(group, searchProfile) : group
    ));
  }, [customerQueryType, vehicleQueryAnalysis, smartAnswer, activeSearchBundle, searchProfile]);

  const useSalesJourney = hasSearch
    && customerQueryType === 'purchase'
    && Boolean(primaryRecommendGroup);

  useEffect(() => {
    if (!useSalesJourney || !salesStep || !submittedQuery.trim()) return;
    saveJourneyState(dealerId, {
      submittedQuery,
      salesStep,
      selectedModelKey,
      wishChipIds,
      prefilledWishCount,
      trimRecommendation,
      vehicleConfiguration,
      configSummary,
      purchaseType,
      purchaseTypeComplete,
      journeyBudget,
      budgetComplete,
      specialConditions,
      specialConditionsComplete,
      offersRevealed,
    });
  }, [
    dealerId,
    useSalesJourney,
    salesStep,
    submittedQuery,
    selectedModelKey,
    wishChipIds,
    prefilledWishCount,
    trimRecommendation,
    vehicleConfiguration,
    configSummary,
    purchaseType,
    purchaseTypeComplete,
    journeyBudget,
    budgetComplete,
    specialConditions,
    specialConditionsComplete,
    offersRevealed,
  ]);

  const effectiveSalesStep = useMemo(() => {
    if (!useSalesJourney) return null;
    if (salesStep) return salesStep;
    return 'recommend';
  }, [useSalesJourney, salesStep]);

  const showSmartAnswer = hasSearch && customerQueryMode === 'info' && Boolean(smartAnswer);
  const showStandaloneCompare = customerQueryType === 'compare'
    && Boolean(journeyCompareGroups)
    && !useSalesJourney;
  const showSalesCompare = (useSalesJourney && effectiveSalesStep === 'recommend' && journeyCompareGroups)
    || (showStandaloneCompare && !showSmartAnswer);
  const showSalesRecommend = useSalesJourney && effectiveSalesStep === 'recommend' && primaryRecommendGroup && !showSalesCompare;
  const showSalesUnderstand = useSalesJourney && effectiveSalesStep === 'understand' && selectedModelKey;
  const showSalesTrim = useSalesJourney && effectiveSalesStep === 'trim' && trimRecommendation;
  const showPurchaseType = useSalesJourney && effectiveSalesStep === 'purchase' && Boolean(selectedModelKey);
  const showBudget = useSalesJourney && effectiveSalesStep === 'budget' && purchaseTypeComplete;
  const showSpecialConditions = useSalesJourney && effectiveSalesStep === 'special' && budgetComplete;
  const showJourneySummary = useSalesJourney && effectiveSalesStep === 'summary' && specialConditionsComplete;

  const journeySnapshot = useMemo(
    () => buildDealerJourneySnapshot({
      configSummary,
      purchaseType,
      specialConditions,
      configuration: vehicleConfiguration,
      budget: journeyBudget,
    }),
    [configSummary, purchaseType, specialConditions, vehicleConfiguration, journeyBudget],
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
    && budgetComplete
    && !leadSubmitted;
  const showJourneyLeadSuccess = Boolean(leadSubmitted);
  const showVehicleOffers = hasSearch && customerQueryType === 'search';
  const showLegacySearchResults = showVehicleOffers;

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

  const handleSmartAnswerSelectModel = useCallback((modelKey) => {
    if (modelKey === 'unsure') {
      handleSearch('Elektro – beraten Sie mich');
      return;
    }
    if (customerQueryType === 'purchase' || smartAnswer?.journeyKind === 'lineup') {
      handleViewVehicle(modelKey);
      return;
    }
    const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey;
    handleSearch(`Zeig mir den ${label}`);
  }, [customerQueryType, smartAnswer, handleViewVehicle, handleSearch]);

  useEffect(() => {
    if (customerQueryType !== 'purchase' || !hasSearch) return;
    const modelKey = detectModelKeyInQuery(submittedQuery);
    if (!modelKey || salesStep) return;
    handleViewVehicle(modelKey);
  }, [customerQueryType, hasSearch, submittedQuery, salesStep, handleViewVehicle]);

  const wishFeatures = useMemo(
    () => resolveWishFeaturesFromChips(wishChipIds),
    [wishChipIds],
  );

  const handleToggleWish = useCallback((chipId) => {
    setWishChipIds((prev) => toggleWishChipIds(prev, chipId));
  }, []);

  const handleUnderstandContinue = useCallback((selectedTrimId) => {
    const modelKey = selectedModelKey;
    if (!modelKey) return;
    const rec = recommendTrimForWishes(
      modelKey,
      wishFeatures,
      searchProfile,
      searchFilters,
      wishChipIds,
    );
    const finalRec = {
      ...rec,
      selectedTrimId: selectedTrimId ?? rec.selectedTrimId,
      selectedPick: resolveTrimPick(rec, selectedTrimId),
    };
    setTrimRecommendation(finalRec);
    setConfigSummary(buildConfigSummaryFromTrim(modelKey, finalRec, wishFeatures, wishChipIds));
    setVehicleConfiguration(buildConfigurationFromTrim(modelKey, finalRec));
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
    setPurchaseType(null);
    setPurchaseTypeComplete(false);
    setJourneyBudget(null);
    setBudgetComplete(false);
    setSalesStep('purchase');
    scrollToJourney();
  }, [
    selectedModelKey,
    wishFeatures,
    wishChipIds,
    searchProfile,
    searchFilters,
    scrollToJourney,
  ]);

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
    setJourneyBudget(null);
    setBudgetComplete(false);
    setSalesStep('purchase');
    scrollToJourney();
  }, [selectedModelKey, wishFeatures, wishChipIds, scrollToJourney]);

  const handleTrimBack = useCallback(() => {
    setSalesStep('understand');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleSpecialConditionsContinue = useCallback((nextConditions) => {
    setSpecialConditions(nextConditions);
    setSpecialConditionsComplete(true);
    setSalesStep('summary');
    scrollToJourney();
  }, [scrollToJourney]);

  const handlePurchaseTypeContinue = useCallback((type) => {
    setPurchaseType(type);
    setPurchaseTypeComplete(true);
    setJourneyBudget(null);
    setBudgetComplete(false);
    setSalesStep('budget');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleBudgetContinue = useCallback((budget) => {
    setJourneyBudget(budget);
    setBudgetComplete(true);
    setSalesStep('special');
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
      wantTestDrive: contact.wantTestDrive,
    });
    addLead(lead);
    clearJourneyState(dealerId);
    setLeadSheetOpen(false);
    setLeadSubmitted({
      contactName: contact.name,
      inquiryBrief: lead.inquiryBrief,
      cleverQuotePercent: lead.cleverQuotePercent,
      wantTestDrive: contact.wantTestDrive,
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
            recognizedWishes={draftRecognizedWishes}
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
              onSelectModel={handleSmartAnswerSelectModel}
            />
          )}

          <div ref={configuratorSectionRef} className="dl-sales-journey">
          {useSalesJourney && journeyWasRestored && !resumeBannerDismissed && (
            <DealerJourneyResumeBanner
              salesStep={effectiveSalesStep}
              onDismiss={() => setResumeBannerDismissed(true)}
            />
          )}
          {useSalesJourney && effectiveSalesStep && (
            <DealerJourneyProgress salesStep={effectiveSalesStep} />
          )}
          {(showSalesCompare || showStandaloneCompare) && journeyCompareGroups && (
            <DealerJourneyCompareCard
              groups={journeyCompareGroups}
              dealerId={dealerId}
              searchProfile={searchProfile}
              searchWishes={searchWishes}
              chipIds={activeSearchChipIds}
              onSelectModel={handleViewVehicle}
            />
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
          {showBudget && (
            <DealerBudgetCard
              configSummary={configSummary}
              initialMaxMonthlyRate={journeyBudget?.maxMonthlyRate ?? searchProfile?.maxMonthlyRate ?? null}
              onContinue={handleBudgetContinue}
            />
          )}
          {showJourneySummary && (
            <DealerJourneySummary
              configSummary={configSummary}
              purchaseType={purchaseType}
              specialConditions={specialConditions}
              budget={journeyBudget}
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
              dealerContact={contact}
              inquiryBrief={leadSubmitted.inquiryBrief}
              cleverQuotePercent={leadSubmitted.cleverQuotePercent}
              wantTestDrive={leadSubmitted.wantTestDrive}
            />
          )}
          {showLegacySearchResults && needSearchAnswer && (
            <DealerNeedAnswerCard
              recognizedWishes={recognizedWishes}
              answer={needSearchAnswer}
              inquiryLeadSync={inquiryLeadSync}
              onClarify={handleNeedClarify}
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
