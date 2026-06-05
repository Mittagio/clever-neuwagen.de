/**
 * Legacy /berater → neue Discovery-Pipeline (/fahrzeuge).
 */

import {
  parseAdvisorLocationFromParams,
  DEFAULT_LOCATION_RADIUS_KM,
} from '../../logic/advisorLocation.js';
import { buildFahrzeugeSearchUrl } from '../../logic/fahrzeugeSearchUrl.js';

/** URL-Parameter von Landing/Legacy-Berater → Profil */
export function parseAdvisorUrlProfile(searchParams) {
  const profile = {};
  const rate = searchParams.get('rate');
  if (rate) {
    const n = Number(rate);
    if (!Number.isNaN(n)) profile.desiredRate = n;
  }
  const mileage = searchParams.get('mileage');
  if (mileage) profile.mileage = mileage;
  const household = searchParams.get('household');
  if (household) profile.household = household;
  const fuel = searchParams.get('fuel');
  if (fuel) profile.fuelPreference = fuel;
  const body = searchParams.get('body');
  if (body) profile.bodyType = body;
  const wishes = searchParams.get('wishes');
  if (wishes) {
    profile.wishes = wishes.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const payment = searchParams.get('payment');
  if (payment) profile.paymentType = payment;
  return profile;
}

const WISH_TO_FEATURE = {
  anhaenger: 'towbar',
  reichweite: 'range_400',
  'viel-platz': 'family_suv',
  panorama: 'panorama_roof',
  kamera360: 'camera_360',
  sitzbelueftung: 'ventilated_seats',
};

function mileageFromProfile(mileageId) {
  if (mileageId === '15k-20k') return 20000;
  if (mileageId === '10k-15k') return 15000;
  if (mileageId === 'over-20k') return 30000;
  return 10000;
}

function mapHouseholdToUseCase(household) {
  if (household === 'family' || household === 'family-dog') return 'family';
  if (household === 'couple') return 'city';
  return '';
}

export function mapAdvisorWishesToFeatures(wishes = []) {
  const features = [];
  for (const wish of wishes) {
    const mapped = WISH_TO_FEATURE[wish];
    if (mapped) features.push(mapped);
    if (wish === 'gewerblich') features.push('family_suv');
    if (wish === 'allrad') features.push('family_suv');
  }
  if (wishes.includes('family-dog') || wishes.includes('hund')) {
    features.push('large_trunk');
  }
  return [...new Set(features)];
}

export function buildDiscoveryFiltersFromBeraterParams(searchParams) {
  const profile = parseAdvisorUrlProfile(searchParams);
  const { location, skipped } = parseAdvisorLocationFromParams(searchParams);
  const q = searchParams.get('q') ?? '';

  const wishes = profile.wishes ?? [];
  const features = mapAdvisorWishesToFeatures(wishes);
  if (profile.household === 'family-dog') features.push('large_trunk');

  let useCase = mapHouseholdToUseCase(profile.household);
  if (wishes.includes('gewerblich')) useCase = 'gewerbe';

  const fuel = profile.fuelPreference && profile.fuelPreference !== 'egal'
    ? profile.fuelPreference
    : '';

  const type = profile.bodyType && profile.bodyType !== 'egal'
    ? profile.bodyType
    : 'all';

  const mileagePerYear = profile.mileage ? mileageFromProfile(profile.mileage) : null;

  return buildFahrzeugeSearchUrl({
    query: q,
    maxRate: profile.desiredRate ?? null,
    fuel,
    type,
    payment: profile.paymentType ?? '',
    household: profile.household ?? '',
    useCase,
    features,
    availability: wishes.includes('schnelle-lieferung') ? 'sofort' : '',
    city: location?.city ?? searchParams.get('city') ?? '',
    plz: location?.plz ?? searchParams.get('plz') ?? '',
    locLabel: location?.label ?? searchParams.get('locLabel') ?? '',
    locSkip: skipped || searchParams.get('locSkip') === '1',
    radius: searchParams.get('radius')
      ? Number(searchParams.get('radius'))
      : (location ? DEFAULT_LOCATION_RADIUS_KM : null),
    termMonths: 48,
    mileagePerYear: mileagePerYear ?? undefined,
    sort: 'best',
    intentStructured: Boolean(useCase || fuel === 'elektro'),
  });
}

/** @deprecated Alias – nutze buildDiscoveryFiltersFromBeraterParams */
export function advisorParamsToFahrzeugeUrl(searchParams) {
  return buildDiscoveryFiltersFromBeraterParams(searchParams);
}

/** Profil aus Landing-Chips → /fahrzeuge URL (ohne /berater-Zwischenschritt). */
export function buildFahrzeugeUrlFromAdvisorProfile(profile = {}, query = '', options = {}) {
  const { location = null, locSkip = false, radiusKm } = options;
  const params = new URLSearchParams();

  if (profile.desiredRate) params.set('rate', String(profile.desiredRate));
  if (profile.mileage) params.set('mileage', profile.mileage);
  if (profile.household) params.set('household', profile.household);
  if (profile.fuelPreference) params.set('fuel', profile.fuelPreference);
  if (profile.bodyType) params.set('body', profile.bodyType);
  if (profile.paymentType) params.set('payment', profile.paymentType);
  if (profile.wishes?.length) params.set('wishes', profile.wishes.join(','));
  if (query) params.set('q', query.slice(0, 200));

  if (locSkip) {
    params.set('locSkip', '1');
  } else if (location) {
    const radius = radiusKm ?? location.radiusKm ?? DEFAULT_LOCATION_RADIUS_KM;
    if (location.city) params.set('city', location.city);
    if (location.plz) params.set('plz', location.plz);
    if (location.label) params.set('locLabel', location.label);
    params.set('radius', String(radius));
  }

  return buildDiscoveryFiltersFromBeraterParams(params);
}
