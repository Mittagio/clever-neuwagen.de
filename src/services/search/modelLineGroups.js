/**
 * Modelllinien-Gruppierung: ein Treffer pro Modell, Ausstattungen darunter.
 */

import {
  getModelLineKey,
  getModelLineLabel,
  computeAdvisorRawScore,
} from '../sales/advisorRanking.js';
import { getMatchVariantLabel, getTrimGroupKey } from '../../logic/discoveryDisplay.js';

function matchSortScore(match) {
  return match._advisorRaw ?? match.score ?? match.cleverQuote?.percent ?? 0;
}

function buildTrimVariants(lineMatches, primary) {
  const byTrim = new Map();

  for (const match of lineMatches) {
    const trimKey = getTrimGroupKey(match);
    const existing = byTrim.get(trimKey);
    const score = matchSortScore(match);
    if (!existing || score > matchSortScore(existing)) {
      byTrim.set(trimKey, match);
    }
  }

  const primaryTrimKey = getTrimGroupKey(primary);

  return [...byTrim.entries()]
    .map(([trimKey, match]) => ({
      trimKey,
      trimLabel: getMatchVariantLabel(match),
      match,
      isPrimary: trimKey === primaryTrimKey,
    }))
    .sort((a, b) => matchSortScore(b.match) - matchSortScore(a.match));
}

/**
 * @param {object[]} allMatches – alle bewerteten Varianten (vor Deduplizierung)
 * @param {object[]} primaryMatches – ein bester Treffer pro Modelllinie (nach Ranking)
 */
export function buildModelLineGroups(allMatches = [], primaryMatches = [], options = {}) {
  const { wishes, chipIds = [] } = options;
  const byLine = new Map();

  for (const match of allMatches) {
    const line = getModelLineKey(match.vehicle);
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(match);
  }

  return primaryMatches.map((primary, index) => {
    const line = getModelLineKey(primary.vehicle);
    const lineMatches = (byLine.get(line) ?? []).map((m) => ({
      ...m,
      _advisorRaw: m._advisorRaw ?? computeAdvisorRawScore(m, { wishes, chipIds }),
    }));

    const trimVariants = buildTrimVariants(lineMatches, primary);
    const variants = trimVariants.filter((t) => !t.isPrimary).map((t) => t.match);

    return {
      modelLineKey: line,
      label: getModelLineLabel(primary.vehicle),
      rank: index + 1,
      primaryMatch: primary,
      variants,
      trimVariants,
      variantCount: trimVariants.length,
      hasMultipleVariants: trimVariants.length > 1,
    };
  });
}

export function flattenModelLineGroups(groups = []) {
  return groups.map((g) => g.primaryMatch);
}

export function findModelLineGroup(groups = [], match) {
  if (!match) return null;
  const line = getModelLineKey(match.vehicle ?? match);
  return groups.find((g) => g.modelLineKey === line) ?? null;
}
