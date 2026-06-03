import { DEALER_PROFILES } from '../src/data/dealers/dealerProfiles.js';
import { getDealerGoogleConfig } from '../src/data/dealers/dealerGooglePlaces.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function getApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

function fallbackResponse(dealerSlug) {
  const profile = DEALER_PROFILES[dealerSlug];
  return {
    source: profile ? 'fallback' : 'unconfigured',
    dealerSlug,
    rating: profile?.rating ?? null,
    reviewCount: profile?.reviewCount ?? 0,
    googleMapsUri: profile?.googleMapsUri ?? null,
    reviews: [],
    fetchedAt: new Date().toISOString(),
  };
}

async function googleFetch(url, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function resolvePlaceId(dealerSlug) {
  const config = getDealerGoogleConfig(dealerSlug);
  if (!config) return null;
  if (config.placeId) return config.placeId;

  const data = await googleFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.googleMapsUri,places.displayName',
    },
    body: JSON.stringify({
      textQuery: config.textQuery,
      languageCode: 'de',
      regionCode: 'DE',
      maxResultCount: 1,
    }),
  });

  const place = data?.places?.[0];
  return place?.id ?? null;
}

function normalizeReviews(reviews = []) {
  return reviews.slice(0, 5).map((r) => ({
    author: r.authorAttribution?.displayName ?? 'Google-Nutzer',
    rating: r.rating ?? null,
    text: r.text?.text ?? r.originalText?.text ?? '',
    relativeTime: r.relativePublishTimeDescription ?? '',
    googleMapsUri: r.googleMapsUri ?? null,
  }));
}

async function fetchPlaceDetails(placeId) {
  const id = placeId.startsWith('places/') ? placeId.slice(7) : placeId;
  return googleFetch(`https://places.googleapis.com/v1/places/${id}`, {
    method: 'GET',
    headers: {
      'X-Goog-FieldMask': 'id,rating,userRatingCount,googleMapsUri,reviews,displayName',
    },
  });
}

export async function fetchDealerGoogleReviews(dealerSlug) {
  const cached = cache.get(dealerSlug);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!getApiKey()) {
    const fb = fallbackResponse(dealerSlug);
    cache.set(dealerSlug, { at: Date.now(), data: fb });
    return fb;
  }

  try {
    const config = getDealerGoogleConfig(dealerSlug);
    if (!config) {
      const fb = fallbackResponse(dealerSlug);
      cache.set(dealerSlug, { at: Date.now(), data: fb });
      return fb;
    }

    let placeId = config.placeId;
    if (!placeId) {
      placeId = await resolvePlaceId(dealerSlug);
    }

    if (!placeId) {
      const fb = fallbackResponse(dealerSlug);
      fb.source = 'not_found';
      cache.set(dealerSlug, { at: Date.now(), data: fb });
      return fb;
    }

    const place = await fetchPlaceDetails(placeId);

    const result = {
      source: 'google',
      dealerSlug,
      placeId: place.id ?? placeId,
      displayName: place.displayName?.text ?? null,
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? 0,
      googleMapsUri: place.googleMapsUri ?? null,
      reviews: normalizeReviews(place.reviews),
      fetchedAt: new Date().toISOString(),
    };

    cache.set(dealerSlug, { at: Date.now(), data: result });
    return result;
  } catch (err) {
    console.warn(`[google-places] ${dealerSlug}:`, err.message);
    const fb = fallbackResponse(dealerSlug);
    fb.source = 'error';
    fb.error = err.message;
    cache.set(dealerSlug, { at: Date.now(), data: fb });
    return fb;
  }
}

export function clearGoogleReviewsCache() {
  cache.clear();
}
