import { KIA_MODEL_WORLD } from '../../data/dealerLandingContent.js';

const STATIC_BY_KEY = new Map(
  KIA_MODEL_WORLD.flatMap((entry) => [
    [entry.id, entry],
    [entry.modelKey, entry],
  ]),
);

function resolveMonthlyRate(match) {
  if (!match) return null;
  return match.monthlyRate
    ?? match.bestOffer?.monthlyRate
    ?? match.vehicle?.monthlyRate
    ?? null;
}

/** Modelllinie aus Berater-Backend → Händler-Karte. */
export function mapModelLineToShowcaseCard(group) {
  const match = group?.primaryMatch;
  const vehicle = match?.vehicle ?? {};
  const modelKey = group?.modelLineKey ?? vehicle.modelKey ?? vehicle.imageModel;
  const staticMeta = STATIC_BY_KEY.get(modelKey);

  return {
    id: modelKey ?? staticMeta?.id,
    modelKey: vehicle.imageModel ?? staticMeta?.modelKey ?? modelKey,
    name: group?.label ?? staticMeta?.name ?? vehicle.model ?? 'Kia',
    tagline: staticMeta?.tagline ?? '',
    rateFrom: resolveMonthlyRate(match) ?? staticMeta?.rateFrom ?? null,
    priceFrom: vehicle.cashPrice ?? staticMeta?.priceFrom ?? null,
    cleverQuote: match?.cleverQuote ?? null,
    variantCount: group?.variantCount ?? 1,
    slug: match?.slug ?? vehicle.slug ?? null,
    searchQuery: staticMeta?.searchQuery ?? `Kia ${group?.label ?? vehicle.model ?? ''}`.trim(),
    group,
    fromBackend: Boolean(group),
  };
}

export function buildShowcaseCards(modelLineGroups = []) {
  if (!modelLineGroups?.length) {
    return KIA_MODEL_WORLD.map((entry) => ({ ...entry, fromBackend: false }));
  }
  return modelLineGroups.map(mapModelLineToShowcaseCard);
}
