/**
 * Ranking nach Wunsch-Wahrheit: erfüllt > unbekannt > verfehlt.
 * Unbekannt zählt nicht als Treffer (weder im % noch in der Sortierung).
 */

import { buildProfileCleverQuote } from '../cleverQuote/cleverQuoteService.js';
import { evaluateVehicleForProfile } from '../cleverData/cleverDataEngine.js';
import { compareAvailabilityPreference } from './availabilityPreference.js';

/**
 * @param {object} evaluation – evaluateVehicleForProfile / recordEval
 */
export function summarizeWishEvaluation(evaluation = {}) {
  const checks = evaluation.checks ?? [];
  const fulfilledCount = checks.filter((c) => c.status === 'fulfilled').length;
  const unknownCount = checks.filter((c) => c.status === 'unknown').length;
  const missingCount = checks.filter((c) => c.status === 'missing' || c.status === 'package').length;
  const totalChecks = checks.length || evaluation.totalChecks || 0;

  return {
    fulfilledCount,
    unknownCount,
    missingCount,
    totalChecks,
    /** 0 = alle bekannt & erfüllt, 1 = hat Unbekanntes, 2 = hat Verfehltes */
    truthTier: missingCount > 0 ? 2 : (unknownCount > 0 ? 1 : 0),
    wishPercent: totalChecks > 0 ? Math.round((fulfilledCount / totalChecks) * 100) : 100,
  };
}

export function buildFulfillmentLabel(evaluation = {}) {
  const summary = summarizeWishEvaluation(evaluation);
  if (!summary.totalChecks) return null;
  const base = `${summary.fulfilledCount} von ${summary.totalChecks} Wünschen`;
  if (summary.unknownCount > 0) {
    const n = summary.unknownCount;
    return `${base} (${n} nicht geprüft)`;
  }
  return base;
}

/**
 * @param {object} a – Match mit evaluation oder cleverQuote
 * @param {object} b
 * @returns {number}
 */
export function compareWishTruthMatches(a, b, profile = null) {
  const evalA = a.evaluation ?? a.profileEvaluation ?? {};
  const evalB = b.evaluation ?? b.profileEvaluation ?? {};
  const sumA = summarizeWishEvaluation(evalA);
  const sumB = summarizeWishEvaluation(evalB);

  if (sumA.truthTier !== sumB.truthTier) return sumA.truthTier - sumB.truthTier;
  if (sumA.missingCount !== sumB.missingCount) return sumA.missingCount - sumB.missingCount;
  if (sumA.unknownCount !== sumB.unknownCount) return sumA.unknownCount - sumB.unknownCount;

  const pctA = a.cleverQuote?.percent ?? sumA.wishPercent ?? a.score ?? 0;
  const pctB = b.cleverQuote?.percent ?? sumB.wishPercent ?? b.score ?? 0;
  if (pctB !== pctA) return pctB - pctA;

  const availPref = profile?.availability ?? a._availabilityPreference ?? b._availabilityPreference ?? null;
  const availCmp = compareAvailabilityPreference(a, b, availPref);
  if (availCmp !== 0) return availCmp;

  return (b._advisorRaw ?? b.score ?? 0) - (a._advisorRaw ?? a.score ?? 0);
}

/**
 * Profile-basiertes Ranking + CleverQuote für alle Treffer.
 * @param {object[]} matches
 * @param {import('./searchProfile.js').SearchProfile} profile
 */
export function rankMatchesByProfileTruth(matches = [], profile, { preserveAdvisorMode = true } = {}) {
  if (!profile || !matches.length) return matches;

  const enriched = matches.map((match) => {
    const evaluation = evaluateVehicleForProfile(profile, match.vehicle);
    const cleverQuote = buildProfileCleverQuote(
      { ...match, cleverQuote: match.cleverQuote },
      profile,
      { preserveAdvisorMode: preserveAdvisorMode && Boolean(match.cleverQuote?.advisorMode) },
    );
    return {
      ...match,
      evaluation,
      profileEvaluation: evaluation,
      cleverQuote,
    };
  });

  return [...enriched].sort((a, b) => compareWishTruthMatches(a, b, profile));
}
