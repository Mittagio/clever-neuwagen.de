import { MARKETPLACE_VEHICLES } from '../../data/marketplaceVehicles.js';
import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';
import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { computeCleverQuote } from '../cleverQuote/cleverQuoteService.js';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';

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

function applySalesFilters(vehicles, wishes) {
  return vehicles.filter((v) => {
    if (wishes.budget?.maxMonthlyRate && v.monthlyRate > wishes.budget.maxMonthlyRate) return false;
    if (wishes.availability && v.availability !== wishes.availability) return false;
    if (!vehicleMatchesPowertrain(v, wishes.powertrain)) return false;
    if (!vehicleMatchesBodyType(v, wishes.bodyType)) return false;
    return true;
  });
}

export function findSalesAdvisorMatches(chipIds = [], { limit = 5, termMonths = DEFAULT_TERM, mileagePerYear = null } = {}) {
  const wishes = buildWishesFromChipIds(chipIds);
  const effectiveMileage = mileagePerYear ?? wishes.mileagePerYear;
  const mileageFactor = mileageRateFactor(effectiveMileage);
  const hasAnySelection = chipIds.length > 0;

  const filters = {
    maxRate: wishes.budget?.maxMonthlyRate ?? null,
    availability: wishes.availability ?? null,
    type: wishes.bodyType ?? 'all',
    fuel: wishes.powertrain === 'elektro' ? 'elektro' : wishes.powertrain ?? null,
    features: wishes.features.filter((f) => !['elektro', 'benzin', 'family_suv'].includes(f)),
  };

  let vehicles = filterMarketplaceVehicles(MARKETPLACE_VEHICLES, filters);
  vehicles = applySalesFilters(vehicles, wishes);

  if (!vehicles.length && hasAnySelection) {
    vehicles = [...MARKETPLACE_VEHICLES];
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

  return ranked.slice(0, limit).map((match) => ({
    ...match,
    cleverQuote: match.cleverQuote ?? computeCleverQuote({
      vehicle: match.vehicle,
      wishes,
      match,
      trimId: match.bestTrimId,
    }),
  }));
}

export function buildSalesCompareRows(matches = []) {
  return matches.map((m) => {
    const v = m.vehicle;
    return {
      slug: m.slug,
      title: m.model ?? `${v.brand} ${v.model}`,
      cleverQuote: m.cleverQuote,
      monthlyRate: m.bestOffer?.monthlyRate ?? v.monthlyRate,
      financeRate: v.financeRate ?? Math.round(v.monthlyRate * 1.08),
      cashPrice: v.cashPrice,
      rangeKm: v.rangeKm ?? v.wltpRange ?? '—',
      trunkLiters: v.trunkLiters ?? '—',
      towCapacityKg: v.towCapacityKg ?? '—',
      deliveryTime: m.bestOffer?.deliveryTime ?? v.deliveryTime ?? '—',
      availability: v.availability,
      discountPercent: v.discountPercent ?? 0,
      matchedFeatures: m.matchedFeatures ?? [],
      missingFeatures: m.missingFeatures ?? [],
    };
  });
}

export function getFulfilledLabels(match) {
  if (match?.cleverQuote?.items?.length) {
    return match.cleverQuote.items.filter((i) => i.fulfilled).map((i) => i.label);
  }
  return (match?.matchedFeatures ?? []).map((id) => id);
}

export function getMissingLabels(match) {
  if (match?.cleverQuote?.items?.length) {
    return match.cleverQuote.items.filter((i) => !i.fulfilled).map((i) => i.label);
  }
  return match?.missingFeatures ?? [];
}
