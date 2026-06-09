/**
 * Strukturierte Fahrzeugsuche – rawQuery nur als Zusatz, nie Hauptlogik
 */

import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { hasStructuredSearchFilters } from './intentToFilters.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';
import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { buildNeverEmptyResults } from '../../logic/neverEmptyResultsService.js';

export function prepareVehiclesForSearch(vehicles, filters) {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),
  }));
}

export function filterVehiclesStructured(vehicles, filters) {
  const prepared = prepareVehiclesForSearch(vehicles, filters);
  return filterMarketplaceVehicles(prepared, {
    ...filters,
    softAvailability: true,
    intentStructured: hasStructuredSearchFilters(filters) || filters.intentStructured,
  });
}

export function matchWishStructured({ wishes, vehicles, filters, getDisplayRate }) {
  const filtered = filterVehiclesStructured(vehicles, filters);
  return matchVehiclesToWish({
    wishes,
    vehicles: filtered,
    getDisplayRate: getDisplayRate ?? ((v) => v.displayRate),
  });
}

/**
 * Vollständiger Suchlauf inkl. Never-Empty-Fallback
 */
export function runStructuredVehicleSearch({
  filters,
  wishes,
  allVehicles,
  exactMatches: precomputedExact,
}) {
  const filtered = filterVehiclesStructured(allVehicles, filters);
  const exactMatches = precomputedExact ?? matchVehiclesToWish({
    wishes,
    vehicles: filtered,
    getDisplayRate: (v) => v.displayRate,
  });

  const neverEmpty = buildNeverEmptyResults({
    filters,
    wishes,
    exactMatches,
    allVehicles,
  });

  return {
    filteredVehicles: filtered,
    exactMatches,
    neverEmpty,
    usedStructuredSearch: hasStructuredSearchFilters(filters),
  };
}
