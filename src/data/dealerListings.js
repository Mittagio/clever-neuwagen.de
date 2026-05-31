/**
 * Händlerangebote für die öffentliche Landingpage.
 * syncStatus: live = voll synchronisiert · partial = teilweise · none = keine LF
 */
export const dealerListings = [
  {
    slug: 'autohaus-trinkle',
    dealerId: 'autohaus-trinkle',
    name: 'Autohaus Trinkle',
    city: 'Heilbronn',
    plz: '74072',
    brand: 'Kia',
    model: 'Sportage',
    distanceKm: 18,
    syncStatus: 'live',
    useLiveConditions: true,
    hasDealerPage: true,
    dealerPagePath: '/haendler/autohaus-trinkle',
  },
  {
    slug: 'autohaus-stuttgart',
    dealerId: 'autohaus-stuttgart',
    name: 'Autohaus Stuttgart',
    city: 'Stuttgart',
    plz: '70173',
    brand: 'Kia',
    model: 'Sportage',
    distanceKm: 42,
    syncStatus: 'partial',
    useLiveConditions: false,
    monthlyRateFrom: 329,
    deliveryTime: '6–8 Wochen',
    hasDealerPage: false,
  },
  {
    slug: 'autohaus-ulm',
    dealerId: 'autohaus-ulm',
    name: 'Autohaus Ulm',
    city: 'Ulm',
    plz: '89073',
    brand: 'Kia',
    model: 'Sportage',
    distanceKm: 65,
    syncStatus: 'none',
    useLiveConditions: false,
    monthlyRateFrom: null,
    deliveryTime: null,
    hasDealerPage: false,
  },
];

export const SEARCH_DEFAULTS = {
  brand: 'Kia',
  model: 'Sportage',
  plzExample: '73614',
};

export const SYNC_LABELS = {
  live: 'Live-Konditionen aktiv',
  partial: 'Teilweise gepflegt',
  none: 'Keine LF gepflegt',
};
