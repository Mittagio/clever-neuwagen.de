import { useEffect, useState, useMemo } from 'react';
import { fetchDealerGoogleReviewsBatch } from '../services/dealer/googleReviewsService.js';
import { mergeDealerProfileWithGoogle } from '../data/dealers/dealerProfiles.js';

export function useDealerGoogleReviewsBatch(dealerSlugs = []) {
  const key = useMemo(() => [...new Set(dealerSlugs.filter(Boolean))].sort().join(','), [dealerSlugs]);
  const [reviewsBySlug, setReviewsBySlug] = useState({});
  const [loading, setLoading] = useState(!!key);

  useEffect(() => {
    if (!key) {
      setReviewsBySlug({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDealerGoogleReviewsBatch(key.split(','))
      .then((data) => {
        if (!cancelled) setReviewsBySlug(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key]);

  return { reviewsBySlug, loading };
}

export function enrichOfferWithGoogle(offer, reviewsBySlug) {
  if (!offer) return offer;
  const google = reviewsBySlug[offer.dealerSlug];
  const profile = mergeDealerProfileWithGoogle(offer.profile ?? {}, google);
  return {
    ...offer,
    profile,
    googleReviews: google,
    rating: profile.rating ?? offer.rating,
    reviewCount: profile.reviewCount ?? offer.reviewCount,
  };
}

export function enrichOffersWithGoogle(offers, reviewsBySlug) {
  return offers.map((o) => enrichOfferWithGoogle(o, reviewsBySlug));
}
