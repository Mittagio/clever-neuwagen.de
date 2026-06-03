/**
 * Strukturierte Suchabsicht → Marketplace-Filter & URL
 */

import { DEFAULT_LOCATION_RADIUS_KM } from '../../logic/advisorLocation.js';
import { parseLocationFromText } from '../../logic/advisorLocation.js';

const FUEL_TO_FILTER = {
  elektro: 'elektro',
  hybrid: 'hybrid',
  plugin_hybrid: 'plugin-hybrid',
  'plugin-hybrid': 'plugin-hybrid',
  verbrenner: 'verbrenner',
  benzin: 'verbrenner',
  diesel: 'diesel',
};

const PAYMENT_TO_FILTER = {
  leasing: 'leasing',
  cash: 'cash',
  finance: 'finance',
  financing: 'finance',
};

const AVAILABILITY_TO_FILTER = {
  sofort_verfuegbar: 'sofort',
};

export function hasStructuredSearchFilters(filters) {
  return Boolean(
    filters.intentStructured
    || filters.fuel
    || filters.model
    || filters.brand
    || filters.trim
    || filters.maxRate != null
    || filters.maxPrice != null
    || filters.availability
    || filters.rangeKmMin != null
    || filters.towCapacityKg != null
    || filters.transmission
    || filters.powerPsTarget != null
    || (filters.features?.length > 0),
  );
}

/**
 * @param {ReturnType<import('./searchIntentParser.js').parseSearchIntent>} intent
 */
export function intentToMarketplaceFilters(intent, overrides = {}) {
  const loc = intent.location ? parseLocationFromText(intent.rawQuery) : null;

  const features = [...(intent.features ?? [])];
  if (intent.transmission === 'automatic' && !features.includes('automatic')) {
    features.push('automatic');
  }
  if (intent.fuel === 'elektro' && intent.rangeKmMin && !features.includes('reichweite')) {
    features.push('reichweite');
  }

  const filters = {
    query: intent.rawQuery,
    maxRate: intent.maxRate ?? null,
    maxPrice: intent.maxPrice ?? null,
    type: intent.bodyType ?? intent.fuel === 'elektro' ? 'elektro' : (overrides.type ?? 'all'),
    fuel: FUEL_TO_FILTER[intent.fuel] ?? '',
    payment: PAYMENT_TO_FILTER[intent.payment] ?? '',
    model: intent.modelExplicit ? (intent.model ?? '') : '',
    trim: intent.modelExplicit ? (intent.trim ?? '') : '',
    brand: intent.modelExplicit ? (intent.brand ?? '') : '',
    modelExplicit: Boolean(intent.modelExplicit),
    excludedBrands: [],
    excludedModels: [],
    availability: AVAILABILITY_TO_FILTER[intent.availability] ?? '',
    city: loc?.city ?? '',
    plz: loc?.plz ?? '',
    locLabel: loc?.city || loc?.plz || intent.location || '',
    locSkip: false,
    radius: intent.radiusKm ?? (loc ? DEFAULT_LOCATION_RADIUS_KM : null),
    household: '',
    termMonths: intent.durationMonths ?? 48,
    mileagePerYear: intent.mileagePerYear ?? 10000,
    sort: 'best',
    seo: '',
    features,
    rangeKmMin: intent.rangeKmMin ?? null,
    towCapacityKg: intent.towCapacityKg ?? null,
    transmission: intent.transmission ?? '',
    seatsMin: intent.seatsMin ?? null,
    powerPsTarget: intent.powerPsTarget ?? null,
    powerPsMin: intent.powerPsMin ?? null,
    powerPsMax: intent.powerPsMax ?? null,
    intentStructured: true,
    searchConfidence: intent.confidence ?? 0,
    ambiguousTerms: intent.ambiguousTerms ?? [],
    ...overrides,
  };

  if (intent.fuel === 'elektro' && filters.type === 'all') {
    filters.type = 'elektro';
  }

  return filters;
}

import { createEditableChips } from './chipConfig.js';

/** Chips aus strukturierter Absicht (nicht lose Textteile) */
export function buildChipsFromIntent(intent, filters = {}) {
  return createEditableChips(intent, filters);
}
