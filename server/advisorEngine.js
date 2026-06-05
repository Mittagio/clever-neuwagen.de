/**
 * Server-seitige Berater-Engine – gleiche Logik wie Frontend, zentrale Datenquelle.
 */

import { getKiaSalesVehiclePool } from '../src/data/kia/kiaPartnerHub.js';
import { getKiaTrinklePilotStock } from '../src/data/kia/kiaTrinkleStock.js';
import { filterMarketplaceVehicles } from '../src/logic/marketplaceService.js';
import { adjustRateForTerm } from '../src/logic/oneSearchService.js';
import { parseSearchIntent } from '../src/services/search/searchIntentParser.js';
import { parseCustomerSearchProfile } from '../src/services/search/openAiIntentParser.js';
import { intentToMarketplaceFilters } from '../src/services/search/intentToFilters.js';
import { parseCustomerWish } from '../src/services/wish/wishParser.js';
import { runCleverSearch } from '../src/services/search/cleverSearchPipeline.js';
import { computeSalesAdvisorResults } from '../src/services/sales/salesAdvisorService.js';
import { deriveAdvisorChipIds, finalizeAdvisorMatches } from '../src/services/sales/advisorRanking.js';
import { matchVehiclesToWish } from '../src/services/wish/wishMatchEngine.js';
import { enrichMatchWithKiaMeta } from '../src/data/kia/kiaPartnerHub.js';
import {
  snapshotDiscoveryResult,
  snapshotSalesResult,
  snapshotMatch,
} from '../src/services/advisor/advisorSnapshot.js';

const DEFAULT_DEALER = process.env.VITE_PILOT_DEALER_ID || 'autohaus-trinkle';
const DEFAULT_TERM = 48;

function resolveDealerSlug(dealerSlug) {
  return dealerSlug || DEFAULT_DEALER;
}

function prepareVehiclePool(dealerSlug, activeModelIds = null) {
  const slug = resolveDealerSlug(dealerSlug);
  if (slug === 'autohaus-trinkle') {
    const stock = getKiaTrinklePilotStock();
    if (!activeModelIds?.length) return stock;
    return getKiaSalesVehiclePool({ dealerSlug: slug, activeModelIds });
  }
  return getKiaSalesVehiclePool({ dealerSlug: slug, activeModelIds });
}

function buildWishesFromPayload({ query = '', filters = {}, wishes: wishOverride = null }) {
  if (wishOverride) return wishOverride;
  const w = parseCustomerWish(query, filters.features ?? []);
  if (filters.modelExplicit && filters.model) {
    w.model = filters.model;
    w.brand = filters.brand || w.brand;
    w.trim = filters.trim || w.trim;
  }
  if (filters.maxRate) {
    w.budget = { ...w.budget, maxMonthlyRate: filters.maxRate, type: filters.payment || 'leasing' };
  }
  if (filters.fuel === 'elektro' && !w.features.includes('elektro')) {
    w.features = [...w.features, 'elektro'];
  }
  return w;
}

function runDiscoveryCore(payload = {}, intent) {
  const {
    query = '',
    filters: rawFilters = {},
    dealerSlug = DEFAULT_DEALER,
    activeModelIds = null,
    limit = 30,
  } = payload;

  const filters = { ...intentToMarketplaceFilters(intent), ...rawFilters };
  const wishes = buildWishesFromPayload({ query, filters: rawFilters, wishes: payload.wishes });
  const chipIds = payload.chipIds ?? deriveAdvisorChipIds(filters, wishes);
  const termMonths = filters.termMonths ?? DEFAULT_TERM;

  const pool = prepareVehiclePool(dealerSlug, activeModelIds);
  const filtered = filterMarketplaceVehicles(pool, {
    ...filters,
    excludedBrands: [],
    excludedModels: [],
  }).map((vehicle) => ({
    ...vehicle,
    displayRate: adjustRateForTerm(vehicle.monthlyRate, termMonths),
  }));

  return runCleverSearch({
    query,
    intent,
    filters,
    wishes,
    chipIds,
    vehicles: filtered,
    getDisplayRate: (v) => v.displayRate,
    limit,
  });
}

/** Synchron – lokaler Intent-Parser (Tests, Fallback). */
export function runServerDiscoverySearch(payload = {}) {
  const query = payload.query ?? '';
  const intent = parseSearchIntent(query);
  const result = runDiscoveryCore(payload, intent);
  return snapshotDiscoveryResult(result, { profileSource: 'local' });
}

/**
 * Async – optional OpenAI für Suchprofil (nur Profil, keine Fahrzeugauswahl).
 * Aktivierung: payload.useOpenAi oder env ADVISOR_USE_OPENAI=true + OPENAI_API_KEY.
 */
export async function runServerDiscoverySearchAsync(payload = {}) {
  const query = payload.query ?? '';
  const useOpenAi = payload.useOpenAi ?? process.env.ADVISOR_USE_OPENAI === 'true';
  const parsed = await parseCustomerSearchProfile(query, { useOpenAi });
  const result = runDiscoveryCore(payload, parsed.intent);
  return snapshotDiscoveryResult(result, { profileSource: parsed.source });
}

export function runServerSalesSearch(payload = {}) {
  const {
    chipIds = [],
    limit = 12,
    termMonths = DEFAULT_TERM,
    mileagePerYear = null,
    activeModelIds = null,
    dealerSlug = DEFAULT_DEALER,
  } = payload;

  const result = computeSalesAdvisorResults(chipIds, {
    limit,
    termMonths,
    mileagePerYear,
    activeModelIds,
    dealerSlug: resolveDealerSlug(dealerSlug),
  });

  return snapshotSalesResult(result);
}

export function getServerVehicleBySlug(slug, dealerSlug = DEFAULT_DEALER, options = {}) {
  if (!slug) return null;
  const pool = prepareVehiclePool(dealerSlug);
  const vehicle = pool.find((v) => v.slug === slug);
  if (!vehicle) return null;

  const { wishes: wishInput = null, chipIds: chipInput = [], filters = {} } = options;
  const wishes = wishInput ?? { features: [], budget: { type: 'leasing' }, rawQuery: '' };
  const chipIds = chipInput.length ? chipInput : deriveAdvisorChipIds(filters, wishes);

  const ranked = matchVehiclesToWish({
    wishes,
    vehicles: [{ ...vehicle, displayRate: vehicle.monthlyRate }],
    getDisplayRate: (v) => v.displayRate ?? v.monthlyRate,
  });
  const finalized = finalizeAdvisorMatches(ranked, {
    wishes,
    chipIds,
    limit: 1,
  });
  const enrichedMatch = finalized[0] ? enrichMatchWithKiaMeta(finalized[0]) : null;

  const match = snapshotMatch(enrichedMatch ?? {
    slug: vehicle.slug,
    vehicle,
    model: `${vehicle.brand} ${vehicle.model}`,
    bestOffer: {
      monthlyRate: vehicle.monthlyRate,
      deliveryTime: vehicle.deliveryTime,
      availability: vehicle.availability,
      dealer: vehicle.dealerName,
    },
  });

  return { match, vehicle: { ...vehicle } };
}
