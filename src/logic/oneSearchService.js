import { parseLandingQuery } from '../services/landingAdvisorBridge.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../services/search/intentToFilters.js';
import { mergeUrlFiltersWithPipeline } from '../services/search/searchPipeline.js';
import {
  DEFAULT_LOCATION_RADIUS_KM,
  getLocationDisplayLabel,
  parseAdvisorLocationFromParams,
} from './advisorLocation.js';
import { buildOfferPath } from './offerService.js';
import { scoreLocalOffer } from './localOfferPresentation.js';

import {
  buildTermMonthValues,
  buildMileageKmValues,
} from '../services/search/leasingRangeOptions.js';
import { parseExcludedBrandsParam, parseExcludedModelsParam } from './brandResultsFilter.js';
import { normalizeCustomerTermMonths } from '../services/search/leasingRangeOptions.js';
import { buildFahrzeugeSearchUrl } from './fahrzeugeSearchUrl.js';

export { buildFahrzeugeSearchUrl };

export const TERM_CHIP_OPTIONS = buildTermMonthValues();
export const MILEAGE_CHIP_OPTIONS = buildMileageKmValues();
export const REFINE_MILEAGE_OPTIONS = buildMileageKmValues();
export const RADIUS_CHIP_OPTIONS = [
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: null, label: 'Deutschlandweit' },
];
export const REFINE_RADIUS_OPTIONS = [
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];
export const SORT_CHIP_OPTIONS = [
  { id: 'best', label: 'Empfehlung in der Nähe' },
  { id: 'nearest', label: 'Nächste Händler' },
  { id: 'available', label: 'Sofort verfügbar' },
  { id: 'discount', label: 'Rabatt (optional)' },
];
export const REFINE_SORT_OPTIONS = [
  { id: 'best', label: 'Empfehlung in der Nähe' },
  { id: 'nearest', label: 'Nächste Händler' },
  { id: 'available', label: 'Sofort verfügbar' },
];

const FUEL_LABELS = {
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  verbrenner: 'Benziner',
  'plugin-hybrid': 'Plug-in Hybrid',
};

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
};

function parseModelTrim(text) {
  const lower = text.toLowerCase();
  const models = ['sportage', 'ev3', 'ev4', 'niro', 'ceed', 'sorento', 'kuga'];
  const trims = ['vision', 'spirit', 'gt-line', 'inspiration', 'air'];
  let model = '';
  let trim = '';
  for (const m of models) {
    if (lower.includes(m)) {
      model = m.charAt(0).toUpperCase() + m.slice(1);
      if (m === 'ev3') model = 'EV3';
      if (m === 'ev4') model = 'EV4';
      break;
    }
  }
  for (const t of trims) {
    if (lower.includes(t)) {
      trim = t.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
      if (t === 'gt-line') trim = 'GT-line';
      break;
    }
  }
  return { model, trim };
}

export function parseNaturalLanguageSearch(text) {
  const intent = parseSearchIntent(text);
  const filters = intentToMarketplaceFilters(intent);
  const parsed = parseLandingQuery(text);
  return {
    ...parsed,
    intent,
    filters,
    model: filters.model || undefined,
    trim: filters.trim || undefined,
    location: filters.city || filters.plz
      ? { city: filters.city, plz: filters.plz, radiusKm: filters.radius }
      : parsed.location,
  };
}

export function filtersFromSearchParams(searchParams) {
  const radius = searchParams.get('radius');
  const maxRate = searchParams.get('maxRate');
  const maxPrice = searchParams.get('maxPrice');
  const termMonths = searchParams.get('term');
  const mileagePerYear = searchParams.get('mileageYear');
  const { location, skipped } = parseAdvisorLocationFromParams(searchParams);

  return {
    query: searchParams.get('query') ?? searchParams.get('q') ?? '',
    city: searchParams.get('city') ?? location?.city ?? '',
    plz: searchParams.get('plz') ?? location?.plz ?? '',
    locLabel: searchParams.get('locLabel') ?? location?.label ?? '',
    locSkip: skipped || searchParams.get('locSkip') === '1',
    radius: radius ? Number(radius) : (location ? DEFAULT_LOCATION_RADIUS_KM : null),
    maxRate: maxRate ? Number(maxRate) : null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    type: searchParams.get('type') ?? 'all',
    fuel: searchParams.get('fuel') ?? '',
    payment: searchParams.get('payment') ?? '',
    model: searchParams.get('model') ?? '',
    trim: searchParams.get('trim') ?? '',
    household: searchParams.get('household') ?? '',
    termMonths: normalizeCustomerTermMonths(termMonths ? Number(termMonths) : 48),
    mileagePerYear: mileagePerYear ? Number(mileagePerYear) : 10000,
    sort: searchParams.get('sort') ?? 'best',
    seo: searchParams.get('seo') ?? '',
    brand: searchParams.get('brand') ?? '',
    availability: searchParams.get('availability') ?? '',
    features: (searchParams.get('features') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    rangeKmMin: searchParams.get('rangeKm') ? Number(searchParams.get('rangeKm')) : null,
    towCapacityKg: searchParams.get('towKg') ? Number(searchParams.get('towKg')) : null,
    transmission: searchParams.get('transmission') ?? '',
    intentStructured: searchParams.get('structured') === '1',
    powerPsTarget: searchParams.get('powerPs') ? Number(searchParams.get('powerPs')) : null,
    powerPsMin: searchParams.get('powerPsMin') ? Number(searchParams.get('powerPsMin')) : null,
    powerPsMax: searchParams.get('powerPsMax') ? Number(searchParams.get('powerPsMax')) : null,
    modelExplicit: Boolean(searchParams.get('model')?.trim()),
    excludedBrands: parseExcludedBrandsParam(searchParams.get('excludeBrand')),
    excludedModels: parseExcludedModelsParam(searchParams.get('excludeModel')),
    useCase: searchParams.get('useCase') ?? '',
    dealer: searchParams.get('dealer') ?? '',
    termMonthsExplicit: searchParams.has('term'),
    mileagePerYearExplicit: searchParams.has('mileageYear'),
  };
}

export function buildFahrzeugeUrlFromText(text) {
  const intent = parseSearchIntent(text);
  const filters = intentToMarketplaceFilters(intent, {
    household: inferHouseholdFromQuery(text),
  });
  return buildFahrzeugeSearchUrl(filters);
}

/** Intent aus URL-Filtern + Query rehydrieren (URL-Parameter gewinnen) */
export function resolveFiltersWithIntent(urlFilters) {
  if (!urlFilters.query?.trim()) return urlFilters;
  return mergeUrlFiltersWithPipeline(urlFilters);
}

function mileageFromProfile(mileageId) {
  if (mileageId === '15k-20k') return 20000;
  if (mileageId === '10k-15k') return 15000;
  if (mileageId === 'over-20k') return 30000;
  return 10000;
}

function inferHouseholdFromQuery(query) {
  const q = (query ?? '').toLowerCase();
  if (/hund|hunde|dog/.test(q)) return 'family-dog';
  if (/familie|kinder|kind|baby/.test(q)) return 'family';
  return '';
}

export function buildLifestyleSummaryChips(filters) {
  const chips = [];
  const q = filters.query ?? '';
  const household = filters.household || inferHouseholdFromQuery(q);

  if (household === 'family' || household === 'family-dog' || /familie|kinder/.test(q.toLowerCase())) {
    chips.push({ id: 'family', label: 'Familie', emoji: '👨‍👩‍👧', field: 'household' });
  }
  if (household === 'family-dog' || /hund|hunde/.test(q.toLowerCase())) {
    chips.push({ id: 'dog', label: 'Hund', emoji: '🐶', field: 'dog' });
  }
  if (filters.mileagePerYear) {
    chips.push({
      id: 'mileageYear',
      label: `${filters.mileagePerYear.toLocaleString('de-DE')} km/Jahr`,
      emoji: '🚗',
      field: 'mileagePerYear',
    });
  }
  if (filters.city || filters.plz) {
    const loc = getLocationDisplayLabel({ city: filters.city, plz: filters.plz, label: filters.locLabel })
      || filters.city
      || filters.plz;
    chips.push({ id: 'location', label: loc, emoji: '📍', field: 'location' });
  }
  if (filters.maxRate) {
    chips.push({
      id: 'maxRate',
      label: `bis ${filters.maxRate} €/Monat`,
      emoji: '💶',
      field: 'maxRate',
    });
  }
  if (filters.model && chips.length < 2) {
    chips.push({ id: 'model', label: filters.model, emoji: '🚗', field: 'model' });
  }
  if (filters.fuel && chips.length < 3) {
    chips.push({
      id: 'fuel',
      label: FUEL_LABELS[filters.fuel] ?? filters.fuel,
      emoji: '⚡',
      field: 'fuel',
    });
  }

  return chips;
}

/** Kompakte einzeilige Suchzusammenfassung (Sprint 15/16) */
export function buildCompactSearchSummaryChips(filters, { locationLabel = '', localized = false } = {}) {
  const chips = [];
  const q = (filters.query ?? '').toLowerCase();
  const household = filters.household || inferHouseholdFromQuery(q);

  if (localized && locationLabel) {
    const radiusPart = filters.radius != null ? `${filters.radius} km` : 'Deutschlandweit';
    chips.push({
      id: 'location',
      emoji: '📍',
      label: `${locationLabel} · ${radiusPart}`,
      field: 'location',
    });
  } else {
    chips.push({
      id: 'location',
      emoji: '📍',
      label: 'Deutschlandweit',
      field: 'location',
    });
  }

  if (filters.maxRate) {
    chips.push({
      id: 'maxRate',
      emoji: '🚗',
      label: `Leasing bis ${filters.maxRate} €`,
      field: 'maxRate',
    });
  }

  if (filters.fuel) {
    chips.push({
      id: 'fuel',
      emoji: '⛽',
      label: FUEL_LABELS[filters.fuel] ?? filters.fuel,
      field: 'fuel',
    });
  } else if (/benzin|verbrenner/i.test(q)) {
    chips.push({ id: 'fuel', emoji: '⛽', label: 'Benziner', field: 'fuel' });
  } else if (/diesel/i.test(q)) {
    chips.push({ id: 'fuel', emoji: '⛽', label: 'Diesel', field: 'fuel' });
  } else if (/elektro|ev\b/i.test(q)) {
    chips.push({ id: 'fuel', emoji: '⛽', label: 'Elektro', field: 'fuel' });
  }

  if (household === 'family' || household === 'family-dog' || /familie|kinder/i.test(q)) {
    chips.push({ id: 'family', emoji: '👨‍👩‍👧', label: 'Familie', field: 'family' });
  }

  if (filters.model && chips.length < 5) {
    chips.push({ id: 'model', emoji: '🚗', label: filters.model, field: 'model' });
  }

  return chips.slice(0, 5);
}

export function buildUnderstandingChips(filters) {
  const chips = [];

  if (filters.model) chips.push({ id: 'model', label: filters.model, field: 'model' });
  if (filters.trim) chips.push({ id: 'trim', label: filters.trim, field: 'trim' });
  if (filters.fuel) {
    chips.push({ id: 'fuel', label: FUEL_LABELS[filters.fuel] ?? filters.fuel, field: 'fuel' });
  }
  if (filters.payment) {
    chips.push({ id: 'payment', label: PAYMENT_LABELS[filters.payment] ?? filters.payment, field: 'payment' });
  }
  if (filters.maxRate) chips.push({ id: 'maxRate', label: `bis ${filters.maxRate} €`, field: 'maxRate' });
  if (filters.mileagePerYear) {
    chips.push({
      id: 'mileageYear',
      label: `${filters.mileagePerYear.toLocaleString('de-DE')} km`,
      field: 'mileagePerYear',
    });
  }
  if (filters.city || filters.plz) {
    const loc = getLocationDisplayLabel({ city: filters.city, plz: filters.plz, label: filters.locLabel })
      || filters.city
      || filters.plz;
    const r = filters.radius ?? DEFAULT_LOCATION_RADIUS_KM;
    chips.push({ id: 'location', label: loc, field: 'location', meta: { radius: r } });
  }
  if (filters.type && filters.type !== 'all' && !filters.fuel) {
    chips.push({ id: 'type', label: filters.type.toUpperCase(), field: 'type' });
  }

  return chips;
}

export function needsLocationPrompt(filters) {
  if (filters.locSkip) return false;
  return !filters.city && !filters.plz && !filters.locLabel;
}

export function hasLocalizedSearch(filters) {
  return !!(filters.city || filters.plz || filters.locLabel);
}

export function formatLocalizedRadiusLabel(radiusKm) {
  if (radiusKm == null) return 'Deutschlandweit';
  return `${radiusKm} km Radius`;
}

export function sortMarketplaceVehicles(vehicles, sortId) {
  const list = [...vehicles];
  if (sortId === 'nearest') {
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  if (sortId === 'available') {
    const rank = { sofort: 0, vorlauf: 1, bestell: 2 };
    return list.sort((a, b) => (rank[a.availability] ?? 9) - (rank[b.availability] ?? 9));
  }
  if (sortId === 'discount') {
    return list.sort((a, b) => b.discountPercent - a.discountPercent);
  }
  return list.sort((a, b) => scoreLocalOffer(b) - scoreLocalOffer(a));
}

export function adjustRateForTerm(monthlyRate, termMonths = 48) {
  const factor = termMonths === 36 ? 1.08 : termMonths === 60 ? 0.92 : 1;
  return Math.round(monthlyRate * factor);
}

export function getVehicleOfferPath(vehicle) {
  if (vehicle.offerCode) return buildOfferPath(vehicle.offerCode);
  return `/fahrzeug/${vehicle.slug}`;
}
