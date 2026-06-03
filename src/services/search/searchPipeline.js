/**
 * Nordstern-Pipeline: Normalizer → Intent → Plausibilität → strukturierte Filter
 */

import { parseSearchIntent } from './searchIntentParser.js';
import { checkSearchPlausibility } from './plausibilityChecker.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';

/**
 * @param {string} rawQuery
 * @param {object} [urlOverrides] – explizite URL/Chips überschreiben Parser
 */
export function runSearchPipeline(rawQuery, urlOverrides = {}) {
  const intent = parseSearchIntent(rawQuery ?? '');
  const plausibility = checkSearchPlausibility(intent);

  const mergedIntent = {
    ...intent,
    ...plausibility.intentPatches,
    warnings: plausibility.warnings,
    possibleCorrections: [
      ...mapFuzzyToCorrections(intent),
      ...plausibility.possibleCorrections,
    ],
  };

  const fromIntent = intentToMarketplaceFilters(mergedIntent);

  const filters = {
    ...fromIntent,
    ...stripMeta(urlOverrides),
    query: rawQuery ?? urlOverrides.query ?? '',
    intentStructured: true,
    searchWarnings: plausibility.warnings,
    searchCorrections: mergedIntent.possibleCorrections,
  };

  return {
    intent: mergedIntent,
    filters,
    plausibility,
  };
}

function stripMeta(obj) {
  const { searchWarnings, searchCorrections, ...rest } = obj;
  return rest;
}

function mapFuzzyToCorrections(intent) {
  return (intent.fuzzySuggestions ?? []).map((s) => ({
    field: 'feature',
    original: s.raw,
    suggestion: s.label,
    reason: 'Automatisch erkannt',
    requiresChoice: false,
    autoApplied: true,
  }));
}

export function mergeUrlFiltersWithPipeline(urlFilters) {
  const pipeline = runSearchPipeline(urlFilters.query ?? '', urlFilters);
  return {
    ...pipeline.filters,
    ...stripMeta(urlFilters),
    query: urlFilters.query ?? '',
    features: urlFilters.features?.length ? urlFilters.features : pipeline.filters.features,
    maxRate: urlFilters.maxRate ?? pipeline.filters.maxRate,
    maxPrice: urlFilters.maxPrice ?? pipeline.filters.maxPrice,
    fuel: urlFilters.fuel || pipeline.filters.fuel,
    model: urlFilters.model || (pipeline.filters.modelExplicit ? pipeline.filters.model : ''),
    trim: urlFilters.trim || (pipeline.filters.modelExplicit ? pipeline.filters.trim : ''),
    brand: urlFilters.brand || (pipeline.filters.modelExplicit ? pipeline.filters.brand : ''),
    modelExplicit: Boolean(urlFilters.model) || pipeline.filters.modelExplicit,
    excludedBrands: urlFilters.excludedBrands ?? pipeline.filters.excludedBrands ?? [],
    excludedModels: urlFilters.excludedModels ?? pipeline.filters.excludedModels ?? [],
    availability: urlFilters.availability || pipeline.filters.availability,
    type: urlFilters.type && urlFilters.type !== 'all' ? urlFilters.type : pipeline.filters.type,
    powerPsTarget: urlFilters.powerPsTarget ?? pipeline.filters.powerPsTarget,
    powerPsMin: urlFilters.powerPsMin ?? pipeline.filters.powerPsMin,
    powerPsMax: urlFilters.powerPsMax ?? pipeline.filters.powerPsMax,
    rangeKmMin: urlFilters.rangeKmMin ?? pipeline.filters.rangeKmMin,
    towCapacityKg: urlFilters.towCapacityKg ?? pipeline.filters.towCapacityKg,
    transmission: urlFilters.transmission || pipeline.filters.transmission,
    searchWarnings: pipeline.intent.warnings,
    searchCorrections: pipeline.intent.possibleCorrections,
    intentStructured: true,
  };
}
