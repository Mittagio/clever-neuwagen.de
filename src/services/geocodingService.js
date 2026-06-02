/**
 * Geocoding über OpenStreetMap Nominatim (kostenfrei, Rate-Limits beachten).
 * https://operations.osmfoundation.org/policies/nominatim/
 */

import { PLZ_EXACT_CITY, PLZ_PREFIX_CITY, GERMAN_CITY_PATTERNS } from '../data/germanPlzRegions.js';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Clever-Neuwagen/1.0 (location-advisor; https://clever-neuwagen.de)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

async function nominatimFetch(path) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(`${NOMINATIM_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'de',
    },
    // Browser sendet keinen User-Agent Header anpassbar; Referer hilft bei Nominatim
    referrerPolicy: 'strict-origin-when-cross-origin',
  });

  if (!res.ok) throw new Error(`Geocoding fehlgeschlagen (${res.status})`);
  return res.json();
}

function pickCityFromAddress(address = {}) {
  return (
    address.city
    ?? address.town
    ?? address.village
    ?? address.municipality
    ?? address.county
    ?? ''
  );
}

export function plzToCityLocal(plz) {
  if (!plz || !/^\d{5}$/.test(plz)) return '';
  if (PLZ_EXACT_CITY[plz]) return PLZ_EXACT_CITY[plz];
  const prefix = plz.slice(0, 2);
  return PLZ_PREFIX_CITY[prefix] ?? '';
}

export function matchCityInText(text) {
  for (const { city, re } of GERMAN_CITY_PATTERNS) {
    if (re.test(text)) return city;
  }
  return '';
}

/**
 * Reverse Geocoding: GPS → Stadt + PLZ
 */
export async function reverseGeocodeCoords(lat, lon) {
  const data = await nominatimFetch(
    `/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`,
  );
  const address = data.address ?? {};
  const city = pickCityFromAddress(address);
  const plz = address.postcode ?? '';
  if (!city && !plz) {
    return { label: 'Ihr Standort', source: 'geo' };
  }
  return {
    city: city || undefined,
    plz: plz || undefined,
    source: 'geo',
  };
}

/**
 * Forward Geocoding: PLZ oder Ortsname → Stadt + PLZ
 */
export async function geocodePlzOrCity(query) {
  const raw = query.trim();
  if (!raw) return null;

  if (/^\d{5}$/.test(raw)) {
    const localCity = plzToCityLocal(raw);
    if (localCity) {
      return { plz: raw, city: localCity, source: 'manual' };
    }
    const results = await nominatimFetch(
      `/search?postalcode=${encodeURIComponent(raw)}&countrycodes=de&format=json&limit=1&addressdetails=1`,
    );
    const hit = results?.[0];
    if (hit) {
      const city = pickCityFromAddress(hit.address ?? {});
      return { plz: hit.address?.postcode ?? raw, city: city || undefined, source: 'manual' };
    }
    return { plz: raw, source: 'manual' };
  }

  const localCity = matchCityInText(raw);
  if (localCity) {
    return { city: localCity, source: 'manual' };
  }

  const results = await nominatimFetch(
    `/search?q=${encodeURIComponent(raw)}&countrycodes=de&format=json&limit=1&addressdetails=1`,
  );
  const hit = results?.[0];
  if (hit) {
    const city = pickCityFromAddress(hit.address ?? {}) || hit.display_name?.split(',')[0];
    return {
      city: city || undefined,
      plz: hit.address?.postcode ?? undefined,
      source: 'manual',
    };
  }

  if (raw.length >= 2) {
    return { city: raw.charAt(0).toUpperCase() + raw.slice(1), source: 'manual' };
  }

  return null;
}

/**
 * Lokal + optional API: für Freitext-Parsing ohne Blockieren der UI
 */
export async function enrichLocationWithGeocoding(location) {
  if (!location) return null;
  if (location.city || location.label) return location;

  if (location.plz) {
    const city = plzToCityLocal(location.plz);
    if (city) return { ...location, city };
    try {
      const resolved = await geocodePlzOrCity(location.plz);
      return resolved ? { ...location, ...resolved, source: location.source ?? resolved.source } : location;
    } catch {
      return location;
    }
  }

  return location;
}
