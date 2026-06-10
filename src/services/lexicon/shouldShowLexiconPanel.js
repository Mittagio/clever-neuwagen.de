/**
 * Wann das Lexikon auf der Händler-Landing neben den Suchergebnissen erscheint.
 */
export function shouldShowDealerLexiconPanel(answer, profile, { showEmpty = false } = {}) {
  if (!answer) return false;
  if (answer.kind === 'data_gap') return true;
  if (showEmpty && answer.matches?.length > 0) return true;

  const p = profile ?? {};
  const isFactualQuery = Boolean(
    p.trunkLMin != null
    || p.trunkDepthCmMin != null
    || p.maxLengthMm != null
    || p.maxHeightMm != null
    || p.isofixRearMin != null
    || p.towCapacityKg != null
    || p.rangeKmMin != null
    || p.minRangeKm != null
    || p.rangeRanking === 'max'
    || (p.seatsMin != null && p.seatsMin >= 7),
  );

  return isFactualQuery && (answer.matches?.length ?? 0) > 0;
}
