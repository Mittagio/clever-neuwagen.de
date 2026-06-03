import { getDealerProfile, mergeDealerProfileWithGoogle } from '../../data/dealers/dealerProfiles.js';

const WEIGHTS = {
  distance: 0.28,
  availability: 0.22,
  delivery: 0.15,
  rating: 0.15,
  partner: 0.1,
  discount: 0.03,
  price: 0.04,
  service: 0.03,
};

function scoreDistance(km) {
  if (km <= 15) return 1;
  if (km <= 25) return 0.9;
  if (km <= 40) return 0.75;
  if (km <= 60) return 0.55;
  return 0.35;
}

function scoreAvailability(code) {
  if (code === 'sofort') return 1;
  if (code === 'vorlauf') return 0.75;
  if (code === 'bestell') return 0.5;
  return 0.3;
}

function scoreDelivery(deliveryTime = '') {
  const t = deliveryTime.toLowerCase();
  if (/sofort|2.?4|3.?5/.test(t)) return 1;
  if (/4.?6|6.?8|4 wochen|4 monate/.test(t)) return 0.85;
  if (/8.?10|8 wochen|6.?10/.test(t)) return 0.65;
  if (/12|10/.test(t)) return 0.45;
  return 0.55;
}

function scoreRating(rating = 4) {
  return Math.min(1, Math.max(0, (rating - 3.5) / 1.5));
}

function scorePartner(years = 0) {
  if (years >= 15) return 1;
  if (years >= 10) return 0.85;
  if (years >= 5) return 0.7;
  return 0.5;
}

function scoreDiscount(percent = 0) {
  if (percent >= 20) return 1;
  if (percent >= 15) return 0.85;
  if (percent >= 10) return 0.7;
  return 0.5;
}

function scorePriceRelative(rate, allRates) {
  if (!allRates.length || rate == null) return 0.5;
  const min = Math.min(...allRates);
  const max = Math.max(...allRates);
  if (max === min) return 0.8;
  const normalized = (max - rate) / (max - min);
  return 0.4 + normalized * 0.4;
}

function scoreService(profile) {
  let s = 0.5;
  if (profile.hasWorkshop) s += 0.25;
  if (profile.hasTestDrive) s += 0.15;
  if (profile.contactName) s += 0.1;
  return Math.min(1, s);
}

function buildReasons(parts) {
  const reasons = [];
  if (parts.distance >= 0.9) reasons.push('In Ihrer Nähe');
  if (parts.availability >= 0.95) reasons.push('Sofort verfügbar');
  if (parts.delivery >= 0.85) reasons.push('Schnelle Lieferung');
  if (parts.rating >= 0.8) reasons.push('Top bewertet');
  if (parts.partner >= 0.85) reasons.push('Langjähriger Vertragspartner');
  if (parts.service >= 0.8) reasons.push('Werkstatt vor Ort');
  return reasons.slice(0, 4);
}

/**
 * Berechnet Händler-Score 0–100 (Preis nur 5 % Gewicht).
 */
export function scoreDealerOffer(offer, allOffers = []) {
  const baseProfile = getDealerProfile(offer.dealerSlug);
  const profile = mergeDealerProfileWithGoogle(baseProfile, offer.googleReviews);
  const allRates = allOffers.map((o) => o.monthlyRate).filter((r) => r != null);

  const parts = {
    distance: scoreDistance(offer.distanceKm ?? 99),
    availability: scoreAvailability(offer.availability),
    delivery: scoreDelivery(offer.deliveryTime),
    rating: scoreRating(profile.rating),
    partner: scorePartner(profile.partnerSinceYears),
    discount: scoreDiscount(offer.discountPercent ?? offer.pricing?.discountPercent),
    price: scorePriceRelative(offer.monthlyRate, allRates),
    service: scoreService(profile),
  };

  const score = Math.round(
    parts.distance * WEIGHTS.distance * 100
    + parts.availability * WEIGHTS.availability * 100
    + parts.delivery * WEIGHTS.delivery * 100
    + parts.rating * WEIGHTS.rating * 100
    + parts.partner * WEIGHTS.partner * 100
    + parts.discount * WEIGHTS.discount * 100
    + parts.price * WEIGHTS.price * 100
    + parts.service * WEIGHTS.service * 100,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    profile,
    reasons: buildReasons(parts),
    scoreBreakdown: parts,
  };
}

export function rankDealerOffers(offers) {
  return offers
    .map((offer) => {
      const scored = scoreDealerOffer(offer, offers);
      return { ...offer, ...scored };
    })
    .sort((a, b) => b.score - a.score);
}

export function getRecommendedDealer(offers) {
  const ranked = rankDealerOffers(offers);
  return ranked[0] ?? null;
}
