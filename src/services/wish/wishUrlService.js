import { parseSearchIntent } from '../search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../search/intentToFilters.js';
import { buildFahrzeugeSearchUrl } from '../../logic/oneSearchService.js';

export function buildWishSearchUrl(text) {
  const intent = parseSearchIntent(text);
  const filters = intentToMarketplaceFilters(intent);
  return buildFahrzeugeSearchUrl(filters);
}

export function buildDealerWishSearchUrl(text, { city = '', dealerSlug = '', brand = '' } = {}) {
  const query = city && text ? `${text} ${city}`.trim() : (text || city).trim();
  const intent = parseSearchIntent(query);
  const filters = intentToMarketplaceFilters(intent);
  if (city) filters.city = city;
  if (dealerSlug) filters.dealer = dealerSlug;
  if (brand) filters.brand = brand;
  return buildFahrzeugeSearchUrl(filters);
}

export function buildDealerCleverEntryUrl(text, { dealerSlug = 'autohaus-trinkle', city = '' } = {}) {
  const q = encodeURIComponent(text.trim());
  const params = new URLSearchParams({ entry: 'clever', q });
  if (city) params.set('city', city);
  return `/haendler/${dealerSlug}?${params.toString()}`;
}

export function buildDealerClassicModelUrl(modelKey, { dealerSlug = 'autohaus-trinkle' } = {}) {
  const params = new URLSearchParams({ entry: 'classic', model: modelKey });
  return `/haendler/${dealerSlug}?${params.toString()}`;
}

export function parseFeaturesParam(searchParams) {
  const raw = searchParams.get('features') ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function patchFeaturesInUrl(filters, featureIds) {
  return buildFahrzeugeSearchUrl({ ...filters, features: featureIds });
}
