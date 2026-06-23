/**
 * Zentraler Händlerstandort – später je Händler individuell.
 */
import { getDealerSeed, DEFAULT_DEALER_ID } from '../../data/dealers/index.js';

const DEFAULT_COUNTRY = 'Deutschland';

/** Grobe Koordinaten für Seed-PLZ (Mock bis Geocoding-API) */
const PLZ_COORDINATES = {
  74072: { lat: 49.1427, lng: 9.2109 },
  70173: { lat: 48.7758, lng: 9.1829 },
  73547: { lat: 48.8378, lng: 10.0933 },
};

function parseStreetAndNumber(addressLine = '') {
  const trimmed = String(addressLine).trim();
  const match = trimmed.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/);
  if (!match) return { street: trimmed, houseNumber: '' };
  return { street: match[1].trim(), houseNumber: match[2] };
}

/**
 * @param {string} [dealerId]
 * @returns {import('./locationTypes.js').DealerLocation}
 */
export function getDealerLocation(dealerId = DEFAULT_DEALER_ID) {
  const seed = getDealerSeed(dealerId);
  const postalCode = String(seed.plz ?? '').trim();
  const { street, houseNumber } = parseStreetAndNumber(seed.address ?? '');
  const coords = PLZ_COORDINATES[Number(postalCode)] ?? null;

  return {
    dealerId: seed.dealerId ?? dealerId,
    name: seed.dealerName ?? 'Autohaus',
    street,
    houseNumber,
    postalCode,
    city: seed.city ?? '',
    country: DEFAULT_COUNTRY,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    formattedAddress: [seed.address, `${postalCode} ${seed.city ?? ''}`.trim()]
      .filter(Boolean)
      .join(' · '),
  };
}

export function buildDealerLocationCacheKey(dealerLocation = {}) {
  return [
    dealerLocation.dealerId ?? '',
    dealerLocation.street ?? '',
    dealerLocation.houseNumber ?? '',
    dealerLocation.postalCode ?? '',
    dealerLocation.city ?? '',
    dealerLocation.lat ?? '',
    dealerLocation.lng ?? '',
  ].join('|').toLowerCase();
}
