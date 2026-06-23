/**
 * Adress-Autocomplete – Mock/Fallback, API-ready für Google Places o. ä.
 */
import { normalizeAddressResult } from './customerAddressModel.js';
import { getMapsProvider, hasGoogleMapsApiKey } from './mapsRouteService.js';

const MOCK_SUGGESTIONS = [
  {
    id: 'mock-aalen-buchsweg',
    label: 'Buchsweg 38, 73547 Aalen',
    description: 'Buchsweg, Aalen',
    address: {
      street: 'Buchsweg',
      houseNumber: '38',
      postalCode: '73547',
      city: 'Aalen',
      country: 'Deutschland',
      lat: 48.8378,
      lng: 10.0933,
      placeId: 'mock-aalen-buchsweg',
      source: 'mock',
    },
  },
  {
    id: 'mock-heilbronn-wbp',
    label: 'Willy-Brandt-Platz 5, 74072 Heilbronn',
    description: 'Willy-Brandt-Platz, Heilbronn',
    address: {
      street: 'Willy-Brandt-Platz',
      houseNumber: '5',
      postalCode: '74072',
      city: 'Heilbronn',
      country: 'Deutschland',
      lat: 49.1427,
      lng: 9.2109,
      placeId: 'mock-heilbronn-wbp',
      source: 'mock',
    },
  },
  {
    id: 'mock-schorndorf-waldheimer',
    label: 'Waldheimer Straße 12, 73614 Schorndorf',
    description: 'Waldheimer Straße, Schorndorf',
    address: {
      street: 'Waldheimer Straße',
      houseNumber: '12',
      postalCode: '73614',
      city: 'Schorndorf',
      country: 'Deutschland',
      lat: 48.8054,
      lng: 9.5272,
      placeId: 'mock-schorndorf-waldheimer',
      source: 'mock',
    },
  },
];

export function isAutocompleteEnabled() {
  return getMapsProvider() === 'google' && hasGoogleMapsApiKey();
}

export function isLiveAutocompleteProvider() {
  return isAutocompleteEnabled();
}

function filterMockSuggestions(query = '') {
  const q = String(query).trim().toLowerCase();
  if (q.length < 3) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return MOCK_SUGGESTIONS.filter((item) => {
    const haystack = [
      item.label,
      item.description,
      item.address.street,
      item.address.city,
      item.address.postalCode,
    ].join(' ').toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/**
 * @param {string} query
 * @returns {Promise<Array<{ id: string, label: string, description?: string }>>}
 */
export async function searchAddressSuggestions(query = '') {
  const trimmed = String(query).trim();
  if (trimmed.length < 3 || !isAutocompleteEnabled()) return [];

  if (isLiveAutocompleteProvider()) {
    // API-Hook: Google Places Autocomplete hier anbinden (Key nur über Env).
    return filterMockSuggestions(trimmed);
  }

  return [];
}

/**
 * @param {string} suggestionId
 * @returns {Promise<import('./locationTypes.js').CustomerAddress|null>}
 */
export async function selectAddressSuggestion(suggestionId = '') {
  const match = MOCK_SUGGESTIONS.find((item) => item.id === suggestionId);
  if (!match) return null;
  return normalizeAddressResult(match.address);
}

export { normalizeAddressResult };
