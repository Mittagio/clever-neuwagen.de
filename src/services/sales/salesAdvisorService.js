import {
  getKiaSalesVehiclePool,
  enrichMatchWithKiaMeta,
} from '../../data/kia/kiaPartnerHub.js';
import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';
import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';
import { finalizeAdvisorMatches, needsWishClarification } from './advisorRanking.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { passesHardRules } from '../search/hardExclusionRules.js';
import { enrichVehicleWithModelAttributes } from '../../data/kia/kiaModelAttributes.js';
import { buildModelLineGroups } from '../search/modelLineGroups.js';
import { buildShareCompareRows } from '../advisor/advisorSnapshot.js';

export { needsWishClarification } from './advisorRanking.js';

const DEFAULT_TERM = 48;

function unique(arr) {
  return [...new Set(arr)];
}

/**
 * Wandelt ausgewählte Sales-Chips in Wunsch-Objekt + Filter um.
 */
export function buildWishesFromChipIds(chipIds = []) {
  const features = [];
  let bodyType = null;
  let powertrain = null;
  let budgetMax = null;
  let availability = null;
  let vehicleType = null;
  let mileagePerYear = null;

  for (const chipId of chipIds) {
    const chip = getSalesChipById(chipId);
    if (!chip) continue;

    if (chip.features?.length) features.push(...chip.features);
    if (chip.bodyType) {
      bodyType = chip.bodyType;
      if (chip.bodyType === 'suv') vehicleType = 'SUV';
    }
    if (chip.powertrain) powertrain = chip.powertrain;
    if (chip.budgetMax != null) {
      budgetMax = budgetMax == null ? chip.budgetMax : Math.min(budgetMax, chip.budgetMax);
    }
    if (chip.availability !== undefined) availability = chip.availability;
    if (chip.mileagePerYear != null) mileagePerYear = chip.mileagePerYear;
  }

  return {
    features: unique(features),
    budget: {
      type: 'leasing',
      maxMonthlyRate: budgetMax,
    },
    bodyType,
    powertrain,
    availability,
    vehicleType,
    mileagePerYear,
    location: null,
    rawQuery: '',
  };
}

export function buildNeedsSummary(chipIds = [], customer = {}, mileageOverride = null) {
  const wishes = buildWishesFromChipIds(chipIds);
  const mileage = mileageOverride ?? wishes.mileagePerYear;
  const items = chipIds
    .map((id) => getSalesChipById(id))
    .filter(Boolean)
    .map((c) => c.label);

  const vehicleClass = recommendVehicleClass(wishes, chipIds);

  return {
    customerLabel: customer.name?.trim() || 'Ihr Kunde',
    items,
    mileagePerYear: mileage,
    budgetMax: wishes.budget?.maxMonthlyRate,
    vehicleClass,
    powertrainLabel: powertrainLabel(wishes.powertrain),
  };
}

function powertrainLabel(p) {
  if (p === 'elektro') return 'eher elektrisch';
  if (p === 'plugin-hybrid') return 'Plug-in-Hybrid';
  if (p === 'hybrid') return 'Hybrid';
  if (p === 'diesel') return 'Diesel';
  if (p === 'verbrenner') return 'Benziner';
  return null;
}

export function recommendVehicleClass(wishes, chipIds = []) {
  if (chipIds.includes('type_van') || chipIds.includes('type_familie')) return 'Van / Familien-SUV';
  if (wishes.bodyType === 'suv' || chipIds.includes('type_suv')) return 'Kompakt-SUV / Familien-SUV';
  if (wishes.bodyType === 'kombi') return 'Kombi / Kompakt';
  if (wishes.bodyType === 'kleinwagen') return 'Kleinwagen / Kompakt';
  if (wishes.powertrain === 'elektro') return 'Elektro-Kompaktklasse';
  return 'Passende Fahrzeugklasse';
}

function mileageRateFactor(mileagePerYear) {
  if (!mileagePerYear) return 1;
  if (mileagePerYear <= 10000) return 0.95;
  if (mileagePerYear >= 30000) return 1.14;
  return 1 + ((mileagePerYear - 15000) / 15000) * 0.09;
}

function vehicleMatchesPowertrain(vehicle, powertrain) {
  if (!powertrain) return true;
  if (powertrain === 'elektro') return vehicle.powertrain === 'elektro';
  if (powertrain === 'plugin-hybrid') return vehicle.powertrain === 'plugin-hybrid';
  if (powertrain === 'diesel') return vehicle.powertrain === 'diesel' || /diesel/i.test(vehicle.title ?? '');
  if (powertrain === 'hybrid') return ['hybrid', 'plugin-hybrid'].includes(vehicle.powertrain);
  if (powertrain === 'verbrenner') return ['verbrenner', 'hybrid'].includes(vehicle.powertrain);
  return true;
}

function vehicleMatchesBodyType(vehicle, bodyType) {
  if (!bodyType || bodyType === 'all') return true;
  return vehicle.bodyType === bodyType;
}

function applyHardRuleFilters(vehicles, chipIds, wishes) {
  const profile = buildSearchProfile({ chipIds, wishes });
  return vehicles
    .map(enrichVehicleWithModelAttributes)
    .filter((v) => passesHardRules(v, profile));
}

function applySalesFilters(vehicles, wishes, chipIds = []) {
  return applyHardRuleFilters(
    vehicles.filter((v) => {
      if (wishes.budget?.maxMonthlyRate && v.monthlyRate > wishes.budget.maxMonthlyRate) return false;
      if (wishes.availability && v.availability !== wishes.availability) return false;
      if (!vehicleMatchesPowertrain(v, wishes.powertrain)) return false;
      if (!vehicleMatchesBodyType(v, wishes.bodyType)) return false;
      return true;
    }),
    chipIds,
    wishes,
  );
}

export function computeSalesAdvisorResults(chipIds = [], options = {}) {
  const {
    limit = 5,
    termMonths = DEFAULT_TERM,
    mileagePerYear = null,
    activeKiaModelIds = null,
    dealerSlug = null,
  } = options;

  const wishes = buildWishesFromChipIds(chipIds);
  const effectiveMileage = mileagePerYear ?? wishes.mileagePerYear;
  const mileageFactor = mileageRateFactor(effectiveMileage);

  const kiaPool = getKiaSalesVehiclePool({ activeModelIds: activeKiaModelIds, dealerSlug });

  const filters = {
    maxRate: wishes.budget?.maxMonthlyRate ?? null,
    availability: wishes.availability ?? null,
    type: wishes.bodyType ?? 'all',
    fuel: wishes.powertrain === 'elektro' ? 'elektro' : wishes.powertrain ?? null,
    features: wishes.features.filter((f) => !['elektro', 'benzin', 'family_suv'].includes(f)),
  };

  let vehicles = filterMarketplaceVehicles(kiaPool, filters);
  vehicles = applySalesFilters(vehicles, wishes, chipIds);

  if (!vehicles.length && wishes.budget?.maxMonthlyRate) {
    const relaxedWishes = { ...wishes, budget: { ...wishes.budget, maxMonthlyRate: null } };
    vehicles = applySalesFilters(
      filterMarketplaceVehicles(kiaPool, { ...filters, maxRate: null }),
      relaxedWishes,
      chipIds,
    ).map((v) => ({ ...v, budgetRelaxed: true }));
  }

  const enriched = vehicles.map((v) => ({
    ...v,
    displayRate: Math.round(adjustRateForTerm(v.monthlyRate, termMonths) * mileageFactor),
  }));

  const ranked = matchVehiclesToWish({
    wishes,
    vehicles: enriched,
    getDisplayRate: (v) => v.displayRate,
  });

  const finalized = finalizeAdvisorMatches(ranked, { wishes, chipIds, limit });
  const matches = finalized.map((match) => enrichMatchWithKiaMeta(match));
  const modelLineGroups = buildModelLineGroups(ranked, finalized, { wishes, chipIds });

  return { matches, modelLineGroups, wishes };
}

export function findSalesAdvisorMatches(chipIds = [], options = {}) {
  return computeSalesAdvisorResults(chipIds, options).matches;
}

export function buildSalesCompareRows(matches = []) {
  return buildShareCompareRows(matches);
}

export function getFulfilledLabels(match) {
  if (match?.cleverQuote?.items?.length) {
    return match.cleverQuote.items.filter((i) => i.fulfilled).map((i) => i.label);
  }
  return (match?.matchedFeatures ?? []).map((id) => id);
}

export function getMissingLabels(match) {
  if (match?.cleverQuote?.items?.length) {
    return match.cleverQuote.items
      .filter((i) => i.status === 'missing')
      .map((i) => i.label);
  }
  return match?.missingFeatures ?? [];
}
