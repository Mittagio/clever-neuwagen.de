import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import DealerPortalTopbar from '../components/dealer/DealerPortalTopbar.jsx';
import DealerModelWorld from '../components/dealer/DealerModelWorld.jsx';
import CleverConversationExperience from '../components/conversation/CleverConversationExperience.jsx';
import '../components/conversation/clever-conversation.css';
import DealerNeedAnswerCard from '../components/dealer/DealerNeedAnswerCard.jsx';
import DealerJourneyMobileFooter from '../components/dealer/DealerJourneyMobileFooter.jsx';
import { buildRecognizedCustomerWishes, shouldShowNeedAnswer } from '../services/dealer/customerWishRecognition.js';
import { buildNeedSearchAnswer } from '../services/dealer/buildNeedSearchAnswer.js';
import { syncDealerSearchInquiryLead } from '../services/dealer/dealerInquiryLeadService.js';
import { scoreTrimWithPackages } from '../services/dealer/trimEquipmentPresentation.js';
import DealerSearchResults from '../components/dealer/DealerSearchResults.jsx';
import DealerSearchAlternatives from '../components/dealer/DealerSearchAlternatives.jsx';
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
import CleverConsultationWizard from '../components/dealer/CleverConsultationWizard.jsx';
import CleverRecommendationCard from '../components/dealer/CleverRecommendationCard.jsx';
import CleverSalesIntentBridge from '../components/dealer/CleverSalesIntentBridge.jsx';
import SellerHandoffPanel from '../components/dealer/SellerHandoffPanel.jsx';
import '../components/dealer/clever-consultation.css';
import { buildDealerJourneySnapshot } from '../services/dealer/purchaseTypeOptions.js';
import { inferKnownPurchaseType } from '../services/dealer/inferPurchaseTypeFromSearch.js';
import { detectModelKeyInQuery } from '../services/search/modelAttributeQuestion.js';
import { resolvePowertrainOptionsForModel } from '../services/dealer/modelPowertrainFamily.js';
import { getEquipmentStepCta } from '../services/dealer/equipmentStepPresentation.js';
import { buildCustomerModelCtaLabel } from '../services/dealer/customerSearchResultPresentation.js';
import { mapPurchaseDetailsToBudget, getPaymentStepCta } from '../services/dealer/purchaseTypeFormOptions.js';
import { buildJourneyOffers } from '../services/dealer/journeyOfferService.js';
import {
  createLeadFromJourney,
  prepareJourneyLeadContext,
} from '../services/dealer/journeyLeadService.js';
import { createLeadFromCustomerAdvisor } from '../services/dealer/customerAdvisorLeadService.js';
import { createLeadFromSpecialQuestion } from '../services/dealer/specialCustomerQuestionLeadService.js';
import { createLeadFromAdvisorConversation } from '../services/dealer/advisorConversationLeadService.js';
import { notifyCustomerInquirySubmitted } from '../services/mail/mailInquiryNotify.js';
import { createAdvisorContactInboxItem } from '../services/dealer/advisorInboxService.js';
import {
  appendAdvisorExchange,
  appendFollowUpClick,
  createCustomerAdvisorSession,
  sessionToApiContext,
} from '../services/clever/customerAdvisorSession.js';
import { fetchCustomerQuery } from '../services/customer/customerQueryApi.js';
import { UI_COMPONENTS } from '../services/clever/customerQueryTypes.js';
import {
  createLearningRequest,
  LEARNING_SOURCE_AREAS,
} from '../services/admin/cleverLearningRequestService.js';
import SpecialQuestionContactCard from '../components/vehicle-detail/SpecialQuestionContactCard.jsx';
import { chipToFeatureIds, getEquipmentWishChip } from '../data/features/equipmentWishChips.js';
import { findDealerWishChip, toggleWishChipIds } from '../data/dealer/dealerWishCatalog.js';
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
import { useCleverInboxOptional } from '../context/CleverInboxContext.jsx';
import {
  classifyCustomerQueryIntent,
  getCustomerQueryType,
} from '../services/search/customerQueryIntent.js';
import { analyzeCustomerQueryType } from '../services/search/customerQueryType.js';
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
import { KIA_MODEL_WORLD } from '../data/dealerLandingContent.js';

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
import {
  buildCleverRecommendation,
  buildConsultationHandoffSummary,
  createConsultationLeadExtras,
  createConsultationProfile,
} from '../services/dealer/cleverSalesAdvisor.js';
import {
  analyzeCleverSalesIntent,
  attachSalesIntentToProfile,
  CLEVER_SALES_MODES,
  enrichSmartAnswerWithSalesIntent,
  prefillConsultationFromSalesIntent,
  SALES_INTENT_THRESHOLDS,
} from '../services/dealer/cleverSalesIntent.js';
import {
  resolveLeadSourceMode,
  SOURCE_MODES,
} from '../services/dealer/dealerSourceMode.js';
import { hydrateStammdatenFromServer } from '../services/admin/stammdatenHydration.js';
import './DealerPage.css';
import './dealer-mobile.css';
import '../components/discovery/discovery-results.css';

function resolveJourneyWishFeatures(chipIds = []) {
  const features = new Set();
  for (const chipId of chipIds) {
    if (getEquipmentWishChip(chipId)) {
      chipToFeatureIds(chipId).forEach((featureId) => features.add(featureId));
      continue;
    }
    const dealerChip = findDealerWishChip(chipId);
    if (dealerChip?.features?.length) {
      dealerChip.features.forEach((featureId) => features.add(featureId));
    }
  }
  return [...features];
}

export default function DealerPage() {
  const navigate = useNavigate();
  const { slug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const { dealerId: subdomainDealerId } = useDealerSubdomain();
  const dealerId = useMemo(
    () => subdomainDealerId || routeSlug || DEFAULT_DEALER_ID,
    [subdomainDealerId, routeSlug],
  );
  const { publishedConditions: conditions } = usePublishedDealerConditions(dealerId);
  const contact = conditions.contact ?? {};
  const city = conditions.city ?? '';

  const [queryDraft, setQueryDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [cleverChatActive, setCleverChatActive] = useState(false);
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
  const [purchaseTypeDraft, setPurchaseTypeDraft] = useState(null);
  const [purchaseTypeComplete, setPurchaseTypeComplete] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState(null);
  const [journeyBudget, setJourneyBudget] = useState(null);
  const [budgetComplete, setBudgetComplete] = useState(false);
  const [specialConditions, setSpecialConditions] = useState([]);
  const [specialConditionsComplete, setSpecialConditionsComplete] = useState(false);
  const [offersRevealed, setOffersRevealed] = useState(false);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(null);
  const { leads, addLead, updateLead, addHistory } = useLeads();
  const cleverInbox = useCleverInboxOptional();
  const [inquiryLeadSync, setInquiryLeadSync] = useState(null);

  const registerCustomerInquiryLead = useCallback((lead) => {
    addLead(lead);
    void notifyCustomerInquirySubmitted(lead, {
      dealerName: conditions.dealerName,
      dealerPhone: contact.phone ?? conditions.phone,
      dealerEmail: contact.email ?? conditions.email,
      contactName: contact.name,
    });
    return lead;
  }, [
    addLead,
    conditions.dealerName,
    conditions.email,
    conditions.phone,
    contact.email,
    contact.name,
    contact.phone,
  ]);
  const [activeRecommendPick, setActiveRecommendPick] = useState(null);
  const [liveUnderstandTrim, setLiveUnderstandTrim] = useState(null);
  const [equipmentSearchWishes, setEquipmentSearchWishes] = useState([]);
  const [customerAdvisorWish, setCustomerAdvisorWish] = useState(null);
  const [leadSheetMode, setLeadSheetMode] = useState('journey');
  const [entryMode, setEntryMode] = useState(null);
  const [consultationProfile, setConsultationProfile] = useState(null);
  const [cleverRecommendation, setCleverRecommendation] = useState(null);
  const [consultationHandoff, setConsultationHandoff] = useState(null);
  const [hybridQueryResult, setHybridQueryResult] = useState(null);
  const [hybridQueryLoading, setHybridQueryLoading] = useState(false);
  const [hybridSpecialSubmitted, setHybridSpecialSubmitted] = useState(false);
  const [hybridSpecialSubmitting, setHybridSpecialSubmitting] = useState(false);
  const [adviceContactOpen, setAdviceContactOpen] = useState(false);
  const [advisorContactIntent, setAdvisorContactIntent] = useState(null);
  const advisorSessionRef = useRef(null);
  const [customerAdvisorSession, setCustomerAdvisorSession] = useState(null);
  const searchInputRef = useRef(null);
  const searchResultsRef = useRef(null);
  const offersSectionRef = useRef(null);
  const configuratorSectionRef = useRef(null);
  const lastInquirySyncKeyRef = useRef(null);
  const skipQueryResetRef = useRef(false);

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
  const showReception = !hasSearch;
  const showInspirationModels = showReception && !cleverChatActive;

  const handleCleverChatActiveChange = useCallback((active) => {
    const next = Boolean(active);
    setCleverChatActive(next);
    document.body.classList.toggle('clever-chat-active', next);
  }, []);

  useEffect(() => () => {
    document.body.classList.remove('clever-chat-active');
  }, []);

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

  const activeSearchChipIds = useMemo(
    () => [...searchChipIds, ...submittedChipIds],
    [searchChipIds, submittedChipIds],
  );

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

  const handleCleverSearch = useCallback((text) => {
    const value = text.trim();
    if (!value) return;
    skipQueryResetRef.current = true;

    const intent = parseSearchIntent(value);
    const draftProfile = buildSearchProfile({
      query: value,
      intent,
      filters: intentToMarketplaceFilters(intent),
      wishes: {},
      chipIds: [],
    });
    const vehicleAnalysis = analyzeVehicleQuery(value, intent, draftProfile);
    const queryType = analyzeCustomerQueryType(value, intent, draftProfile);
    const salesIntent = analyzeCleverSalesIntent({
      query: value,
      intent,
      profile: draftProfile,
      vehicleAnalysis,
      customerQueryType: queryType,
    });

    setQueryDraft(value);
    setSubmittedQuery(value);
    setCleverRecommendation(null);
    setConsultationHandoff(null);
    setSelectedModelKey(null);
    setTrimRecommendation(null);
    setVehicleConfiguration(null);
    setConfigSummary(null);
    setPurchaseType(null);
    setPurchaseTypeComplete(false);
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
    setOffersRevealed(false);
    setLeadSubmitted(null);

    if (salesIntent.mode === CLEVER_SALES_MODES.KNOWLEDGE) {
      setEntryMode(null);
      setConsultationProfile(null);
      setSalesStep(null);
      return;
    }

    setEntryMode('clever');
    let profile = createConsultationProfile(value);
    profile = attachSalesIntentToProfile(profile, salesIntent);
    profile = prefillConsultationFromSalesIntent(profile, salesIntent);
    setConsultationProfile(profile);
    setSalesStep('consult');
  }, []);

  useEffect(() => {
    if (!submittedQuery.trim()) return;
    requestAnimationFrame(() => {
      const scrollTarget = configuratorSectionRef.current?.querySelector('.dl-need-answer, .dl-advisor-hero')
        ?? searchResultsRef.current?.querySelector('.dl-advisor-hero, .dl-search-results');
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [submittedQuery]);

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

  const scrollToJourney = useCallback(() => {
    requestAnimationFrame(() => {
      configuratorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

  const salesIntentResult = useMemo(() => {
    if (!hasSearch) return null;
    return analyzeCleverSalesIntent({
      query: submittedQuery,
      intent: searchIntent,
      profile: searchProfile,
      vehicleAnalysis: vehicleQueryAnalysis,
      customerQueryType,
    });
  }, [hasSearch, submittedQuery, searchIntent, searchProfile, vehicleQueryAnalysis, customerQueryType]);

  const smartAnswer = useMemo(() => {
    if (!hasSearch || customerQueryMode !== 'info') return null;
    const base = buildDealerSmartAnswer(submittedQuery, dealerSearchPool);
    if (!base || !salesIntentResult) return base;
    return enrichSmartAnswerWithSalesIntent(base, salesIntentResult);
  }, [hasSearch, customerQueryMode, submittedQuery, dealerSearchPool, salesIntentResult]);

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
    if (skipQueryResetRef.current) {
      skipQueryResetRef.current = false;
      return;
    }
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
    setActiveRecommendPick(null);
    setLiveUnderstandTrim(null);
    setJourneyWasRestored(false);
    setResumeBannerDismissed(false);
    setConsultationProfile(null);
    setCleverRecommendation(null);
    setConsultationHandoff(null);
  }, [submittedQuery]);

  useEffect(() => {
    if (!advisorSessionRef.current) {
      const session = createCustomerAdvisorSession(dealerId);
      advisorSessionRef.current = session;
      setCustomerAdvisorSession(session);
    }
  }, [dealerId]);

  useEffect(() => {
    setHybridSpecialSubmitted(false);
    setAdviceContactOpen(false);
    setAdvisorContactIntent(null);
    if (!submittedQuery.trim()) {
      setHybridQueryResult(null);
      return undefined;
    }

    let cancelled = false;
    setHybridQueryLoading(true);

    const session = advisorSessionRef.current ?? createCustomerAdvisorSession(dealerId);

    fetchCustomerQuery({
      query: submittedQuery.trim(),
      dealerId,
      context: {
        page: 'dealer_landing',
        activeChipIds: submittedChipIds,
        ...sessionToApiContext(session),
      },
    })
      .then((result) => {
        if (!cancelled) {
          setHybridQueryResult(result);
          const updated = appendAdvisorExchange(session, submittedQuery.trim(), result);
          advisorSessionRef.current = updated;
          setCustomerAdvisorSession(updated);
        }
      })
      .catch(() => {
        if (!cancelled) setHybridQueryResult(null);
      })
      .finally(() => {
        if (!cancelled) setHybridQueryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submittedQuery, dealerId, submittedChipIds]);

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

  const isNeedBasedAdvisor = hasSearch
    && shouldShowNeedAnswer(recognizedWishes, {
      existingLeadMentioned: Boolean(searchIntent?.existingLead),
    })
    && hasExact;

  const hasModelFocusedSearch = Boolean(hasSearch && detectModelKeyInQuery(submittedQuery));

  const isCleverEntry = entryMode === 'clever' && hasSearch;
  const isClassicEntry = entryMode === 'classic' && hasSearch;

  const useSalesJourney = isCleverEntry
    || isClassicEntry
    || (hasSearch
      && !isCleverEntry
      && !isClassicEntry
      && (customerQueryType === 'purchase' || isNeedBasedAdvisor || hasModelFocusedSearch)
      && Boolean(primaryRecommendGroup || hasExact));

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
      chipIds: [...searchChipIds, ...submittedChipIds],
      advisorMode: useSalesJourney,
    });
  }, [
    hasSearch,
    recognizedWishes,
    searchIntent?.existingLead,
    activeSearchBundle,
    searchProfile,
    searchFilters,
    searchWishes,
    searchChipIds,
    submittedChipIds,
    useSalesJourney,
  ]);

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
    if (isCleverEntry) return 'consult';
    return 'recommend';
  }, [useSalesJourney, salesStep, isCleverEntry]);

  const hybridSmartAnswer = hybridQueryResult?.smartAnswer ?? null;
  const effectiveSmartAnswer = hybridSmartAnswer ?? smartAnswer;
  const hybridUiComponent = hybridQueryResult?.ui?.component;
  const showHybridFactualAnswer = hasSearch && Boolean(hybridQueryResult?.answer)
    && [
      UI_COMPONENTS.ADVICE_ANSWER,
      UI_COMPONENTS.SMART_ANSWER,
      UI_COMPONENTS.RANKING_ANSWER,
      UI_COMPONENTS.COMPARISON_ANSWER,
    ].includes(hybridUiComponent);
  const showHybridSpecialContact = hasSearch
    && (hybridUiComponent === UI_COMPONENTS.SPECIAL_CONTACT || adviceContactOpen);
  const hybridBlocksNeedAnswer = showHybridFactualAnswer || showHybridSpecialContact;

  const showSmartAnswer = hasSearch && Boolean(effectiveSmartAnswer) && (
    showHybridFactualAnswer
    || (customerQueryMode === 'info' && Boolean(smartAnswer) && !hybridQueryResult)
  );
  const showSalesIntentBridge = hasSearch
    && !isCleverEntry
    && salesIntentResult?.mode === CLEVER_SALES_MODES.KNOWLEDGE
    && salesIntentResult.score >= 28;
  const showStandaloneCompare = customerQueryType === 'compare'
    && Boolean(journeyCompareGroups)
    && !useSalesJourney;
  const showSalesCompare = ((useSalesJourney && effectiveSalesStep === 'recommend' && journeyCompareGroups)
    || (showStandaloneCompare && !showSmartAnswer))
    && !isCleverEntry;
  const showNeedAdvisorRecommend = useSalesJourney
    && isNeedBasedAdvisor
    && effectiveSalesStep === 'recommend'
    && Boolean(needSearchAnswer)
    && !showSalesCompare
    && !isCleverEntry
    && !hybridBlocksNeedAnswer;
  const showSalesRecommend = useSalesJourney
    && effectiveSalesStep === 'recommend'
    && primaryRecommendGroup
    && !showSalesCompare
    && !showNeedAdvisorRecommend
    && !isCleverEntry;
  const knownPurchaseType = useMemo(() => {
    if (purchaseTypeComplete && purchaseType) return purchaseType;
    return inferKnownPurchaseType({
      submittedQuery,
      searchProfile,
      searchFilters,
    });
  }, [purchaseTypeComplete, purchaseType, submittedQuery, searchProfile, searchFilters]);

  const showSalesUnderstand = useSalesJourney && effectiveSalesStep === 'understand' && selectedModelKey;
  const showSalesTrim = useSalesJourney && effectiveSalesStep === 'trim' && trimRecommendation;
  const showCleverConsult = isCleverEntry && effectiveSalesStep === 'consult' && consultationProfile;
  const showCleverRecommendation = isCleverEntry && effectiveSalesStep === 'recommendation' && cleverRecommendation;
  const showSellerHandoff = isCleverEntry && effectiveSalesStep === 'handoff' && consultationHandoff;
  const showPurchaseType = useSalesJourney && effectiveSalesStep === 'purchase' && Boolean(configSummary);
  const showSpecialConditions = useSalesJourney && effectiveSalesStep === 'special' && purchaseTypeComplete;
  const showBudget = false;
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
    && !leadSubmitted;
  const showJourneyLeadSuccess = Boolean(leadSubmitted);
  const showVehicleOffers = hasSearch && customerQueryType === 'search' && !useSalesJourney;
  const showLegacySearchResults = showVehicleOffers && !isCleverEntry && !isClassicEntry;

  useEffect(() => {
    if (!isCleverEntry || salesStep) return;
    setSalesStep('consult');
    setConsultationProfile((prev) => prev ?? createConsultationProfile(submittedQuery));
  }, [isCleverEntry, salesStep, submittedQuery]);

  const handleFollowUpQuery = useCallback((text) => {
    handleSearch(text);
  }, [handleSearch]);

  const handleAdvisorFollowUp = useCallback((suggestion) => {
    if (!suggestion) return;
    const session = advisorSessionRef.current;
    if (session) {
      const updated = appendFollowUpClick(session, suggestion);
      advisorSessionRef.current = updated;
      setCustomerAdvisorSession(updated);
    }
    if (suggestion.type === 'purchase_intent') {
      setAdvisorContactIntent(suggestion);
      setAdviceContactOpen(true);
      return;
    }
    handleSearch(suggestion.query);
  }, [handleSearch]);

  const handleStartConsultationFromIntent = useCallback(() => {
    if (!submittedQuery.trim()) return;
    const intent = searchIntent ?? parseSearchIntent(submittedQuery);
    const profile = searchProfile ?? buildSearchProfile({
      query: submittedQuery,
      intent,
      filters: searchFilters,
      wishes: searchWishes ?? {},
      chipIds: activeSearchChipIds,
    });
    const boostedIntent = analyzeCleverSalesIntent({
      query: submittedQuery,
      intent,
      profile,
      vehicleAnalysis: vehicleQueryAnalysis,
      customerQueryType,
    });
    const salesIntent = {
      ...boostedIntent,
      mode: CLEVER_SALES_MODES.CONSULTATION,
      score: Math.max(boostedIntent.score, SALES_INTENT_THRESHOLDS.consultation),
      modeLabel: 'Beratungsmodus',
      shouldStartConsultation: true,
    };
    skipQueryResetRef.current = true;
    setEntryMode('clever');
    let consultProfile = createConsultationProfile(submittedQuery);
    consultProfile = attachSalesIntentToProfile(consultProfile, salesIntent);
    consultProfile = prefillConsultationFromSalesIntent(consultProfile, salesIntent);
    setConsultationProfile(consultProfile);
    setSalesStep('consult');
    scrollToJourney();
  }, [
    submittedQuery,
    searchIntent,
    searchProfile,
    searchFilters,
    searchWishes,
    activeSearchChipIds,
    vehicleQueryAnalysis,
    customerQueryType,
    scrollToJourney,
  ]);

  const handleClassicConfigure = useCallback((card) => {
    if (!card?.modelKey) return;
    const value = (card.searchQuery ?? `Kia ${card.name}`).trim();
    skipQueryResetRef.current = true;
    setEntryMode('classic');
    setConsultationProfile(null);
    setCleverRecommendation(null);
    setConsultationHandoff(null);
    setQueryDraft(value);
    setSubmittedQuery(value);
    const prefilled = inferWishChipsFromSearch(card.modelKey, {
      searchProfile,
      searchFilters,
      searchChipIds: activeSearchChipIds,
    });
    setSelectedModelKey(card.modelKey);
    setWishChipIds(prefilled);
    setPrefilledWishCount(prefilled.length);
    setTrimRecommendation(null);
    setConfigSummary(null);
    setVehicleConfiguration(null);
    setPurchaseTypeDraft(inferKnownPurchaseType({
      submittedQuery: value,
      searchProfile,
      searchFilters,
    }));
    setSalesStep('understand');
    requestAnimationFrame(() => {
      configuratorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [searchProfile, searchFilters, activeSearchChipIds]);

  useEffect(() => {
    const entry = searchParams.get('entry');
    const q = searchParams.get('q')?.trim();
    const model = searchParams.get('model')?.trim();
    if (!entry) return;

    if (entry === 'clever' && q) {
      handleCleverSearch(q);
      return;
    }
    if (entry === 'classic' && model) {
      const card = KIA_MODEL_WORLD.find((c) => c.modelKey === model);
      if (card) handleClassicConfigure(card);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- einmaliger Deep-Link-Einstieg
  }, []);

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
    setLiveUnderstandTrim(null);
    setEquipmentSearchWishes([]);
    setCustomerAdvisorWish(null);
    setTrimRecommendation(null);
    setConfigSummary(null);
    setVehicleConfiguration(null);
    const inferredPayment = inferKnownPurchaseType({
      submittedQuery,
      searchProfile,
      searchFilters,
    });
    setPurchaseTypeDraft(inferredPayment);
    setPurchaseType(inferredPayment);
    setPurchaseDetails(null);
    setPurchaseTypeComplete(false);
    setSalesStep('understand');
    scrollToJourney();
  }, [searchProfile, searchFilters, activeSearchChipIds, scrollToJourney, submittedQuery]);

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
    if (customerQueryType !== 'purchase' || !hasSearch || isCleverEntry || isClassicEntry) return;
    const modelKey = detectModelKeyInQuery(submittedQuery);
    if (!modelKey || salesStep) return;
    handleViewVehicle(modelKey);
  }, [customerQueryType, hasSearch, submittedQuery, salesStep, handleViewVehicle, isCleverEntry, isClassicEntry]);

  useEffect(() => {
    if (!hasModelFocusedSearch || !hasSearch || isCleverEntry || isClassicEntry) return;
    const modelKey = detectModelKeyInQuery(submittedQuery);
    if (!modelKey || salesStep) return;
    handleViewVehicle(modelKey);
  }, [hasModelFocusedSearch, hasSearch, submittedQuery, salesStep, handleViewVehicle, isCleverEntry, isClassicEntry]);

  const wishFeatures = useMemo(
    () => resolveJourneyWishFeatures(wishChipIds),
    [wishChipIds],
  );

  const applyCleverRecommendation = useCallback((profile) => {
    const rec = buildCleverRecommendation({
      profile,
      searchBundle: activeSearchBundle,
      searchProfile,
      searchFilters,
      searchWishes,
      chipIds: activeSearchChipIds,
    });
    setCleverRecommendation(rec);
    setConsultationHandoff(buildConsultationHandoffSummary(profile, rec));
    if (rec?.modelKey) {
      setSelectedModelKey(rec.modelKey);
      setWishChipIds(rec.wishChipIds ?? []);
      setTrimRecommendation(rec.trimRecommendation ?? null);
      if (rec.trimRecommendation) {
        setConfigSummary(buildConfigSummaryFromTrim(
          rec.modelKey,
          rec.trimRecommendation,
          rec.wishFeatures ?? [],
          rec.wishChipIds ?? [],
        ));
      }
    }
    setSalesStep('recommendation');
    scrollToJourney();
  }, [
    activeSearchBundle,
    searchProfile,
    searchFilters,
    searchWishes,
    activeSearchChipIds,
    scrollToJourney,
  ]);

  const handleConsultationComplete = useCallback((profile) => {
    setConsultationProfile(profile);
    applyCleverRecommendation(profile);
  }, [applyCleverRecommendation]);

  const handleTalkToSeller = useCallback(() => {
    setSalesStep('handoff');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleCleverConfigureClassic = useCallback((rec) => {
    const modelKey = rec?.modelKey ?? cleverRecommendation?.modelKey ?? selectedModelKey;
    if (!modelKey) return;
    setEntryMode('classic');
    if (rec?.trimRecommendation) {
      setTrimRecommendation(rec.trimRecommendation);
      setConfigSummary(buildConfigSummaryFromTrim(
        modelKey,
        rec.trimRecommendation,
        rec.wishFeatures ?? wishFeatures,
        rec.wishChipIds ?? wishChipIds,
      ));
      setVehicleConfiguration(buildConfigurationFromTrim(modelKey, rec.trimRecommendation));
    }
    setSelectedModelKey(modelKey);
    setSalesStep('understand');
    scrollToJourney();
  }, [cleverRecommendation, selectedModelKey, wishFeatures, wishChipIds, scrollToJourney]);

  const handleSelectCleverAlternative = useCallback((trimId) => {
    if (!cleverRecommendation?.trimRecommendation || !cleverRecommendation.modelKey) return;
    const rec = cleverRecommendation.trimRecommendation;
    const pick = resolveTrimPick(rec, trimId);
    const updated = {
      ...cleverRecommendation,
      trimId: pick?.trimId,
      trimLabel: pick?.trimLabel,
      vehicleTitle: `Kia ${cleverRecommendation.modelLabel} ${pick?.trimLabel ?? ''}`.trim(),
      trimRecommendation: { ...rec, selectedTrimId: trimId, selectedPick: pick },
    };
    setCleverRecommendation(updated);
    setConsultationHandoff(buildConsultationHandoffSummary(consultationProfile, updated));
    setTrimRecommendation(updated.trimRecommendation);
    setConfigSummary(buildConfigSummaryFromTrim(
      cleverRecommendation.modelKey,
      updated.trimRecommendation,
      cleverRecommendation.wishFeatures ?? [],
      cleverRecommendation.wishChipIds ?? [],
      trimId,
    ));
  }, [cleverRecommendation, consultationProfile]);

  const powertrainOptions = useMemo(
    () => (selectedModelKey
      ? resolvePowertrainOptionsForModel(activeSearchBundle, selectedModelKey)
      : []),
    [activeSearchBundle, selectedModelKey],
  );

  const handlePowertrainChange = useCallback((nextModelKey) => {
    if (!nextModelKey || nextModelKey === selectedModelKey) return;
    handleViewVehicle(nextModelKey);
  }, [selectedModelKey, handleViewVehicle]);

  const handleToggleWish = useCallback((chipId) => {
    setWishChipIds((prev) => toggleWishChipIds(prev, chipId));
  }, []);

  const handleUnderstandContinue = useCallback((selectedTrimId, selectedPackageIds = []) => {
    const modelKey = selectedModelKey;
    if (!modelKey) return;
    const rec = recommendTrimForWishes(
      modelKey,
      wishFeatures,
      searchProfile,
      searchFilters,
      wishChipIds,
    );
    const pick = resolveTrimPick(rec, selectedTrimId);
    const packageFeatures = selectedPackageIds.length
      ? scoreTrimWithPackages({
        modelKey,
        trimId: pick?.trimId,
        wishFeatureIds: rec.wishFeatureIds,
        wishChipIds,
        packageIds: selectedPackageIds,
      })
      : null;
    const enrichedPick = pick && packageFeatures
      ? { ...pick, cleverQuotePercent: packageFeatures.cleverQuotePercent, wishChipLines: packageFeatures.wishChipLines }
      : pick;
    const finalRec = {
      ...rec,
      selectedTrimId: selectedTrimId ?? rec.selectedTrimId,
      selectedPick: enrichedPick,
    };
    setTrimRecommendation(finalRec);
    setConfigSummary(buildConfigSummaryFromTrim(
      modelKey,
      finalRec,
      wishFeatures,
      wishChipIds,
      selectedTrimId,
      selectedPackageIds,
    ));
    setVehicleConfiguration(buildConfigurationFromTrim(modelKey, finalRec, selectedTrimId, selectedPackageIds));
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
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

  const handleEquipmentJourneyContinue = useCallback(({ trimId, packageIds = [] }) => {
    handleUnderstandContinue(trimId, packageIds);
  }, [handleUnderstandContinue]);

  function handleCustomerWishReserve(payload) {
    setCustomerAdvisorWish(payload);
    if (payload?.possibleTrims?.length) {
      setLiveUnderstandTrim({
        trimId: null,
        trimLabel: payload.possibleTrims.join(' / '),
        packageIds: [],
        recommendationLabel: payload.possibleDirection,
        cleverQuotePercent: null,
        hasEquipmentWishes: true,
      });
    }
  }

  const handleCustomerAdvisorContact = useCallback(() => {
    setLeadSheetMode('customerAdvisor');
    setLeadSheetOpen(true);
  }, []);

  const handleSpecialQuestionSubmit = useCallback(({ contact, specialCustomerQuestion, customerWish }) => {
    const lead = createLeadFromSpecialQuestion({
      contact,
      specialCustomerQuestion,
      customerWish: customerWish ?? customerAdvisorWish,
      dealerConditions: conditions,
      learningRequestId: specialCustomerQuestion?.learningRequestId ?? null,
    });
    registerCustomerInquiryLead(lead);
    setLeadSubmitted({
      contactName: contact.name,
      inquiryBrief: lead.inquiryBrief,
      cleverQuotePercent: null,
      specialQuestion: true,
    });
  }, [registerCustomerInquiryLead, conditions, customerAdvisorWish]);

  const handleHybridSpecialQuestionSubmit = useCallback(async (contact) => {
    const useAdvisorConversation = Boolean(advisorContactIntent)
      || (customerAdvisorSession?.messages?.length ?? 0) > 2;
    const specialCustomerQuestion = hybridQueryResult?.specialCustomerQuestion
      ?? hybridQueryResult?.adviceContact;
    if (!useAdvisorConversation && !specialCustomerQuestion) return;
    setHybridSpecialSubmitting(true);
    const learning = createLearningRequest({
      query: contact.question || submittedQuery,
      modelKey: specialCustomerQuestion?.modelKey ?? customerAdvisorSession?.currentContext?.modelsInFocus?.[0],
      modelLabel: specialCustomerQuestion?.modelLabel,
      sourceArea: LEARNING_SOURCE_AREAS.CUSTOMER_ADVISOR,
      pageContext: 'Händler-Landing',
      dealerId,
      dealerName: conditions.dealerName,
    });
    try {
      if (useAdvisorConversation) {
        const lead = createLeadFromAdvisorConversation({
          contact,
          advisorSession: customerAdvisorSession,
          dealerConditions: conditions,
          intentType: advisorContactIntent?.target ?? 'contact',
          learningRequestId: learning.request?.id ?? null,
        });
        registerCustomerInquiryLead(lead);
        createAdvisorContactInboxItem(lead);
        cleverInbox?.refresh?.();
        setLeadSubmitted({
          contactName: contact.name,
          inquiryBrief: lead.inquiryBrief,
          cleverQuotePercent: null,
          specialQuestion: true,
          advisorConversation: true,
        });
      } else {
        handleSpecialQuestionSubmit({
          contact,
          specialCustomerQuestion: {
            ...specialCustomerQuestion,
            rawText: contact.question || specialCustomerQuestion.rawText,
            learningRequestId: learning.request?.id ?? null,
          },
        });
      }
      setHybridSpecialSubmitted(true);
    } finally {
      setHybridSpecialSubmitting(false);
    }
  }, [
    advisorContactIntent,
    customerAdvisorSession,
    hybridQueryResult,
    submittedQuery,
    dealerId,
    conditions,
    handleSpecialQuestionSubmit,
    registerCustomerInquiryLead,
    cleverInbox,
  ]);

  const handleAdviceAskDealer = useCallback(() => {
    setAdvisorContactIntent({ type: 'purchase_intent', target: 'contact' });
    setAdviceContactOpen(true);
  }, []);

  const handleAdviceLearningRequest = useCallback((answer) => {
    createLearningRequest({
      query: submittedQuery,
      detectedIntent: 'advice_question',
      detectedFeatureId: answer?.adviceTopicId ?? null,
      sourceArea: LEARNING_SOURCE_AREAS.CUSTOMER_ADVISOR,
      pageContext: 'Händler-Landing · Beratung',
      dealerId,
      dealerName: conditions.dealerName,
    });
  }, [submittedQuery, dealerId, conditions.dealerName]);

  const handleAdviceOptionalModels = useCallback((answer) => {
    const featureId = answer?.optionalModelsFeatureId;
    const query = featureId === 'towbar'
      ? 'Elektroauto mit Anhängelast'
      : submittedQuery;
    handleCleverSearch(query);
  }, [submittedQuery, handleCleverSearch]);

  const handleTrimConfirm = useCallback((recommendation) => {
    const modelKey = selectedModelKey ?? recommendation?.modelKey;
    if (!modelKey) return;
    setTrimRecommendation(recommendation);
    setConfigSummary(buildConfigSummaryFromTrim(modelKey, recommendation, wishFeatures, wishChipIds));
    setVehicleConfiguration(buildConfigurationFromTrim(modelKey, recommendation));
    setSpecialConditions([]);
    setSpecialConditionsComplete(false);
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
    setBudgetComplete(true);
    setSalesStep('summary');
    scrollToJourney();
  }, [scrollToJourney]);

  const handlePurchaseTypeContinue = useCallback((type, details = {}) => {
    setPurchaseType(type);
    setPurchaseTypeDraft(type);
    setPurchaseDetails(details);
    setPurchaseTypeComplete(true);
    setJourneyBudget(mapPurchaseDetailsToBudget(type, details));
    setBudgetComplete(true);
    setSalesStep('special');
    scrollToJourney();
  }, [scrollToJourney]);

  const handleBudgetContinue = useCallback((budget) => {
    setJourneyBudget(budget);
    setBudgetComplete(true);
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
    setLeadSheetMode('journey');
  }, []);

  const handleLeadSubmit = useCallback((contact) => {
    if (leadSheetMode === 'customerAdvisor' && customerAdvisorWish) {
      const lead = createLeadFromCustomerAdvisor({
        contact,
        customerWish: customerAdvisorWish,
        dealerConditions: conditions,
        message: contact.message,
        wantTestDrive: contact.wantTestDrive,
      });
      registerCustomerInquiryLead(lead);
      clearJourneyState(dealerId);
      setLeadSheetOpen(false);
      setLeadSheetMode('journey');
      setLeadSubmitted({
        contactName: contact.name,
        inquiryBrief: lead.inquiryBrief,
        cleverQuotePercent: null,
        customerAdvisor: true,
      });
      return;
    }

    const { offerBundle } = prepareJourneyLeadContext(journeySnapshot, conditions);
    const { sourceMode, sourceModelKey } = resolveLeadSourceMode({
      entryMode,
      isClassicEntry,
      isCleverEntry,
      hasSearch,
      modelKey: selectedModelKey,
    });
    const consultationExtras = consultationProfile
      ? createConsultationLeadExtras({
        profile: consultationProfile,
        recommendation: cleverRecommendation,
        handoffSummary: consultationHandoff,
        sourceMode: sourceMode ?? SOURCE_MODES.ADVISOR,
        sourceModelKey,
        entryMode: entryMode ?? 'clever',
      })
      : (sourceMode
        ? {
          sourceMode,
          sourceModelKey,
          entryMode: entryMode ?? (isClassicEntry ? 'classic' : 'clever'),
        }
        : null);
    const lead = createLeadFromJourney({
      contact,
      journeySnapshot,
      offerBundle,
      cleverQuote: journeyCleverQuote,
      searchQuery: submittedQuery,
      dealerConditions: conditions,
      message: contact.message,
      wantTestDrive: contact.wantTestDrive,
      consultationExtras,
    });
    registerCustomerInquiryLead(lead);
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
  }, [
    journeySnapshot,
    conditions,
    journeyCleverQuote,
    submittedQuery,
    registerCustomerInquiryLead,
    dealerId,
    consultationProfile,
    cleverRecommendation,
    consultationHandoff,
    leadSheetMode,
    customerAdvisorWish,
    entryMode,
    isClassicEntry,
    isCleverEntry,
    hasSearch,
    selectedModelKey,
  ]);

  useEffect(() => {
    if (!isNeedBasedAdvisor || salesStep || isCleverEntry || hybridBlocksNeedAnswer) return;
    setSalesStep('recommend');
  }, [isNeedBasedAdvisor, salesStep, isCleverEntry, hybridBlocksNeedAnswer]);

  useEffect(() => {
    if (!needSearchAnswer?.picks?.length) {
      setActiveRecommendPick(null);
      return;
    }
    setActiveRecommendPick((prev) => {
      if (prev && needSearchAnswer.picks.some((pick) => pick.modelKey === prev.modelKey)) {
        return prev;
      }
      return needSearchAnswer.picks[0];
    });
  }, [needSearchAnswer]);

  const submitAdvisorForm = useCallback((formId) => {
    document.getElementById(formId)?.requestSubmit();
  }, []);

  const mobileFooter = useMemo(() => {
    if (!useSalesJourney || !effectiveSalesStep) return null;

    if (effectiveSalesStep === 'consult' && isCleverEntry) {
      return {
        salesStep: effectiveSalesStep,
        title: 'Beratung',
        subtitle: null,
        stepLabel: 'Vorberatung',
        actionLabel: 'Passende Richtung anzeigen',
        onAction: () => handleConsultationComplete(consultationProfile),
      };
    }

    if (effectiveSalesStep === 'recommendation' && cleverRecommendation?.ready) {
      return {
        salesStep: effectiveSalesStep,
        title: cleverRecommendation.vehicleTitle,
        subtitle: null,
        stepLabel: 'Passende Richtung',
        actionLabel: 'Verkäufer soll mich kontaktieren',
        onAction: handleTalkToSeller,
      };
    }

    if (effectiveSalesStep === 'handoff' && consultationHandoff) {
      return {
        salesStep: effectiveSalesStep,
        title: cleverRecommendation?.vehicleTitle ?? 'Anfrage',
        subtitle: null,
        stepLabel: 'Kontakt',
        actionLabel: 'Verkäufer soll mich kontaktieren',
        onAction: handleRequestLead,
      };
    }

    if (effectiveSalesStep === 'recommend' && activeRecommendPick) {
      const shortTitle = activeRecommendPick.shortTitle ?? activeRecommendPick.title;
      return {
        salesStep: effectiveSalesStep,
        title: shortTitle,
        subtitle: 'Clever Einschätzung',
        stepLabel: 'Passende Richtung',
        actionLabel: buildCustomerModelCtaLabel(shortTitle),
        onAction: () => handleViewVehicle(activeRecommendPick.modelKey),
      };
    }

    if (effectiveSalesStep === 'understand') {
      return null;
    }

    if (effectiveSalesStep === 'understand_legacy') {
      const modelLabel = configSummary?.modelLabel
        ?? KIA_MODEL_ATTRIBUTES[selectedModelKey]?.label
        ?? 'Kia';
      const hasWishes = wishChipIds.length > 0 || equipmentSearchWishes.length > 0;
      const equipmentCta = getEquipmentStepCta(knownPurchaseType, hasWishes);
      const trimLabel = liveUnderstandTrim?.trimLabel;
      const canContinue = true;
      const title = trimLabel ? `${modelLabel} ${trimLabel}`.trim() : modelLabel;

      return {
        salesStep: effectiveSalesStep,
        title,
        subtitle: null,
        stepLabel: 'Ausstattung',
        actionLabel: equipmentCta.actionLabel,
        actionHint: null,
        disabled: !canContinue,
        onAction: () => handleUnderstandContinue(
          liveUnderstandTrim?.trimId,
          liveUnderstandTrim?.packageIds ?? [],
        ),
      };
    }

    if (effectiveSalesStep === 'purchase' && configSummary) {
      const activePurchaseType = purchaseTypeDraft ?? purchaseType;
      return {
        salesStep: effectiveSalesStep,
        title: configSummary.trimLabel
          ? `${configSummary.modelLabel} ${configSummary.trimLabel}`.trim()
          : configSummary.modelLabel,
        subtitle: null,
        stepLabel: 'Zahlungsart',
        actionLabel: activePurchaseType ? getPaymentStepCta(activePurchaseType) : 'Weiter',
        disabled: !activePurchaseType,
        onAction: () => submitAdvisorForm('dl-advisor-purchase-form'),
      };
    }

    if (effectiveSalesStep === 'special' && configSummary) {
      return {
        salesStep: effectiveSalesStep,
        title: configSummary.trimLabel
          ? `${configSummary.modelLabel} ${configSummary.trimLabel}`.trim()
          : configSummary.modelLabel,
        subtitle: null,
        stepLabel: 'Nutzung',
        actionLabel: 'Weiter',
        onAction: () => submitAdvisorForm('dl-advisor-special-form'),
      };
    }

    if (effectiveSalesStep === 'summary' && configSummary) {
      return {
        salesStep: effectiveSalesStep,
        title: configSummary.trimLabel
          ? `${configSummary.modelLabel} ${configSummary.trimLabel}`.trim()
          : configSummary.modelLabel,
        subtitle: null,
        stepLabel: 'Zusammenfassung',
        actionLabel: 'Preise anzeigen',
        onAction: handleRevealOffers,
      };
    }

    if (effectiveSalesStep === 'offer' && configSummary) {
      return {
        salesStep: effectiveSalesStep,
        title: configSummary.trimLabel
          ? `${configSummary.modelLabel} ${configSummary.trimLabel}`.trim()
          : configSummary.modelLabel,
        subtitle: null,
        stepLabel: 'Anfrage',
        actionLabel: 'Anfrage senden',
        onAction: handleRequestLead,
      };
    }

    return null;
  }, [
    useSalesJourney,
    effectiveSalesStep,
    isCleverEntry,
    consultationProfile,
    cleverRecommendation,
    consultationHandoff,
    handleConsultationComplete,
    handleTalkToSeller,
    activeRecommendPick,
    liveUnderstandTrim,
    wishChipIds.length,
    equipmentSearchWishes.length,
    configSummary,
    selectedModelKey,
    knownPurchaseType,
    purchaseTypeDraft,
    purchaseType,
    handleViewVehicle,
    handleUnderstandContinue,
    handlePurchaseTypeContinue,
    handleRevealOffers,
    handleRequestLead,
    submitAdvisorForm,
  ]);

  const hasAlternatives = !hasExact && (activeSearchBundle?.alternatives?.length ?? 0) > 0;
  const showEmpty = hasSearch && activeSearchBundle && !hasExact && !hasAlternatives;
  const hasSearchResults = hasExact || hasAlternatives;
  const modelsChecked = dealerSearchPool.length;

  return (
    <PageShell className={`dealer-shell${useSalesJourney ? ' dealer-shell--advisor-flow' : ''}`} hideMarketingHeader>
      <div className={`dealer-page page dealer-page--mf5 dealer-page--clever${useSalesJourney ? ' dealer-page--advisor-flow' : ''}`}>
        <div className="container dealer-layout">
          <DealerPortalTopbar />

          {showReception && (
            <section
              className={`dealer-reception${cleverChatActive ? ' dealer-reception--chat' : ''}`}
              aria-label="Clever"
            >
              <CleverConversationExperience
                embedded
                dealerName={conditions.dealerName}
                dealerId={dealerId}
                dealerConditions={conditions}
                pageContext={{
                  dealerId,
                  pageType: 'dealer_home',
                  brandKey: 'kia',
                  returnUrl: typeof window !== 'undefined' ? window.location.pathname : `/${dealerId}`,
                }}
                onChatActiveChange={handleCleverChatActiveChange}
              />
            </section>
          )}

          {showInspirationModels && (
            <DealerModelWorld
              city={city}
              dealerSlug={dealerId}
              conditions={conditions}
              onConfigureModel={handleClassicConfigure}
              variant="inspiration"
            />
          )}

          {searchConflict && (
            <SearchConflictBanner conflict={searchConflict} />
          )}

          {hybridQueryLoading && hasSearch && (
            <p className="dl-hybrid-query-loading" role="status">Clever prüft Ihre Frage …</p>
          )}

          {showHybridSpecialContact && (
            <SpecialQuestionContactCard
              questionText={hybridQueryResult?.specialCustomerQuestion?.rawText
                ?? hybridQueryResult?.adviceContact?.rawText
                ?? submittedQuery}
              onSubmit={handleHybridSpecialQuestionSubmit}
              onDismiss={() => {
                setAdviceContactOpen(false);
                setAdvisorContactIntent(null);
                if (hybridUiComponent === UI_COMPONENTS.SPECIAL_CONTACT) {
                  setHybridQueryResult(null);
                }
              }}
              submitting={hybridSpecialSubmitting}
              submitted={hybridSpecialSubmitted}
            />
          )}

          {showSmartAnswer && (
            <DealerSmartAnswerCard
              answer={effectiveSmartAnswer}
              dealerId={dealerId}
              onFollowUpQuery={handleFollowUpQuery}
              onFollowUpSuggestion={handleAdvisorFollowUp}
              onSelectModel={handleSmartAnswerSelectModel}
              onStartConsultation={handleStartConsultationFromIntent}
              onAskDealer={handleAdviceAskDealer}
              onLearningRequest={handleAdviceLearningRequest}
              onOptionalModelsSearch={handleAdviceOptionalModels}
            />
          )}

          {showSalesIntentBridge && (
            <CleverSalesIntentBridge
              salesIntent={salesIntentResult}
              onStartConsultation={handleStartConsultationFromIntent}
            />
          )}

          <div ref={configuratorSectionRef} className={`dl-sales-journey${useSalesJourney ? ' dl-sales-journey--advisor' : ''}`}>
          {useSalesJourney && journeyWasRestored && !resumeBannerDismissed && (
            <DealerJourneyResumeBanner
              salesStep={effectiveSalesStep}
              onDismiss={() => setResumeBannerDismissed(true)}
            />
          )}
          {useSalesJourney && effectiveSalesStep && (
            <DealerJourneyProgress
              salesStep={effectiveSalesStep}
              flowKind={isCleverEntry ? 'clever' : 'classic'}
            />
          )}
          {showCleverConsult && (
            <CleverConsultationWizard
              profile={consultationProfile}
              searchProfile={searchProfile}
              searchFilters={searchFilters}
              primaryModelKey={primaryRecommendGroup?.modelLineKey ?? null}
              onProfileChange={setConsultationProfile}
              onComplete={handleConsultationComplete}
            />
          )}
          {showCleverRecommendation && (
            <CleverRecommendationCard
              recommendation={cleverRecommendation}
              dealerId={dealerId}
              onTalkToSeller={handleTalkToSeller}
              onConfigureClassic={handleCleverConfigureClassic}
              onSelectAlternative={handleSelectCleverAlternative}
            />
          )}
          {showSellerHandoff && (
            <SellerHandoffPanel
              handoffSummary={consultationHandoff}
              vehicleTitle={cleverRecommendation?.vehicleTitle}
              dealerName={conditions.dealerName}
              onRequestContact={handleRequestLead}
              onConfigureClassic={() => handleCleverConfigureClassic(cleverRecommendation)}
              onBack={() => setSalesStep('recommendation')}
            />
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
          {showNeedAdvisorRecommend && (
            <DealerNeedAnswerCard
              recognizedWishes={recognizedWishes}
              answer={needSearchAnswer}
              inquiryLeadSync={inquiryLeadSync}
              dealerId={dealerId}
              activeModelKey={activeRecommendPick?.modelKey}
              onActivePickChange={setActiveRecommendPick}
              onSelectModel={handleViewVehicle}
              onClarify={handleNeedClarify}
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
              key={selectedModelKey}
              modelKey={selectedModelKey}
              dealerId={dealerId}
              wishChipIds={wishChipIds}
              searchProfile={searchProfile}
              searchFilters={searchFilters}
              searchChipIds={activeSearchChipIds}
              deliveryLabel={selectedModelDelivery}
              prefilledWishCount={prefilledWishCount}
              knownPurchaseType={knownPurchaseType}
              powertrainOptions={powertrainOptions}
              onPowertrainChange={handlePowertrainChange}
              onCustomerWishReserve={handleCustomerWishReserve}
              onContactRequest={handleCustomerAdvisorContact}
              onSpecialQuestionSubmit={handleSpecialQuestionSubmit}
              dealerName={conditions.dealerName}
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
          {showPurchaseType && (
            <DealerPurchaseTypeCard
              configSummary={configSummary}
              value={purchaseTypeDraft ?? purchaseType}
              initialDetails={purchaseDetails}
              onSelectionChange={setPurchaseTypeDraft}
              onContinue={handlePurchaseTypeContinue}
            />
          )}
          {showSpecialConditions && (
            <DealerSpecialConditionsCard
              configSummary={configSummary}
              value={specialConditions}
              onContinue={handleSpecialConditionsContinue}
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
          <div ref={searchResultsRef}>
          {showLegacySearchResults && needSearchAnswer && !useSalesJourney && !hybridBlocksNeedAnswer && (
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
          </div>
        </div>
      </div>

      {mobileFooter?.onAction && (
        <DealerJourneyMobileFooter
          salesStep={mobileFooter.salesStep}
          title={mobileFooter.title}
          subtitle={mobileFooter.subtitle}
          stepLabel={mobileFooter.stepLabel}
          actionLabel={mobileFooter.actionLabel}
          actionHint={mobileFooter.actionHint}
          disabled={mobileFooter.disabled}
          onAction={mobileFooter.onAction}
        />
      )}

      {leadSheetOpen && (
        <DealerJourneyLeadSheet
          dealerName={conditions.dealerName}
          vehicleTitle={
            leadSheetMode === 'customerAdvisor' && customerAdvisorWish
              ? (customerAdvisorWish.possibleDirection ?? customerAdvisorWish.modelLabel)
              : (journeyOfferBundle?.vehicleTitle
                ?? (configSummary
                  ? `${configSummary.modelLabel ?? ''} ${configSummary.trimLabel ?? ''}`.trim()
                  : undefined))
          }
          onClose={handleLeadSheetClose}
          onSubmit={handleLeadSubmit}
        />
      )}
    </PageShell>
  );
}
