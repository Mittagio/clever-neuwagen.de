/**
 * Entfernung / Fahrzeit Kunde ↔ Autohaus – mit Cache-Steuerung.
 */
import { buildAddressCacheKey, isAddressComplete, normalizeAddressResult } from './customerAddressModel.js';
import { buildDealerLocationCacheKey } from './dealerLocationService.js';

export const DISTANCE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PLZ_COORDINATES = {
  73547: { lat: 48.8378, lng: 10.0933 },
  73614: { lat: 48.8054, lng: 9.5272 },
  74072: { lat: 49.1427, lng: 9.2109 },
  70173: { lat: 48.7758, lng: 9.1829 },
};

function resolveCoordinates(address = {}) {
  const normalized = normalizeAddressResult(address);
  if (normalized.lat != null && normalized.lng != null) {
    return { lat: normalized.lat, lng: normalized.lng };
  }
  const plz = Number(normalized.postalCode);
  if (PLZ_COORDINATES[plz]) return PLZ_COORDINATES[plz];
  return null;
}

const ROAD_DISTANCE_FACTOR = 0.58;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDurationMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return Math.max(1, Math.round(distanceKm * 0.92));
}

/**
 * @param {object} params
 * @returns {boolean}
 */
export function shouldRecalculateDistance({
  distanceInfo = null,
  customerAddress = {},
  dealerLocation = {},
  now = Date.now(),
} = {}) {
  if (!isAddressComplete(customerAddress)) return false;
  if (!distanceInfo) return true;

  const addressKey = buildAddressCacheKey(customerAddress);
  const dealerKey = buildDealerLocationCacheKey(dealerLocation);
  if (distanceInfo.customerAddressKey !== addressKey) return true;
  if (distanceInfo.dealerLocationKey !== dealerKey) return true;

  const calculatedAt = Date.parse(distanceInfo.calculatedAt ?? '');
  if (!Number.isFinite(calculatedAt)) return true;
  return now - calculatedAt > DISTANCE_CACHE_MAX_AGE_MS;
}

/**
 * @param {object} customerAddress
 * @param {object} dealerLocation
 * @returns {Promise<import('./locationTypes.js').DistanceInfo|null>}
 */
export async function calculateCustomerDistance(customerAddress = {}, dealerLocation = {}) {
  if (!isAddressComplete(customerAddress)) return null;

  const customerCoords = resolveCoordinates(customerAddress);
  const dealerCoords = resolveCoordinates(dealerLocation);
  if (!customerCoords || !dealerCoords) return null;

  const airKm = haversineKm(
    dealerCoords.lat,
    dealerCoords.lng,
    customerCoords.lat,
    customerCoords.lng,
  );
  const distanceKm = Math.round(airKm * ROAD_DISTANCE_FACTOR * 10) / 10;

  const durationMinutes = estimateDurationMinutes(distanceKm);
  const now = new Date().toISOString();

  return {
    distanceKm,
    durationMinutes,
    provider: 'mock-haversine',
    calculatedAt: now,
    customerAddressKey: buildAddressCacheKey(customerAddress),
    dealerLocationKey: buildDealerLocationCacheKey(dealerLocation),
  };
}

/**
 * @param {import('./locationTypes.js').DistanceInfo|null} distanceInfo
 * @returns {string|null}
 */
export function formatDistanceSummary(distanceInfo = null) {
  if (!distanceInfo) return null;
  const km = Number(distanceInfo.distanceKm);
  const min = Number(distanceInfo.durationMinutes);
  if (!Number.isFinite(km) || km <= 0) return null;

  const kmLabel = Number.isInteger(km) ? `${km}` : km.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (Number.isFinite(min) && min > 0) {
    return `ca. ${kmLabel} km · ${min} Min. entfernt`;
  }
  return `ca. ${kmLabel} km entfernt`;
}

/**
 * Liefert gültige Cache-Daten oder null (keine Berechnung im Render-Pfad).
 */
export function getCachedDistanceInfo({
  distanceInfo = null,
  customerAddress = {},
  dealerLocation = {},
  now = Date.now(),
} = {}) {
  if (!distanceInfo) return null;
  if (shouldRecalculateDistance({ distanceInfo, customerAddress, dealerLocation, now })) {
    return null;
  }
  return distanceInfo;
}
