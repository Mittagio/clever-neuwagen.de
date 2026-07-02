/**
 * Händler-Vertrauensprofile – Sprint 24
 * Stammdaten für Empfehlungskarte (nicht Preislisten).
 */
export const DEALER_PROFILES = {
  'autohaus-trinkle': {
    dealerSlug: 'autohaus-trinkle',
    dealerName: 'Autohaus Trinkle',
    city: 'Heilbronn',
    plz: '74072',
    address: 'Willy-Brandt-Platz 5',
    partnerBrand: 'KIA',
    partnerSinceYears: 15,
    rating: 4.8,
    reviewCount: 127,
    hasWorkshop: true,
    hasTestDrive: true,
    trustBadges: [
      'KIA Vertragspartner seit 15 Jahren',
      'Werkstatt vor Ort',
      'Persönlicher Ansprechpartner',
    ],
    contactName: 'Max Trinkle',
    contactRole: 'Verkauf Neuwagen',
    contactPhone: '+49 7131 123456',
    contactEmail: 'verkauf@autohaus-trinkle.de',
  },
  'autohaus-mueller': {
    dealerSlug: 'autohaus-mueller',
    dealerName: 'Autohaus Müller',
    city: 'Stuttgart',
    plz: '70173',
    address: 'Hauptstraße 45',
    partnerBrand: 'KIA',
    partnerSinceYears: 8,
    rating: 4.6,
    reviewCount: 89,
    hasWorkshop: true,
    hasTestDrive: true,
    trustBadges: [
      'KIA Vertragspartner seit 8 Jahren',
      'Elektro-Spezialist',
      'Probefahrt am Wochenende',
    ],
    contactName: 'Thomas Müller',
    contactRole: 'Verkaufsleitung Neuwagen',
    contactPhone: '+49 711 987654',
  },
  'autohaus-esslingen': {
    dealerSlug: 'autohaus-esslingen',
    dealerName: 'Autohaus Esslingen',
    city: 'Esslingen',
    plz: '73728',
    partnerBrand: 'Ford',
    partnerSinceYears: 12,
    rating: 4.5,
    reviewCount: 64,
    hasWorkshop: true,
    hasTestDrive: true,
    trustBadges: ['Ford Vertragspartner', 'Werkstatt vor Ort'],
    contactName: 'Andreas',
    contactPhone: '+49 711 778899',
  },
  'autohaus-stuttgart': {
    dealerSlug: 'autohaus-stuttgart',
    dealerName: 'Autohaus Stuttgart',
    city: 'Stuttgart',
    plz: '70173',
    partnerBrand: 'Hyundai',
    partnerSinceYears: 10,
    rating: 4.4,
    reviewCount: 52,
    hasWorkshop: true,
    hasTestDrive: false,
    trustBadges: ['Hyundai Vertragspartner', 'Große Ausstellungsfläche'],
    contactName: 'Marco',
    contactPhone: '+49 711 112233',
  },
  'autohaus-ulm': {
    dealerSlug: 'autohaus-ulm',
    dealerName: 'Autohaus Ulm',
    city: 'Ulm',
    plz: '89073',
    partnerBrand: 'KIA',
    partnerSinceYears: 6,
    rating: 4.3,
    reviewCount: 41,
    hasWorkshop: true,
    hasTestDrive: true,
    trustBadges: ['KIA Vertragspartner', 'Service inklusive'],
    contactName: 'Sarah Müller',
    contactPhone: '+49 731 667788',
  },
};

export function getDealerProfile(dealerSlug) {
  return DEALER_PROFILES[dealerSlug] ?? {
    dealerSlug,
    dealerName: dealerSlug,
    trustBadges: [],
    rating: 4.0,
    reviewCount: 0,
    hasWorkshop: false,
    hasTestDrive: false,
    ratingSource: 'fallback',
  };
}

/**
 * Überschreibt Profil-Rating mit live Google-Daten (wenn verfügbar).
 */
export function mergeDealerProfileWithGoogle(profile, googleData) {
  if (!googleData || googleData.rating == null) {
    return { ...profile, ratingSource: profile.ratingSource ?? 'fallback' };
  }

  const isGoogle = googleData.source === 'google';

  return {
    ...profile,
    rating: googleData.rating,
    reviewCount: googleData.reviewCount ?? profile.reviewCount,
    googleMapsUri: googleData.googleMapsUri ?? profile.googleMapsUri,
    googleReviews: googleData.reviews ?? [],
    googleDisplayName: googleData.displayName ?? null,
    ratingSource: isGoogle ? 'google' : (googleData.source ?? 'fallback'),
  };
}
