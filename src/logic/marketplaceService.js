import { AVAILABILITY_LABELS, MARKETPLACE_SEO_LANDING_PAGES } from '../data/marketplaceVehicles.js';
import { getFeatureById } from '../data/features/featureCatalog.js';

function norm(value) {
  return String(value ?? '').toLowerCase();
}

function vehicleMatchesFeature(vehicle, featureId) {
  const hay = `${vehicle.title} ${vehicle.equipment?.join(' ')} ${vehicle.bodyType} ${vehicle.powertrain}`;
  const lower = hay.toLowerCase();

  if (featureId === 'family_suv') return vehicle.bodyType === 'suv';
  if (featureId === 'elektro') return vehicle.powertrain === 'elektro';
  if (featureId === 'benzin') return vehicle.powertrain === 'verbrenner';
  if (featureId === 'automatic') return /automatik|dsg/i.test(lower);

  const feature = getFeatureById(featureId);
  if (!feature) return true;
  const patterns = [feature.label.toLowerCase(), ...(feature.aliases ?? [])];
  return patterns.some((p) => lower.includes(p));
}

function mapTypeForVehicle(vehicle) {
  if (vehicle.powertrain === 'elektro') return 'elektro';
  if (vehicle.powertrain === 'hybrid') return 'hybrid';
  if (vehicle.powertrain === 'plugin-hybrid') return 'plugin-hybrid';
  return vehicle.bodyType;
}

export function parseMarketplaceQuery(searchParams) {
  const radius = searchParams.get('radius');
  const maxRate = searchParams.get('maxRate');
  const maxPrice = searchParams.get('maxPrice');
  return {
    q: searchParams.get('q') ?? '',
    radius: radius ? Number(radius) : null,
    maxRate: maxRate ? Number(maxRate) : null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    type: searchParams.get('type') ?? 'all',
    seo: searchParams.get('seo') ?? '',
    model: searchParams.get('model') ?? '',
  };
}

export function buildMarketplaceSearch({ q, radius, maxRate, maxPrice, type, seo, model }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (radius != null) params.set('radius', String(radius));
  if (maxRate != null) params.set('maxRate', String(maxRate));
  if (maxPrice != null) params.set('maxPrice', String(maxPrice));
  if (type && type !== 'all') params.set('type', type);
  if (seo) params.set('seo', seo);
  if (model) params.set('model', model);
  return params.toString();
}

export function applySeoPreset(filters) {
  if (!filters.seo) return filters;
  const preset = MARKETPLACE_SEO_LANDING_PAGES.find((item) => item.slug === filters.seo);
  if (!preset) return filters;
  return {
    ...filters,
    ...preset.query,
  };
}

export function filterMarketplaceVehicles(vehicles, initialFilters) {
  const filters = applySeoPreset(initialFilters);
  return vehicles.filter((vehicle) => {
    if (filters.radius != null && vehicle.distanceKm > filters.radius) return false;
    if (filters.maxRate != null && vehicle.monthlyRate > filters.maxRate) return false;
    if (filters.maxPrice != null && vehicle.cashPrice > filters.maxPrice) return false;
    if (filters.fuel) {
      const mapped = mapTypeForVehicle(vehicle);
      if (mapped !== filters.fuel && vehicle.powertrain !== filters.fuel) return false;
    }
    if (filters.type && filters.type !== 'all') {
      const mapped = mapTypeForVehicle(vehicle);
      if (mapped !== filters.type && vehicle.bodyType !== filters.type) return false;
    }
    if (filters.model && !norm(vehicle.model).includes(norm(filters.model))) return false;
    if (filters.trim && !norm(vehicle.title).includes(norm(filters.trim))) return false;
    if (filters.brand && norm(vehicle.brand) !== norm(filters.brand)) return false;
    if (filters.availability && vehicle.availability !== filters.availability) return false;
    if (filters.features?.length) {
      const missing = filters.features.filter((fid) => !vehicleMatchesFeature(vehicle, fid));
      if (missing.length) return false;
    }
    const textQ = filters.q || filters.query;
    if (textQ) {
      const hay = `${vehicle.title} ${vehicle.dealerName} ${vehicle.city} ${vehicle.plz} ${vehicle.model}`;
      if (!norm(hay).includes(norm(textQ))) return false;
    }
    return true;
  });
}

export function getAvailabilityMeta(code) {
  return AVAILABILITY_LABELS[code] ?? AVAILABILITY_LABELS.none;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

