/**
 * Schicht 3: Clever-Search-Pipeline
 * Suchprofil → harte Filter → CleverQuote-Ranking → Erklärung
 */

import { matchVehiclesToWish } from '../wish/wishMatchEngine.js';
import { rankAdvisorDiscoveryMatches } from '../sales/advisorRanking.js';
import { buildSearchProfile } from './searchProfile.js';
import {
  partitionByHardRules,
  buildExclusionHint,
  buildNoExactMatchMessage,
} from './hardExclusionRules.js';
import { enrichVehicleWithModelAttributes } from '../../data/kia/kiaModelAttributes.js';
import { buildModelLineGroups, dedupeMatchesByModelLine } from './modelLineGroups.js';
import { rankMatchesByProfileTruth } from './wishMatchRanking.js';
import { filterModelLineGroupsByWishFit } from './profileWishScore.js';
import { enrichModelLineGroupsWithProfileQuote } from '../cleverQuote/cleverQuoteService.js';

/**
 * @param {object} params
 * @param {string} [params.query]
 * @param {object} [params.intent]
 * @param {object} [params.filters]
 * @param {object} [params.wishes]
 * @param {string[]} [params.chipIds]
 * @param {object[]} params.vehicles
 * @param {Function} [params.getDisplayRate]
 * @param {number} [params.limit]
 */
export function runCleverSearch({
  query,
  intent,
  filters = {},
  wishes = {},
  chipIds = [],
  vehicles = [],
  getDisplayRate,
  limit = 30,
  profileOverride = null,
}) {
  const profile = profileOverride ?? buildSearchProfile({ query, intent, filters, wishes, chipIds });

  const enrichedPool = vehicles.map(enrichVehicleWithModelAttributes);
  const { eligible, excluded } = partitionByHardRules(enrichedPool, profile);

  if (!eligible.length) {
    return {
      profile,
      matches: [],
      modelLineGroups: [],
      excluded,
      exclusionHint: buildExclusionHint(profile, excluded),
      noExactMatchMessage: buildNoExactMatchMessage(profile, excluded),
      eligibleCount: 0,
    };
  }

  const raw = matchVehiclesToWish({
    wishes,
    vehicles: eligible,
    getDisplayRate: getDisplayRate ?? ((v) => v.displayRate ?? v.monthlyRate),
  });

  let ranked = rankAdvisorDiscoveryMatches(raw, { wishes, filters, chipIds, limit });
  ranked = rankMatchesByProfileTruth(ranked, profile);
  const lineMatches = dedupeMatchesByModelLine(ranked);
  let modelLineGroups = enrichModelLineGroupsWithProfileQuote(
    filterModelLineGroupsByWishFit(
      buildModelLineGroups(raw, lineMatches, { wishes, chipIds }),
      profile,
    ),
    profile,
  );

  if (!ranked.length && enrichedPool.length) {
    const fallbackRaw = matchVehiclesToWish({
      wishes,
      vehicles: enrichedPool,
      getDisplayRate: getDisplayRate ?? ((v) => v.displayRate ?? v.monthlyRate),
    });
    let fallbackRanked = rankAdvisorDiscoveryMatches(fallbackRaw, { wishes, filters, chipIds, limit });
    fallbackRanked = rankMatchesByProfileTruth(fallbackRanked, profile);
    if (fallbackRanked.length) {
      const fallbackLineMatches = dedupeMatchesByModelLine(fallbackRanked);
      modelLineGroups = enrichModelLineGroupsWithProfileQuote(
        filterModelLineGroupsByWishFit(
          buildModelLineGroups(fallbackRaw, fallbackLineMatches, { wishes, chipIds }),
          profile,
        ),
        profile,
      );
      return {
        profile,
        matches: fallbackLineMatches,
        modelLineGroups,
        excluded,
        exclusionHint: buildExclusionHint(profile, excluded),
        noExactMatchMessage: 'Wir zeigen die bestpassenden Modelle – nicht alle Wünsche sind in jeder Ausstattung serienmäßig enthalten.',
        eligibleCount: enrichedPool.length,
        partialMatch: true,
      };
    }
  }

  return {
    profile,
    matches: lineMatches,
    modelLineGroups,
    excluded,
    exclusionHint: buildExclusionHint(profile, excluded),
    noExactMatchMessage: null,
    eligibleCount: eligible.length,
  };
}

/** Nur harte Filter – für Marketplace-Filterung vor Scoring. */
export function filterVehiclesByHardRules(vehicles = [], profile) {
  return partitionByHardRules(vehicles, profile).eligible;
}

export { buildSearchProfile } from './searchProfile.js';
export { partitionByHardRules, passesHardRules, evaluateHardRules } from './hardExclusionRules.js';
