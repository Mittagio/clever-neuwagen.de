/**
 * Schicht 1: Strukturiertes Suchprofil – Übersetzung des Kundenwunsches.
 * Entscheidet NICHT über Fahrzeuge – nur über Anforderungen.
 */

import { parseSearchIntent } from './searchIntentParser.js';
import { normalizeFeatureIdsToInternal } from './canonicalFeatureIds.js';

const META_FEATURES = new Set(['elektro', 'benzin', 'reichweite', 'family_suv']);

const FUEL_MAP = {
  elektro: 'electric',
  electric: 'electric',
  hybrid: 'hybrid',
  'plugin-hybrid': 'plugin_hybrid',
  plugin_hybrid: 'plugin_hybrid',
  verbrenner: 'combustion',
  benzin: 'combustion',
  diesel: 'combustion',
};

/**
 * @typedef {object} SearchProfile
 * @property {string|null} fuel
 * @property {number|null} seatsMin
 * @property {number|null} maxMonthlyRate
 * @property {number|null} maxPrice
 * @property {string|null} bodyType
 * @property {string|null} bodyClass
 * @property {string|null} transmission
 * @property {string|null} model
 * @property {string|null} trim
 * @property {string|null} brand
 * @property {boolean} modelExplicit
 * @property {string[]} requiredFeatures
 * @property {string[]} softPreferences
 * @property {number} confidence
 * @property {string} rawQuery
 */

export function mapIntentFuel(fuel) {
  if (!fuel) return null;
  return FUEL_MAP[fuel] ?? fuel;
}

export function buildSearchProfile({
  query = '',
  intent = null,
  filters = {},
  wishes = {},
  chipIds = [],
} = {}) {
  const parsed = intent ?? parseSearchIntent(query || filters.query || wishes.rawQuery || '');

  let seatsMin = parsed.seatsMin ?? filters.seatsMin ?? null;
  const features = [...new Set([
    ...(parsed.features ?? []),
    ...(filters.features ?? []),
    ...(wishes.features ?? []),
  ])];

  if (features.includes('seats_7') && (seatsMin == null || seatsMin < 7)) {
    seatsMin = 7;
  }

  let fuel = mapIntentFuel(parsed.fuel ?? filters.fuel ?? null);
  if (!fuel && (features.includes('elektro') || wishes.powertrain === 'elektro')) {
    fuel = 'electric';
  }
  if (!fuel && features.includes('benzin')) fuel = 'combustion';

  let bodyType = parsed.bodyType ?? null;
  if (!bodyType && filters.type && !['all', 'elektro', 'verbrenner', 'hybrid', 'plugin-hybrid'].includes(filters.type)) {
    bodyType = filters.type;
  }
  if (chipIds.includes('type_kleinwagen')) bodyType = 'kleinwagen';
  if (chipIds.includes('type_suv')) bodyType = 'suv';

  const requiredFeatures = normalizeFeatureIdsToInternal(
    features.filter((f) => !META_FEATURES.has(f)),
  );

  // Sitzanzahl wird über seatsMin + Modell-Fakten geprüft – nicht als Trim-Paket
  if (seatsMin != null && seatsMin >= 7) {
    const seatIdx = requiredFeatures.indexOf('seats_7');
    if (seatIdx !== -1) requiredFeatures.splice(seatIdx, 1);
  }

  if (chipIds.includes('fuel_elektro')) fuel = 'electric';
  if (chipIds.includes('heated_seats') && !requiredFeatures.includes('heated_seats')) {
    requiredFeatures.push('heated_seats');
  }
  if (!fuel && requiredFeatures.includes('heat_pump')) fuel = 'electric';

  const rangeKmMin = parsed.rangeKmMin ?? filters.rangeKmMin ?? null;

  return {
    fuel,
    seatsMin,
    maxMonthlyRate: parsed.maxRate ?? filters.maxRate ?? wishes.budget?.maxMonthlyRate ?? null,
    maxPrice: parsed.maxPrice ?? filters.maxPrice ?? wishes.budget?.maxPrice ?? null,
    minRangeKm: rangeKmMin,
    bodyType,
    bodyClass: bodyType === 'kleinwagen' ? 'kleinwagen' : null,
    transmission: parsed.transmission ?? filters.transmission ?? null,
    model: parsed.modelExplicit ? (parsed.model ?? filters.model) : null,
    trim: parsed.modelExplicit ? (parsed.trim ?? filters.trim) : null,
    brand: parsed.modelExplicit ? (parsed.brand ?? filters.brand) : null,
    modelExplicit: Boolean(parsed.modelExplicit ?? filters.modelExplicit),
    requiredFeatures,
    softPreferences: [],
    confidence: parsed.confidence ?? 0.5,
    rawQuery: parsed.rawQuery ?? query,
    availability: parsed.availability ?? filters.availability ?? null,
    rangeKmMin,
    payment: (parsed.paymentExplicit && parsed.payment)
      ? parsed.payment
      : (filters.payment || wishes.budget?.type || null),
  };
}

/** Für OpenAI Structured Outputs – nur Suchprofil, keine Fahrzeugauswahl. */
export const SEARCH_PROFILE_JSON_SCHEMA = {
  name: 'customer_search_profile',
  schema: {
    type: 'object',
    properties: {
      fuel: { type: ['string', 'null'], enum: ['electric', 'hybrid', 'plugin_hybrid', 'combustion', null] },
      minRangeKm: { type: ['integer', 'null'] },
      seatsMin: { type: ['integer', 'null'] },
      requiredFeatures: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'camera_360', 'heat_pump', 'heated_front_seats', 'electric_tailgate',
            'blind_spot', 'towbar', 'panorama_roof', 'rear_camera', 'steering_heat',
          ],
        },
      },
      softPreferences: { type: 'array', items: { type: 'string' } },
      budget: {
        type: ['object', 'null'],
        properties: {
          type: { type: 'string', enum: ['leasing', 'cash', 'finance'] },
          maxMonthlyRate: { type: ['number', 'null'] },
          maxPrice: { type: ['number', 'null'] },
        },
        additionalProperties: false,
      },
      confidence: { type: 'number' },
    },
    required: ['requiredFeatures', 'softPreferences', 'confidence'],
    additionalProperties: false,
  },
};
