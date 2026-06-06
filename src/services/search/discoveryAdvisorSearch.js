import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { runCleverSearch } from './cleverSearchPipeline.js';
import { runAdvisorSearchWithAlternatives } from './advisorSearchAlternatives.js';

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

function flattenDiscoveryBundle(bundle) {
  if (bundle.hasExactMatch) {
    return {
      ...bundle.exact,
      hasExactMatch: true,
      alternatives: [],
      guidanceMessage: null,
    };
  }
  return {
    ...bundle.exact,
    matches: [],
    modelLineGroups: [],
    hasExactMatch: false,
    alternatives: bundle.alternatives,
    guidanceMessage: bundle.guidanceMessage,
    exclusionHint: bundle.exclusionHint ?? bundle.exact.exclusionHint,
  };
}

/** Vollständiges Pipeline-Ergebnis inkl. Alternativ-Stufen bei keinem exakten Treffer. */
export function matchAndRankDiscoveryFull(params) {
  const query = params.filters?.query ?? params.wishes?.rawQuery ?? '';
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({
    query,
    intent,
    filters: params.filters ?? {},
    wishes: params.wishes ?? {},
    chipIds: params.chipIds ?? [],
  });

  const bundle = runAdvisorSearchWithAlternatives({
    query,
    intent,
    profile,
    filters: params.filters ?? {},
    wishes: params.wishes ?? {},
    vehicles: params.vehicles ?? [],
    chipIds: params.chipIds ?? [],
    getDisplayRate: params.getDisplayRate,
    limit: params.limit ?? 30,
  });

  return flattenDiscoveryBundle(bundle);
}

export { buildModelLineGroups } from './modelLineGroups.js';
