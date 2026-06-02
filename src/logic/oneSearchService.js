import { parseLandingQuery, parseAdvisorUrlProfile } from '../services/landingAdvisorBridge.js';
import {
  DEFAULT_LOCATION_RADIUS_KM,
  getLocationDisplayLabel,
  parseAdvisorLocationFromParams,
} from './advisorLocation.js';
import { buildOfferPath } from './offerService.js';

export const TERM_CHIP_OPTIONS = [36, 48, 60];
export const MILEAGE_CHIP_OPTIONS = [10000, 15000, 20000, 25000, 30000];
export const RADIUS_CHIP_OPTIONS = [
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: null, label: 'Deutschlandweit' },
];
export const SORT_CHIP_OPTIONS = [
  { id: 'best', label: 'Beste Angebote' },
  { id: 'nearest', label: 'Nächste Händler' },
  { id: 'available', label: 'Sofort verfügbar' },
  { id: 'discount', label: 'Höchster Rabatt' },
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
  const parsed = parseLandingQuery(text);
  const { model, trim } = parseModelTrim(text);
  return {
    ...parsed,
    model: model || undefined,
    trim: trim || undefined,
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
    type: searchParams.get('type') ?? searchParams.get('fuel') ?? 'all',
    fuel: searchParams.get('fuel') ?? '',
    payment: searchParams.get('payment') ?? '',
    model: searchParams.get('model') ?? '',
    trim: searchParams.get('trim') ?? '',
    household: searchParams.get('household') ?? '',
    termMonths: termMonths ? Number(termMonths) : 48,
    mileagePerYear: mileagePerYear ? Number(mileagePerYear) : 10000,
    sort: searchParams.get('sort') ?? 'best',
    seo: searchParams.get('seo') ?? '',
  };
}

export function buildFahrzeugeSearchUrl(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.city) params.set('city', filters.city);
  if (filters.plz) params.set('plz', filters.plz);
  if (filters.locLabel) params.set('locLabel', filters.locLabel);
  if (filters.locSkip) params.set('locSkip', '1');
  if (filters.radius != null) params.set('radius', String(filters.radius));
  if (filters.maxRate != null) params.set('maxRate', String(filters.maxRate));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.fuel) params.set('fuel', filters.fuel);
  if (filters.payment) params.set('payment', filters.payment);
  if (filters.model) params.set('model', filters.model);
  if (filters.trim) params.set('trim', filters.trim);
  if (filters.termMonths && filters.termMonths !== 48) params.set('term', String(filters.termMonths));
  if (filters.mileagePerYear && filters.mileagePerYear !== 10000) {
    params.set('mileageYear', String(filters.mileagePerYear));
  }
  if (filters.sort && filters.sort !== 'best') params.set('sort', filters.sort);
  if (filters.seo) params.set('seo', filters.seo);
  const qs = params.toString();
  return `/fahrzeuge${qs ? `?${qs}` : ''}`;
}

export function buildFahrzeugeUrlFromText(text) {
  const parsed = parseNaturalLanguageSearch(text);
  const filters = {
    query: parsed.query,
    maxRate: parsed.profile.desiredRate ?? null,
    maxPrice: null,
    type: parsed.profile.bodyType ?? parsed.profile.fuelPreference ?? 'all',
    fuel: parsed.profile.fuelPreference ?? '',
    payment: parsed.profile.paymentType ?? '',
    model: parsed.model ?? '',
    trim: parsed.trim ?? '',
    city: parsed.location?.city ?? '',
    plz: parsed.location?.plz ?? '',
    radius: parsed.location?.radiusKm ?? (parsed.location ? DEFAULT_LOCATION_RADIUS_KM : null),
    termMonths: 48,
    mileagePerYear: mileageFromProfile(parsed.profile.mileage),
    sort: 'best',
    locSkip: false,
  };
  return buildFahrzeugeSearchUrl(filters);
}

function mileageFromProfile(mileageId) {
  if (mileageId === '15k-20k') return 20000;
  if (mileageId === '10k-15k') return 15000;
  if (mileageId === 'over-20k') return 30000;
  return 10000;
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
  return list.sort((a, b) => {
    const scoreA = a.discountPercent * 2 - a.distanceKm * 0.05 - a.monthlyRate * 0.01;
    const scoreB = b.discountPercent * 2 - b.distanceKm * 0.05 - b.monthlyRate * 0.01;
    return scoreB - scoreA;
  });
}

export function adjustRateForTerm(monthlyRate, termMonths = 48) {
  const factor = termMonths === 36 ? 1.08 : termMonths === 60 ? 0.92 : 1;
  return Math.round(monthlyRate * factor);
}

export function getVehicleOfferPath(vehicle) {
  if (vehicle.offerCode) return buildOfferPath(vehicle.offerCode);
  return `/fahrzeug/${vehicle.slug}`;
}

export function advisorParamsToFahrzeugeUrl(searchParams) {
  const profile = parseAdvisorUrlProfile(searchParams);
  const { location, skipped } = parseAdvisorLocationFromParams(searchParams);
  const q = searchParams.get('q') ?? '';

  return buildFahrzeugeSearchUrl({
    query: q,
    maxRate: profile.desiredRate ?? null,
    fuel: profile.fuelPreference ?? '',
    type: profile.bodyType ?? 'all',
    payment: profile.paymentType ?? '',
    city: location?.city ?? searchParams.get('city') ?? '',
    plz: location?.plz ?? searchParams.get('plz') ?? '',
    locLabel: location?.label ?? searchParams.get('locLabel') ?? '',
    locSkip: skipped || searchParams.get('locSkip') === '1',
    radius: searchParams.get('radius')
      ? Number(searchParams.get('radius'))
      : (location ? DEFAULT_LOCATION_RADIUS_KM : null),
    termMonths: 48,
    mileagePerYear: mileageFromProfile(profile.mileage),
    sort: 'best',
  });
}
