import { AVAILABILITY_LABELS, MARKETPLACE_SEO_LANDING_PAGES } from '../data/marketplaceVehicles.js';
import { getFeatureById } from '../data/features/featureCatalog.js';
import { hasStructuredSearchFilters } from '../services/search/intentToFilters.js';
import {
  shouldApplyBrandFilter,
  shouldApplyModelFilter,
} from '../services/search/modelIntent.js';
import {
  vehiclePassesBrandExclusion,
  vehiclePassesModelExclusion,
} from './brandResultsFilter.js';
import { enrichVehicleWithModelAttributes } from '../data/kia/kiaModelAttributes.js';
import { passesHardRules } from '../services/search/hardExclusionRules.js';

function norm(value) {
  return String(value ?? '').toLowerCase();
}

function vehicleMatchesFeature(vehicle, featureId) {
  const hay = `${vehicle.title} ${vehicle.equipment?.join(' ')} ${vehicle.bodyType} ${vehicle.powertrain}`;
  const lower = hay.toLowerCase();

  if (featureId === 'family_suv') return vehicle.bodyType === 'suv';
  if (featureId === 'elektro') return vehicle.powertrain === 'elektro';
  if (featureId === 'benzin') return vehicle.powertrain === 'verbrenner';
  if (featureId === 'seats_7') {
    const v = enrichVehicleWithModelAttributes(vehicle);
    return v.isSevenSeater || (v.seats ?? 0) >= 7;
  }
  if (featureId === 'automatic') return /automatik|dsg/i.test(lower);
  if (featureId === 'rear_camera' || featureId === 'parking_rear') {
    return /rückfahr|rückkamera|heckkamera|kamera hinten|rear camera|rückfahrkamera/i.test(lower);
  }

  const feature = getFeatureById(featureId);
  if (!feature) return true;
  const patterns = [feature.label.toLowerCase(), ...(feature.aliases ?? [])];
  return patterns.some((p) => lower.includes(p));
}

function vehicleMeetsRangeMin(vehicle, rangeKmMin) {
  if (rangeKmMin == null) return true;
  const range = vehicle.electricRangeKm ?? vehicle.rangeKm;
  if (range != null) return range >= rangeKmMin;
  if (vehicle.powertrain === 'elektro') return true;
  return false;
}

function vehicleMeetsTowMin(vehicle, towCapacityKg) {
  if (towCapacityKg == null) return true;
  const tow = vehicle.towCapacityKg;
  if (tow != null) return tow >= towCapacityKg;
  const hay = `${vehicle.title} ${vehicle.equipment?.join(' ')}`.toLowerCase();
  if (towCapacityKg <= 2000 && /anhänger|ahk|kupplung/.test(hay)) return true;
  return false;
}

function extractPowerPsFromVehicle(vehicle) {
  if (vehicle.powerPs != null) return vehicle.powerPs;
  const hay = `${vehicle.title} ${vehicle.equipment?.join(' ')}`;
  const m = hay.match(/(\d{2,3})\s*ps/i);
  return m ? Number(m[1]) : null;
}

function vehicleMeetsPowerPs(vehicle, powerPsTarget, powerPsMin, powerPsMax) {
  if (powerPsTarget == null) return true;
  const ps = extractPowerPsFromVehicle(vehicle);
  if (ps == null) return true;
  const min = powerPsMin ?? powerPsTarget - 15;
  const max = powerPsMax ?? powerPsTarget + 15;
  return ps >= min && ps <= max;
}

function vehicleMeetsTransmission(vehicle, transmission) {
  if (!transmission) return true;
  const hay = `${vehicle.title} ${vehicle.equipment?.join(' ')}`.toLowerCase();
  if (transmission === 'automatic') {
    return /automatik|dsg|cvt/i.test(hay) || !/schaltgetriebe|manuell/i.test(hay);
  }
  if (transmission === 'manual') {
    return /schalt|manuell|handgeschaltet/i.test(hay) || !/automatik|dsg|cvt/i.test(hay);
  }
  return true;
}

const POWERTRAIN_FILTER_TYPES = new Set([
  'verbrenner',
  'diesel',
  'elektro',
  'hybrid',
  'plugin-hybrid',
]);

function mapTypeForVehicle(vehicle) {
  if (vehicle.powertrain === 'elektro') return 'elektro';
  if (vehicle.powertrain === 'hybrid') return 'hybrid';
  if (vehicle.powertrain === 'plugin-hybrid') return 'plugin-hybrid';
  return vehicle.bodyType;
}

function matchesPowertrainFilter(vehicle, filterType) {
  if (!filterType) return true;
  if (filterType === 'verbrenner') {
    return vehicle.powertrain === 'verbrenner' || vehicle.powertrain === 'diesel';
  }
  return vehicle.powertrain === filterType;
}

function matchesBodyOrTypeFilter(vehicle, filterType) {
  if (!filterType || filterType === 'all') return true;
  if (POWERTRAIN_FILTER_TYPES.has(filterType)) {
    return matchesPowertrainFilter(vehicle, filterType);
  }
  const mapped = mapTypeForVehicle(vehicle);
  return mapped === filterType || vehicle.bodyType === filterType;
}

const QUERY_STOP_WORDS = new Set([
  'benziner', 'benzin', 'diesel', 'elektro', 'ev', 'hybrid', 'plugin', 'leasing',
  'finanzierung', 'neuwagen', 'auto', 'fahrzeug', 'suche', 'in', 'der', 'die', 'das',
  'und', 'mit', 'für', 'maximal', 'max', 'bis', 'monat', 'monate',
]);

function parseModelTrimFromQuery(text) {
  const lower = norm(text);
  const models = ['sportage', 'ev3', 'ev4', 'niro', 'ceed', 'sorento', 'kuga', 'tucson'];
  const trims = ['vision', 'spirit', 'gt-line', 'gt line', 'inspiration', 'air', 'st-line'];
  let model = '';
  let trim = '';
  for (const m of models) {
    if (lower.includes(m)) {
      model = m === 'ev3' ? 'ev3' : m === 'ev4' ? 'ev4' : m.charAt(0).toUpperCase() + m.slice(1);
      if (m === 'ceed') model = 'Ceed SW';
      break;
    }
  }
  for (const t of trims) {
    if (lower.includes(t)) {
      trim = t.replace('gt line', 'gt-line');
      break;
    }
  }
  return { model, trim };
}

function vehicleMatchesTextQuery(vehicle, textQ) {
  if (!textQ) return true;
  const hay = norm(
    `${vehicle.title} ${vehicle.dealerName} ${vehicle.city} ${vehicle.plz} ${vehicle.model} ${vehicle.brand} ${vehicle.powertrain}`,
  );
  const { model, trim } = parseModelTrimFromQuery(textQ);
  if (model && !hay.includes(norm(model).replace(/\s+/g, '')) && !norm(vehicle.model).includes(norm(model))) {
    return false;
  }
  if (trim && !hay.includes(norm(trim))) return false;

  const tokens = norm(textQ)
    .split(/[\s,+]+/)
    .filter((t) => t.length > 1 && !QUERY_STOP_WORDS.has(t));
  const extraTokens = tokens.filter((t) => {
    if (model && t.includes(norm(model))) return false;
    if (trim && t.includes(norm(trim))) return false;
    return true;
  });
  if (!extraTokens.length) return true;
  return extraTokens.every((t) => hay.includes(t));
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
    if (filters.fuel && !matchesPowertrainFilter(vehicle, filters.fuel)) return false;
    if (filters.type && filters.type !== 'all' && !matchesBodyOrTypeFilter(vehicle, filters.type)) {
      return false;
    }
    if (shouldApplyModelFilter(filters) && !norm(vehicle.model).includes(norm(filters.model))) {
      return false;
    }
    if (filters.modelExplicit && filters.trim && !norm(vehicle.title).includes(norm(filters.trim))) {
      return false;
    }
    if (shouldApplyBrandFilter(filters) && norm(vehicle.brand) !== norm(filters.brand)) {
      return false;
    }
    if (!vehiclePassesBrandExclusion(vehicle, filters.excludedBrands)) return false;
    if (!vehiclePassesModelExclusion(vehicle, filters.excludedModels)) return false;
    if (filters.availability && vehicle.availability !== filters.availability) return false;
    if (filters.features?.length) {
      const missing = filters.features.filter((fid) => !vehicleMatchesFeature(vehicle, fid));
      if (missing.length) return false;
    }
    if (!vehicleMeetsRangeMin(vehicle, filters.rangeKmMin)) return false;
    if (!vehicleMeetsTowMin(vehicle, filters.towCapacityKg)) return false;
    if (!vehicleMeetsTransmission(vehicle, filters.transmission)) return false;
    if (!vehicleMeetsPowerPs(vehicle, filters.powerPsTarget, filters.powerPsMin, filters.powerPsMax)) {
      return false;
    }

    if (filters.seatsMin != null) {
      const v = enrichVehicleWithModelAttributes(vehicle);
      const seats = v.seats ?? v.modelFacts?.seats ?? 5;
      if (seats < filters.seatsMin && !v.isSevenSeater) return false;
    }

    if (filters.hardRulesProfile) {
      const v = enrichVehicleWithModelAttributes(vehicle);
      if (!passesHardRules(v, filters.hardRulesProfile)) return false;
    }

    const textQ = filters.q || filters.query;
    if (textQ && !hasStructuredSearchFilters(filters) && !vehicleMatchesTextQuery(vehicle, textQ)) {
      return false;
    }
    return true;
  });
}

export function getAvailabilityMeta(code) {
  return AVAILABILITY_LABELS[code] ?? AVAILABILITY_LABELS.none;
}

const AVAILABILITY_PLAIN = {
  sofort: 'Sofort verfügbar',
  vorlauf: 'Im Vorlauf',
  bestell: 'Bestellfahrzeug',
  none: 'Verfügbarkeit auf Anfrage',
};

/** Anzeige ohne Emoji (Detailseite, Premium-Meta) */
export function getAvailabilityPlainLabel(code) {
  return AVAILABILITY_PLAIN[code] ?? AVAILABILITY_PLAIN.none;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

