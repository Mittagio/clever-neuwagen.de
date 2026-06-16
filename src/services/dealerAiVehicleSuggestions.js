/**
 * Dealer-AI-Fahrzeugvorschläge über dieselbe Berater-Pipeline wie Händler-Landing.
 */
import { getKiaSalesVehiclePool, getActiveKiaModelIdsFromConditions } from '../data/kia/kiaPartnerHub.js';
import { PILOT_DEALER_ID } from '../config/pilotLive.js';
import { adjustRateForTerm } from '../logic/oneSearchService.js';
import {
  formatMatchDeliveryLabel,
  formatMatchPrimaryPrice,
  formatMatchPriceFallback,
} from '../logic/discoveryDisplay.js';
import { parseSearchIntent } from './search/searchIntentParser.js';
import { intentToMarketplaceFilters } from './search/intentToFilters.js';
import {
  mergeDealerChipFilters,
  mergeDealerSearchFilters,
  matchDealerChipIdsFromQuery,
} from './dealer/dealerWishChips.js';
import { parseCustomerWish } from './wish/wishParser.js';
import { buildSearchProfile } from './search/searchProfile.js';
import { deriveAdvisorChipIds } from './sales/advisorRanking.js';
import { runAdvisorSearchWithAlternatives } from './search/advisorSearchAlternatives.js';
import { enrichModelLineGroupWithProfileQuote } from './cleverQuote/cleverQuoteService.js';
import {
  buildCleverQuoteWishLines,
  resolveDealerModelTitle,
} from './dealer/dealerAdvisorPresentation.js';
import { matchSuggestedModels } from './dealerAiModelMatcher.js';

const PAYMENT_MAP = {
  leasing: 'leasing',
  cash: 'cash',
  financing: 'finance',
  threeWayFinancing: 'finance',
};

function mergeFieldsIntoFilters(filters, fields) {
  const next = { ...filters };
  if (fields.paymentType && PAYMENT_MAP[fields.paymentType]) {
    next.payment = PAYMENT_MAP[fields.paymentType];
  }
  if (fields.desiredRate != null && next.payment !== 'cash') {
    next.maxRate = fields.desiredRate;
  }
  if (fields.desiredPrice != null && fields.paymentType === 'cash') {
    next.maxPrice = fields.desiredPrice;
  }
  if (fields.termMonths) next.termMonths = fields.termMonths;
  if (fields.model) {
    next.model = fields.model;
    next.modelExplicit = true;
    next.brand = fields.brand ?? 'Kia';
  }
  if (fields.motorLabel?.toLowerCase().includes('elektro')) next.fuel = 'elektro';
  if (fields.bodyType) next.type = fields.bodyType;
  return next;
}

function buildWishesFromDealerAi(filters, fields) {
  const wishes = parseCustomerWish(filters.query, filters.features ?? []);
  if (filters.fuel === 'elektro' && !wishes.features?.includes('elektro')) {
    wishes.features = [...(wishes.features ?? []), 'elektro'];
  }
  if (filters.maxRate != null) {
    wishes.budget = {
      ...wishes.budget,
      maxMonthlyRate: filters.maxRate,
      type: filters.payment || 'leasing',
    };
  }
  if (filters.maxPrice != null || fields.desiredPrice != null) {
    wishes.budget = {
      ...wishes.budget,
      maxPrice: filters.maxPrice ?? fields.desiredPrice,
      type: 'cash',
    };
  }
  if (fields.mileagePerYear) wishes.mileagePerYear = fields.mileagePerYear;
  return wishes;
}

function paymentModeFromFields(fields, filters) {
  if (filters.payment === 'cash' || fields.paymentType === 'cash') return 'cash';
  if (
    filters.payment === 'finance'
    || fields.paymentType === 'financing'
    || fields.paymentType === 'threeWayFinancing'
  ) {
    return 'financing';
  }
  return 'leasing';
}

function badgeForGroup(group, index, fields) {
  if (index === 0 && fields.modelId && group.modelLineKey === fields.modelId) {
    return 'passt sehr gut';
  }
  if (index === 0) return 'Clever Empfehlung';
  if (group.modelQuote?.percent >= 80) return 'passt sehr gut';
  if (group.modelQuote?.percent >= 60) return 'gute Alternative';
  return 'beliebte Alternative';
}

function mapGroupToCard(group, index, paymentMode, fields) {
  const match = group.primaryMatch;
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const delivery = formatMatchDeliveryLabel(match);
  const wishLines = buildCleverQuoteWishLines(group.modelQuote, group.modelChecks);
  const reason = wishLines[0]
    ?? group.modelChecks?.find((c) => c.status === 'fulfilled')?.label
    ?? 'Passend zum erkannten Kundenwunsch.';

  let priceHint = price.missing
    ? formatMatchPriceFallback(paymentMode)
    : `ab ${price.label}${price.suffix}`;
  if (delivery) priceHint = `${priceHint} · ${delivery}`;

  return {
    id: group.modelLineKey ?? match?.vehicle?.modelKey ?? `model-${index}`,
    name: resolveDealerModelTitle(group),
    modelKey: match?.vehicle?.modelKey ?? group.modelLineKey,
    bodyType: match?.vehicle?.bodyType ?? 'suv',
    badge: badgeForGroup(group, index, fields),
    reason,
    priceHint,
    matchScore: 100 - index,
    primaryMatch: match,
    modelLineGroup: group,
    cleverQuotePercent: group.modelQuote?.percent ?? null,
  };
}

function sortGroupsForPrimaryModel(groups, modelId) {
  if (!modelId) return groups;
  return [...groups].sort((a, b) => {
    const aHit = a.modelLineKey === modelId ? 1 : 0;
    const bHit = b.modelLineKey === modelId ? 1 : 0;
    return bHit - aHit;
  });
}

/**
 * @param {object} fields – erkannte Dealer-AI-Felder
 * @param {object} [conditions] – veröffentlichte Händlerkonditionen
 * @param {string[]} [chipIds] – optionale Verkaufsberater-Chips
 * @returns {Array<object>}
 */
export function resolveDealerAiVehicleSuggestions(fields, conditions = null, chipIds = []) {
  if (!fields) return [];

  const query = fields.rawText?.trim() || `Kia ${fields.model ?? ''}`.trim();
  if (!query && !fields.modelId && chipIds.length === 0) {
    return matchSuggestedModels(fields);
  }

  const dealerSlug = conditions?.dealerId ?? PILOT_DEALER_ID;
  const activeKiaModelIds = getActiveKiaModelIdsFromConditions(conditions);
  const termMonths = fields.termMonths ?? 48;

  const intent = parseSearchIntent(query);
  const textChipIds = matchDealerChipIdsFromQuery(query);
  const mergedChipIds = [...new Set([...chipIds, ...textChipIds])];

  let filters = mergeDealerSearchFilters(
    intentToMarketplaceFilters(intent),
    mergeDealerChipFilters(mergedChipIds),
    { query, dealer: dealerSlug },
  );
  filters = mergeFieldsIntoFilters(filters, fields);

  const wishes = buildWishesFromDealerAi(filters, fields);
  const searchChipIds = deriveAdvisorChipIds(filters, wishes);
  const allChipIds = [...new Set([...searchChipIds, ...mergedChipIds])];

  const searchProfile = buildSearchProfile({
    query,
    intent,
    filters,
    wishes,
    chipIds: allChipIds,
  });

  const pool = getKiaSalesVehiclePool({ activeModelIds: activeKiaModelIds, dealerSlug })
    .map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, termMonths),
    }));

  const bundle = runAdvisorSearchWithAlternatives({
    query,
    intent,
    profile: searchProfile,
    filters,
    wishes,
    vehicles: pool,
    chipIds: allChipIds,
    getDisplayRate: (v) => v.displayRate,
    limit: 6,
  });

  let groups = [];
  if (bundle.hasExactMatch && bundle.exact?.modelLineGroups?.length) {
    groups = bundle.exact.modelLineGroups;
  } else if (bundle.alternatives?.[0]?.modelLineGroups?.length) {
    groups = bundle.alternatives[0].modelLineGroups;
  }

  if (!groups.length) {
    return matchSuggestedModels(fields);
  }

  groups = sortGroupsForPrimaryModel(
    groups.map((group) => enrichModelLineGroupWithProfileQuote(group, searchProfile)),
    fields.modelId,
  );

  const paymentMode = paymentModeFromFields(fields, filters);
  return groups.slice(0, 4).map((group, index) => mapGroupToCard(group, index, paymentMode, fields));
}
