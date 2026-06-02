import { parseCustomerWish } from './wishParser.js';
import { parseNaturalLanguageSearch, buildFahrzeugeSearchUrl } from '../../logic/oneSearchService.js';
import { DEFAULT_LOCATION_RADIUS_KM } from '../../logic/advisorLocation.js';

export function buildWishSearchUrl(text) {
  const wishes = parseCustomerWish(text);
  const parsed = parseNaturalLanguageSearch(text);

  return buildFahrzeugeSearchUrl({
    query: text,
    features: wishes.features,
    maxRate: wishes.budget.maxMonthlyRate ?? parsed.profile.desiredRate ?? null,
    maxPrice: wishes.budget.maxPrice ?? parsed.profile.maxPrice ?? null,
    type: parsed.profile.bodyType ?? parsed.profile.fuelPreference ?? 'all',
    fuel: parsed.profile.fuelPreference ?? '',
    payment: parsed.profile.paymentType ?? '',
    model: wishes.model ?? parsed.model ?? '',
    trim: wishes.trim ?? parsed.trim ?? '',
    city: wishes.location?.city ?? parsed.location?.city ?? '',
    plz: wishes.location?.plz ?? parsed.location?.plz ?? '',
    radius: wishes.location?.radiusKm ?? parsed.location?.radiusKm ?? (parsed.location ? DEFAULT_LOCATION_RADIUS_KM : null),
    household: parsed.profile.household ?? '',
    termMonths: 48,
    mileagePerYear: 10000,
    sort: 'best',
    locSkip: false,
  });
}

export function parseFeaturesParam(searchParams) {
  const raw = searchParams.get('features') ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function patchFeaturesInUrl(filters, featureIds) {
  return buildFahrzeugeSearchUrl({ ...filters, features: featureIds });
}
