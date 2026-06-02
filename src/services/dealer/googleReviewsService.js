/**
 * Client – Google-Bewertungen über Server-Proxy (API-Key nie im Browser).
 */

export async function fetchDealerGoogleReviews(dealerSlug) {
  if (!dealerSlug) return null;

  const res = await fetch(`/api/v1/dealers/${encodeURIComponent(dealerSlug)}/google-reviews`);
  if (!res.ok) {
    throw new Error(`Google Reviews ${res.status}`);
  }
  return res.json();
}

export async function fetchDealerGoogleReviewsBatch(dealerSlugs = []) {
  const unique = [...new Set(dealerSlugs.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (slug) => {
      try {
        const data = await fetchDealerGoogleReviews(slug);
        return [slug, data];
      } catch {
        return [slug, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function isLiveGoogleRating(data) {
  return data?.source === 'google' && data.rating != null;
}
