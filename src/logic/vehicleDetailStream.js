/**
 * Ein Upgrade-Vorschlag + max. 3 Alternativen für den Stream (Mobile).
 */
export function pickStreamUpgrade(recommendationResult) {
  const premium = recommendationResult?.premiumTrim;
  const better = recommendationResult?.betterTrim;
  if (premium?.exists) {
    return {
      kind: 'trim',
      title: `${premium.trim}`,
      subtitle: premium.reason,
      gains: premium.gainLabels ?? [],
      direction: 'up',
      trim: premium,
    };
  }
  if (better?.exists) {
    return {
      kind: 'trim',
      title: `${better.trim}`,
      subtitle: better.reason,
      gains: better.keepLabels ?? [],
      losses: better.loseLabels ?? [],
      direction: 'down',
      trim: better,
    };
  }
  return null;
}

export function pickStreamAlternatives(alternatives = [], limit = 3, currentSlug) {
  const filtered = currentSlug
    ? alternatives.filter((alt) => alt.slug !== currentSlug)
    : alternatives;
  return filtered.slice(0, limit);
}
