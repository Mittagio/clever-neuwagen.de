import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { runCleverSearch } from './cleverSearchPipeline.js';

/** Fahrzeugsuche: 3-Schichten-Pipeline (Profil → harte Regeln → CleverQuote). */
export function matchAndRankDiscovery({
  wishes,
  vehicles,
  filters,
  getDisplayRate,
  limit = 30,
  chipIds = [],
}) {
  const result = runCleverSearch({
    filters,
    wishes,
    chipIds,
    vehicles,
    getDisplayRate,
    limit,
    query: filters?.query ?? wishes?.rawQuery,
  });
  return result.matches;
}

/** Vollständiges Pipeline-Ergebnis inkl. Ausschluss-Hinweise. */
export function matchAndRankDiscoveryFull(params) {
  const result = runCleverSearch({
    ...params,
    query: params.filters?.query ?? params.wishes?.rawQuery,
  });
  return result;
}

export { buildModelLineGroups } from './modelLineGroups.js';
