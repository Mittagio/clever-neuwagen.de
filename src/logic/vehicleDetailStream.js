/**
 * Ein Upgrade-Vorschlag + max. 3 Alternativen für den Stream (Mobile).
 * Priorität: Paket → Premium-Trim → günstigerer Trim
 */
export function pickStreamUpgrade(recommendationResult, { selectedPackageIds = [] } = {}) {
  const pkg = recommendationResult?.requiredPackages?.[0];
  if (pkg && !selectedPackageIds.includes(pkg.id)) {
    const requested = pkg.features?.filter((f) => f.reason !== 'bonus') ?? [];
    const bonus = pkg.features?.filter((f) => f.reason === 'bonus') ?? [];
    return {
      kind: 'package',
      data: pkg,
      title: pkg.name,
      subtitle: recommendationResult?.magicSummary?.split('\n')[0] ?? null,
      gains: requested.map((f) => f.label),
      bonusLabels: bonus.map((f) => f.label),
      priceDeltaLabel: recommendationResult?.priceDeltaLabel ?? null,
      baselinePriceLabel: recommendationResult?.baselinePriceLabel ?? null,
      newPriceLabel: recommendationResult?.newPriceLabelFull ?? recommendationResult?.newPriceLabel ?? null,
    };
  }

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
