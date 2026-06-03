import { brandToFilterId, includeBrand } from '../../logic/brandResultsFilter.js';

/**
 * Konflikte in der Suchabsicht (z. B. EV3 als Benziner)
 */

const ELECTRIC_ONLY_MODELS = [
  { brand: 'Kia', model: 'EV3', patterns: ['ev3', 'ev 3'] },
  { brand: 'Kia', model: 'EV4', patterns: ['ev4', 'ev 4'] },
  { brand: 'Kia', model: 'EV5', patterns: ['ev5', 'ev 5'] },
  { brand: 'Kia', model: 'Niro EV', patterns: ['niro ev', 'niro'] },
];

function queryImpliesBenziner(query, fuel) {
  const q = String(query ?? '').toLowerCase();
  return fuel === 'verbrenner'
    || /benzin|benziner|otto|verbrenner/.test(q);
}

function queryImpliesElektro(query, fuel) {
  const q = String(query ?? '').toLowerCase();
  return fuel === 'elektro' || /elektro|e-auto|ev\b|stromer/.test(q);
}

/**
 * @param {ReturnType<import('./searchIntentParser.js').parseSearchIntent>} intent
 */
export function detectSearchConflict(intent) {
  const q = intent.rawQuery ?? '';
  const model = intent.model;
  const brand = intent.brand;

  if (model) {
    for (const entry of ELECTRIC_ONLY_MODELS) {
      const matchesModel = entry.model === model
        || entry.patterns.some((p) => q.toLowerCase().includes(p));
      const brandOk = !brand || brand === entry.brand;
      if (matchesModel && brandOk && queryImpliesBenziner(q, intent.fuel)) {
        return {
          type: 'model_fuel_mismatch',
          title: 'Kombination passt nicht zusammen',
          message: `Den ${entry.brand} ${entry.model} gibt es nicht als Benziner. Wir zeigen passende Alternativen.`,
          modelLabel: `${entry.brand} ${entry.model}`,
          clearModelLock: true,
        };
      }
    }
  }

  if (queryImpliesElektro(q, intent.fuel) && queryImpliesBenziner(q, intent.fuel)) {
    return {
      type: 'fuel_dual',
      title: 'Antrieb unklar',
      message: 'Elektro und Benziner gleichzeitig passt nicht – wir zeigen passende E-Autos.',
      clearModelLock: false,
    };
  }

  return null;
}

/** Gesuchtes Modell gehört zu ausgeblendeter Marke (z. B. Sportage + excludeBrand=kia) */
export function detectBrandExclusionConflict(filters) {
  const excluded = filters.excludedBrands ?? [];
  if (!excluded.length) return null;

  const brand = filters.brand;
  const model = filters.model;
  const brandId = brand ? brandToFilterId(brand) : null;

  if (brandId && excluded.includes(brandId)) {
    return {
      type: 'brand_excluded_vs_search',
      brandLabel: brand,
      resolveBrandId: brandId,
    };
  }

  if (model && excluded.includes('kia') && /sportage|ev3|picanto|ceed|niro|sorento/i.test(model)) {
    return {
      type: 'brand_excluded_vs_search',
      brandLabel: 'Kia',
      resolveBrandId: 'kia',
    };
  }

  const allExcluded = filters._catalogBrandCount > 0
    && excluded.length >= filters._catalogBrandCount;
  if (allExcluded) {
    return {
      type: 'all_brands_excluded',
      title: 'Alle Marken ausgeblendet',
      message: 'Sie haben alle Marken in Ihrer Suche ausgeblendet. Blenden Sie mindestens eine Marke ein.',
      clearAllExclusions: true,
    };
  }

  return null;
}

export function mergeSearchConflicts(intentConflict, filters) {
  const excluded = filters.excludedBrands ?? [];
  const catalogCount = filters._catalogBrandCount ?? 0;
  if (catalogCount > 0 && excluded.length >= catalogCount) {
    return {
      type: 'all_brands_excluded',
      clearAllExclusions: true,
    };
  }
  return intentConflict ?? filters.searchConflict ?? null;
}

export function applyConflictToFilters(filters, conflict) {
  if (!conflict) return filters;
  if (conflict.type === 'brand_excluded_vs_search' || conflict.type === 'all_brands_excluded') {
    return { ...filters, searchConflict: conflict };
  }
  if (!conflict.clearModelLock) {
    return { ...filters, searchConflict: conflict };
  }
  return {
    ...filters,
    model: '',
    brand: '',
    trim: '',
    modelExplicit: false,
    searchConflict: conflict,
  };
}

export function resolveSearchConflict(filters, conflict) {
  if (!conflict) return filters;
  if (conflict.resolveBrandId) {
    return {
      ...filters,
      excludedBrands: includeBrand(filters.excludedBrands, conflict.resolveBrandId),
      searchConflict: null,
    };
  }
  if (conflict.clearAllExclusions) {
    return { ...filters, excludedBrands: [], excludedModels: [], searchConflict: null };
  }
  return applyConflictToFilters(filters, conflict);
}
