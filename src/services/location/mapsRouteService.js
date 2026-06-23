/**
 * Externe Karten- / Routen-URLs (Google Maps, API-ready).
 */
import { formatAddressLine, normalizeAddressResult } from './customerAddressModel.js';

function encodeQuery(value = '') {
  return encodeURIComponent(String(value).trim());
}

export function buildCustomerMapsSearchUrl(address = '') {
  const formatted = typeof address === 'string'
    ? address.trim()
    : normalizeAddressResult(address).formattedAddress;
  if (!formatted) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(formatted)}`;
}

export function buildDealerToCustomerRouteUrl(customerAddress = {}, dealerLocation = {}) {
  const destination = typeof customerAddress === 'string'
    ? customerAddress.trim()
    : normalizeAddressResult(customerAddress).formattedAddress;
  if (!destination) return null;

  const origin = dealerLocation?.formattedAddress
    || formatAddressLine({
      street: dealerLocation?.street,
      houseNumber: dealerLocation?.houseNumber,
      postalCode: dealerLocation?.postalCode,
      city: dealerLocation?.city,
    });
  if (!origin) return buildCustomerMapsSearchUrl(destination);

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getMapsProvider() {
  const provider = import.meta.env?.VITE_MAPS_PROVIDER;
  return provider ? String(provider).toLowerCase() : 'google';
}

export function hasGoogleMapsApiKey() {
  const key = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;
  return Boolean(key && String(key).trim());
}
