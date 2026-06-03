import { brandToFilterId } from './brandResultsFilter.js';
import { filterMarketplaceVehicles } from './marketplaceService.js';
import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';
import { adjustRateForTerm } from './oneSearchService.js';

export function isBrandExclusionConflict(conflict) {
  return conflict?.type === 'brand_excluded_vs_search';
}

/**
 * Verkäufer-Microcopy für ausgeblendete Suchmarke
 */
export function buildBrandExclusionConflictCopy(filters, conflict) {
  const brandLabel = conflict?.brandLabel
    ?? (conflict?.resolveBrandId === 'kia' ? 'Kia' : filters.brand)
    ?? 'Diese Marke';
  const model = filters.model;
  const trim = filters.trim;

  const vehiclePhrase = model
    ? trim
      ? `${brandLabel} ${model} ${trim}`
      : `${brandLabel} ${model}`
    : brandLabel;

  const headline = `${brandLabel} ist aktuell ausgeblendet`;

  const subline = model
    ? `Sie suchen nach einem ${vehiclePhrase}, haben ${brandLabel} aber aus den Ergebnissen entfernt.`
    : `Sie haben ${brandLabel} aus den Ergebnissen entfernt – für Ihre Suche wäre ${brandLabel} aber relevant.`;

  const primaryLabel = `${brandLabel} wieder anzeigen`;
  const isEvSearch = filters.fuel === 'elektro'
    || /^(ev\d|niro ev|e-tech)/i.test(model ?? '')
    || /elektro|e-auto/i.test(filters.query ?? '');
  const secondaryLabel = isEvSearch
    ? 'Ähnliche E-Autos anderer Marken zeigen'
    : 'Alternativen anderer Marken zeigen';

  return {
    headline,
    subline,
    primaryLabel,
    secondaryLabel,
    tertiaryLabel: 'Suche anpassen',
    modelName: model,
    brandLabel,
    resolveBrandId: conflict?.resolveBrandId ?? brandToFilterId(brandLabel),
  };
}

/**
 * Alternativen ohne ausgeblendete Marke(n), ähnliches Segment
 */
export function buildCrossBrandAlternatives({
  allVehicles,
  filters,
  wishes,
  conflict,
  limit = 6,
}) {
  const excluded = new Set(filters.excludedBrands ?? []);
  const excludedBrandId = conflict?.resolveBrandId;

  const pool = filterMarketplaceVehicles(allVehicles, {
    ...filters,
    model: '',
    brand: '',
    trim: '',
    modelExplicit: false,
  }).filter((v) => {
    const bid = brandToFilterId(v.brand);
    if (excluded.has(bid)) return false;
    if (excludedBrandId && bid === excludedBrandId) return false;
    return true;
  });

  const prepared = pool.map((v) => ({
    ...v,
    displayRate: adjustRateForTerm(v.monthlyRate, filters.termMonths),
  }));

  const ranked = matchVehiclesToWish({
    wishes: { ...wishes, model: null, brand: null },
    vehicles: prepared,
    getDisplayRate: (v) => v.displayRate,
  });

  const seen = new Set();
  const out = [];
  for (const m of ranked) {
    const key = m.vehicleId ?? m.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

export function crossBrandAlternativesHeadline(modelName) {
  if (modelName) {
    return {
      title: 'Alternativen anderer Marken',
      subtitle: `Diese Fahrzeuge sind dem ${modelName} ähnlich.`,
    };
  }
  return {
    title: 'Alternativen anderer Marken',
    subtitle: 'Diese Fahrzeuge passen zu Ihrer Suche – ohne die ausgeblendeten Marken.',
  };
}
