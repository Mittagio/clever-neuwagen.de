/** Standort-Erkennung & URL-Hilfen (Sprint 15.4+) */

import { GERMAN_CITY_PATTERNS } from '../data/germanPlzRegions.js';
import { plzToCityLocal, matchCityInText } from '../services/geocodingService.js';

export const DEFAULT_LOCATION_RADIUS_KM = 25;

export function plzToCityHint(plz) {
  return plzToCityLocal(plz);
}

export function parseRadiusFromText(text) {
  const m =
    text.match(/umkreis\s*(?:von\s*)?(\d{2,3})\s*km/i)
    ?? text.match(/(\d{2,3})\s*km\s*(?:umkreis|radius)/i)
    ?? text.match(/radius\s*(\d{2,3})\s*km/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 5 && n <= 500 ? n : null;
}

export function parseLocationFromText(text) {
  const t = text.trim();
  if (!t) return null;

  const radiusKm = parseRadiusFromText(t);
  const plzMatch = t.match(/\b(\d{5})\b/);
  if (plzMatch) {
    const plz = plzMatch[1];
    const city = plzToCityHint(plz);
    return {
      plz,
      city: city || undefined,
      radiusKm: radiusKm ?? undefined,
      source: 'text',
    };
  }

  for (const { city, re } of GERMAN_CITY_PATTERNS) {
    if (re.test(t)) {
      return { city, radiusKm: radiusKm ?? undefined, source: 'text' };
    }
  }

  if (/umkreis\s+von\s+([a-zäöüß\-\s]+)/i.test(t)) {
    const cityMatch = t.match(/umkreis\s+von\s+([a-zäöüß\-]+)/i);
    const raw = cityMatch?.[1]?.trim();
    if (raw && !/^\d+$/.test(raw)) {
      const matched = matchCityInText(raw);
      const normalized = matched || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return { city: normalized, radiusKm: radiusKm ?? undefined, source: 'text' };
    }
  }

  return null;
}

export function parseManualLocationInput(value) {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{5}$/.test(raw)) {
    const plz = raw;
    return { plz, city: plzToCityHint(plz) || undefined, source: 'manual' };
  }

  const matched = matchCityInText(raw);
  if (matched) return { city: matched, source: 'manual' };

  if (raw.length >= 2) {
    return { city: raw.charAt(0).toUpperCase() + raw.slice(1), source: 'manual' };
  }

  return null;
}

export function hasAdvisorLocation(location) {
  if (!location) return false;
  return Boolean(location.city || location.plz || location.label);
}

export function getLocationDisplayLabel(location) {
  if (!location) return '';
  if (location.label) return location.label;
  if (location.city && location.plz) return `${location.city} (${location.plz})`;
  if (location.city) return location.city;
  if (location.plz) return location.plz;
  return '';
}

export function formatLocationChip(location, radiusKm) {
  const label = getLocationDisplayLabel(location);
  if (!label) return null;
  const r = radiusKm == null ? '∞' : radiusKm;
  return `📍 ${label} +${r} km`;
}

export function parseAdvisorLocationFromParams(searchParams) {
  if (searchParams.get('locSkip') === '1') {
    return { skipped: true, location: null };
  }

  const city = searchParams.get('city') ?? '';
  const plz = searchParams.get('plz') ?? '';
  const label = searchParams.get('locLabel') ?? '';
  const source = searchParams.get('locSrc') ?? '';

  if (!city && !plz && !label) {
    return { skipped: false, location: null };
  }

  return {
    skipped: false,
    location: {
      city: city || undefined,
      plz: plz || undefined,
      label: label || undefined,
      source: source || undefined,
    },
  };
}

export function appendLocationToSearchParams(params, location, { radiusKm, locSkip } = {}) {
  if (locSkip) {
    params.set('locSkip', '1');
    return params;
  }
  if (!location || !hasAdvisorLocation(location)) return params;

  if (location.city) params.set('city', location.city);
  if (location.plz) params.set('plz', location.plz);
  if (location.label) params.set('locLabel', location.label);
  if (location.source) params.set('locSrc', location.source);
  if (radiusKm != null) params.set('radius', String(radiusKm));
  return params;
}
