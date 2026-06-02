/**
 * Google Places – Suchbegriffe / Place-IDs pro Händler (Platform Admin).
 * placeId optional – sonst Text Search über textQuery.
 */
export const DEALER_GOOGLE_PLACES = {
  'autohaus-trinkle': {
    textQuery: 'Autohaus Trinkle Kia Heilbronn Willy-Brandt-Platz',
    placeId: null,
  },
  'autohaus-mueller': {
    textQuery: 'Autohaus Müller Kia Stuttgart',
    placeId: null,
  },
  'autohaus-esslingen': {
    textQuery: 'Autohaus Esslingen Ford',
    placeId: null,
  },
  'autohaus-stuttgart': {
    textQuery: 'Hyundai Autohaus Stuttgart',
    placeId: null,
  },
  'autohaus-ulm': {
    textQuery: 'Kia Autohaus Ulm',
    placeId: null,
  },
};

export function getDealerGoogleConfig(dealerSlug) {
  return DEALER_GOOGLE_PLACES[dealerSlug] ?? null;
}
