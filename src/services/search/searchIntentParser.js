/**
 * Intent-basiertes Parsing – keine naive Volltextsuche auf Modellnamen
 */

import { parseLocationFromText } from '../../logic/advisorLocation.js';
import {
  FEATURE_SYNONYM_GROUPS,
  PROTECTED_NUMBER_CONTEXTS,
  FUEL_SYNONYMS,
  PAYMENT_SYNONYMS,
  AVAILABILITY_SYNONYMS,
  MODEL_CATALOG,
  BRAND_PATTERNS,
  TRIM_PATTERNS,
} from '../../data/search/featureSynonyms.js';
import { normalizeQuery } from './queryNormalizer.js';
import { typoTolerantSearchText } from './typoTolerantNormalize.js';
import { POWER_PS_TOLERANCE } from '../../data/search/searchTermDictionary.js';
import { isModelExplicitlyRequested } from './modelIntent.js';

const EMPTY_INTENT = () => ({
  rawQuery: '',
  normalizedQuery: '',
  payment: null,
  maxRate: null,
  maxPrice: null,
  fuel: null,
  brand: null,
  model: null,
  modelExplicit: false,
  trim: null,
  bodyType: null,
  transmission: null,
  availability: null,
  location: null,
  radiusKm: null,
  mileagePerYear: null,
  durationMonths: null,
  features: [],
  towCapacityKg: null,
  rangeKmMin: null,
  seatsMin: null,
  powerPsTarget: null,
  powerPsMin: null,
  powerPsMax: null,
  confidence: 0,
  warnings: [],
  possibleCorrections: [],
  ambiguousTerms: [],
  fuzzySuggestions: [],
  corrections: [],
  consumedSpans: [],
});

function markSpan(spans, start, end) {
  spans.push({ start, end });
}

function isSpanConsumed(spans, index) {
  return spans.some((s) => index >= s.start && index < s.end);
}

function findPhrase(text, phrase) {
  const p = phrase.toLowerCase().trim();
  const idx = text.indexOf(p);
  if (idx === -1) return null;
  return { start: idx, end: idx + p.length };
}

function extractFeatures(text, spans) {
  const features = new Set();
  const sorted = [...FEATURE_SYNONYM_GROUPS].sort(
    (a, b) => Math.max(...b.patterns.map((p) => p.length)) - Math.max(...a.patterns.map((p) => p.length)),
  );

  for (const group of sorted) {
    for (const pattern of group.patterns) {
      const span = findPhrase(text, pattern);
      if (span && !isSpanConsumed(spans, span.start)) {
        features.add(group.id);
        markSpan(spans, span.start, span.end);

        if (group.id === 'camera_360' && /\b360\b/.test(text.slice(span.start, span.end + 5))) {
          const m360 = text.match(/\b360\b/);
          if (m360) markSpan(spans, m360.index, m360.index + 3);
        }
        break;
      }
    }
  }

  return [...features];
}

function is360CameraContext(text, matchIndex) {
  const window = text.slice(Math.max(0, matchIndex - 25), matchIndex + 35);
  return /\b(grad|kamera|cam|rundum|view|sensor|surround|bird|park|°)\b/i.test(window);
}

function protectAmbiguousNumbers(text, spans, features, ambiguous) {
  const m360 = [...text.matchAll(/\b360\b/g)];
  for (const match of m360) {
    const idx = match.index;
    if (isSpanConsumed(spans, idx)) continue;
    if (is360CameraContext(text, idx)) {
      if (!features.includes('camera_360')) features.push('camera_360');
      markSpan(spans, idx, idx + 3);
      ambiguous.push({ term: '360', suggestion: 'camera_360', label: '360° Kamera' });
    } else if (/\bferrari\b/.test(text)) {
      ambiguous.push({ term: '360', suggestion: 'model_ferrari_360', label: 'Ferrari 360' });
    } else {
      ambiguous.push({ term: '360', suggestion: 'camera_360', label: '360° Kamera' });
    }
  }
}

function extractFuel(text, spans) {
  for (const [fuel, phrases] of Object.entries(FUEL_SYNONYMS)) {
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
      const span = findPhrase(text, phrase);
      if (span && !isSpanConsumed(spans, span.start)) {
        markSpan(spans, span.start, span.end);
        return fuel === 'plugin_hybrid' ? 'plugin-hybrid' : fuel === 'verbrenner' ? 'verbrenner' : fuel;
      }
    }
  }
  return null;
}

function extractPayment(text, spans) {
  for (const [payment, phrases] of Object.entries(PAYMENT_SYNONYMS)) {
    for (const phrase of phrases) {
      const span = findPhrase(text, phrase);
      if (span && !isSpanConsumed(spans, span.start)) {
        markSpan(spans, span.start, span.end);
        return payment === 'finance' ? 'finance' : payment;
      }
    }
  }
  return null;
}

function extractAvailability(text, spans) {
  for (const phrase of AVAILABILITY_SYNONYMS.sofort) {
    const span = findPhrase(text, phrase);
    if (span && !isSpanConsumed(spans, span.start)) {
      markSpan(spans, span.start, span.end);
      return 'sofort_verfuegbar';
    }
  }
  return null;
}

function hasRateContext(text) {
  return /leasing|finanzier|monat|rate|mtl|\/\s*monat|pro monat/i.test(text);
}

function hasPriceContext(text) {
  return /kauf|bar|unter|preis|einmal|neupreis/i.test(text);
}

function hasRangeContext(text, nearIndex) {
  const window = text.slice(Math.max(0, nearIndex - 20), nearIndex + 25);
  return /\b(km|kilometer|reichweite|range)\b/i.test(window);
}

function extractMoneyAndRange(text, spans) {
  let maxRate = null;
  let maxPrice = null;
  let rangeKmMin = null;

  const kmBisEuro = text.match(/(\d{2,4})\s*km\s+bis\s+(\d{2,4})\s*€/i);
  if (kmBisEuro) {
    rangeKmMin = Number(kmBisEuro[1]);
    maxRate = Number(kmBisEuro[2]);
    markSpan(spans, kmBisEuro.index, kmBisEuro.index + kmBisEuro[0].length);
  }

  const rangeRe = /(?:über|ueber|ab|mindestens|mehr als)\s*(\d{2,4})\s*km\b/gi;
  let rm;
  while ((rm = rangeRe.exec(text)) !== null) {
    rangeKmMin = Number(rm[1]);
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  const kmRe = /(\d{2,4})\s*km\b/gi;
  while ((rm = kmRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    if (hasRangeContext(text, rm.index)) {
      const val = Number(rm[1]);
      const before = text.slice(Math.max(0, rm.index - 20), rm.index);
      if (
        /über|ueber|ab|mindestens|mehr/.test(before)
        || /\be-?auto|elektro|reichweite\b/i.test(text.slice(Math.max(0, rm.index - 35), rm.index))
      ) {
        rangeKmMin = val;
      }
      markSpan(spans, rm.index, rm.index + rm[0].length);
    }
  }

  const bisEuroRe = /\bbis\s+(\d{2,4})\s*€/gi;
  while ((rm = bisEuroRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    maxRate = Number(rm[1]);
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  const euroRe = /(?:bis|unter|max\.?|maximal)?\s*(\d{1,3}(?:\.\d{3})*|\d{2,6})\s*€/gi;
  while ((rm = euroRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    const raw = rm[1].replace(/\./g, '');
    const val = Number(raw);
    const ctx = text.slice(Math.max(0, rm.index - 30), rm.index + rm[0].length + 10);

    if (hasRangeContext(ctx, 10)) continue;

    if (val >= 5000 || (hasPriceContext(ctx) && !hasRateContext(ctx))) {
      maxPrice = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    } else if (hasRateContext(ctx) || val <= 999) {
      maxRate = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    } else if (!maxRate && !maxPrice) {
      maxRate = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    }
  }

  const bisRe = /\bbis\s+(\d{2,4})\b/gi;
  while ((rm = bisRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    const val = Number(rm[1]);
    if (hasRangeContext(text, rm.index + rm[0].length)) {
      rangeKmMin = val;
    } else if (hasRateContext(text) || val <= 800) {
      maxRate = val;
    } else if (hasPriceContext(text)) {
      maxPrice = val;
    } else {
      maxRate = val;
    }
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  return { maxRate, maxPrice, rangeKmMin };
}

function extractTowCapacity(text, spans) {
  const ton = text.match(/(\d+(?:[.,]\d+)?)\s*tonnen?\b/i);
  if (ton && !isSpanConsumed(spans, ton.index)) {
    const t = Number(ton[1].replace(',', '.'));
    markSpan(spans, ton.index, ton.index + ton[0].length);
    return Math.round(t * 1000);
  }
  const kg = text.match(/(\d{3,5})\s*kg\s*(?:anhängelast|anhaengelast|ziehen)?/i);
  if (kg && !isSpanConsumed(spans, kg.index)) {
    markSpan(spans, kg.index, kg.index + kg[0].length);
    return Number(kg[1]);
  }
  const twoTon = text.match(/\b2\s*tonnen?\b/i);
  if (twoTon && !isSpanConsumed(spans, twoTon.index)) {
    markSpan(spans, twoTon.index, twoTon.index + twoTon[0].length);
    return 2000;
  }
  return null;
}

function extractTransmission(text, spans) {
  if (/\bautomatik\b|\bdsg\b|\bautom\.?\b/i.test(text)) {
    const m = text.match(/\b(automatik|dsg)\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
    return 'automatic';
  }
  const manualRe = /\b(schaltgetriebe|schalte|handgeschaltet|manuell|schalter|handschalter)\b/i;
  const mm = text.match(manualRe);
  if (mm) {
    markSpan(spans, mm.index, mm.index + mm[0].length);
    return 'manual';
  }
  return null;
}

function extractMileageAndTerm(text, spans) {
  let mileagePerYear = null;
  let durationMonths = null;

  const my = text.match(/(\d{1,2})\.?\s*000\s*km\s*(?:\/|pro)?\s*(?:jahr|j\.?)/i)
    ?? text.match(/(\d{4,5})\s*km\s*(?:\/|pro)?\s*jahr/i);
  if (my) {
    mileagePerYear = Number(my[1].replace('.', '')) >= 100
      ? Number(my[1].replace('.', ''))
      : Number(my[1]) * 1000;
    markSpan(spans, my.index, my.index + my[0].length);
  }

  const term = text.match(/(\d{2})\s*monate/i);
  if (term) {
    durationMonths = Number(term[1]);
    markSpan(spans, term.index, term.index + term[0].length);
  }

  return { mileagePerYear, durationMonths };
}

function extractBrandModelTrim(text, spans, features) {
  let brand = null;
  let model = null;
  let trim = null;
  let bodyType = null;

  for (const bp of BRAND_PATTERNS) {
    for (const p of bp.patterns) {
      const span = findPhrase(text, p);
      if (span && !isSpanConsumed(spans, span.start)) {
        brand = bp.brand;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (brand) break;
  }

  for (const entry of MODEL_CATALOG) {
    if (entry.requireBrand && entry.brand !== brand) continue;
    if (entry.model === '360' && features.includes('camera_360')) continue;

    for (const p of entry.patterns) {
      const span = findPhrase(text, p);
      if (span && !isSpanConsumed(spans, span.start)) {
        if (entry.model === '360' && !/\bferrari\b/.test(text)) continue;
        brand = brand ?? entry.brand;
        model = entry.model;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (model) break;
  }

  for (const tp of TRIM_PATTERNS) {
    for (const p of tp.patterns) {
      const span = findPhrase(text, p.trim());
      if (span && !isSpanConsumed(spans, span.start)) {
        trim = tp.trim;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (trim) break;
  }

  if (/\bsuv\b|geländewagen|gelaendewagen/i.test(text)) bodyType = 'suv';
  if (/\bkombi\b/i.test(text)) bodyType = 'kombi';
  if (/\bkleinwagen\b/i.test(text)) bodyType = 'kleinwagen';

  return { brand, model, trim, bodyType };
}

function extractPowerPs(text, spans) {
  const m = text.match(/\b(?:r)?\s*(\d{2,3})\s*ps\b/i);
  if (!m || isSpanConsumed(spans, m.index)) return null;
  const target = Number(m[1]);
  markSpan(spans, m.index, m.index + m[0].length);
  const approx = /\b(ca\.?|circa|ungefähr|ungefaehr|etwa|rund)\b/i.test(text);
  const minimum = /\b(mindestens|min\.|ab)\b/i.test(text);
  let min = target - POWER_PS_TOLERANCE;
  let max = target + POWER_PS_TOLERANCE;
  if (approx) {
    min = target - 20;
    max = target + 20;
  }
  if (minimum) {
    min = target;
    max = null;
  }
  return {
    powerPsTarget: target,
    powerPsMin: min,
    powerPsMax: max,
  };
}

function computeConfidence(intent) {
  let score = 0.2;
  const fields = [
    intent.fuel, intent.payment, intent.model, intent.brand,
    intent.maxRate, intent.maxPrice, intent.availability,
  ];
  for (const f of fields) if (f) score += 0.1;
  if (intent.features.length) score += 0.08 * intent.features.length;
  if (intent.rangeKmMin) score += 0.1;
  if (intent.towCapacityKg) score += 0.1;
  if (intent.location) score += 0.08;
  if (intent.powerPsTarget) score += 0.08;
  return Math.min(1, score);
}

/**
 * @param {string} input
 * @returns {import('./searchIntentTypes.js').SearchIntent}
 */
export function parseSearchIntent(input) {
  const rawQuery = String(input ?? '').trim();
  if (!rawQuery) return EMPTY_INTENT();

  const tolerant = typoTolerantSearchText(rawQuery);
  const text = tolerant.text;
  const spans = [];
  const ambiguousTerms = [];

  let features = extractFeatures(text, spans);
  for (const fid of tolerant.resolvedFeatures ?? []) {
    if (!features.includes(fid)) features.push(fid);
  }
  protectAmbiguousNumbers(text, spans, features, ambiguousTerms);

  const towCapacityKg = extractTowCapacity(text, spans);
  if (towCapacityKg && !features.includes('towbar')) features.push('towbar');

  const fuel = extractFuel(text, spans);
  const payment = extractPayment(text, spans);
  const availability = extractAvailability(text, spans);
  const { maxRate, maxPrice, rangeKmMin } = extractMoneyAndRange(text, spans);
  const transmission = extractTransmission(text, spans);
  const { mileagePerYear, durationMonths } = extractMileageAndTerm(text, spans);
  let { brand, model, trim, bodyType } = extractBrandModelTrim(text, spans, features);
  if (!bodyType && tolerant.bodyType) bodyType = tolerant.bodyType;
  let modelExplicit = Boolean(model && isModelExplicitlyRequested(rawQuery, { brand, model }));
  if (!modelExplicit) {
    model = null;
    if (!brand || !/\b(kia|ford|hyundai|mg|ferrari)\b/i.test(rawQuery)) {
      brand = null;
    }
  }

  const power = extractPowerPs(text, spans);

  const locParsed = parseLocationFromText(rawQuery);
  const location = locParsed?.city ?? locParsed?.plz ?? locParsed?.label ?? null;

  let seatsMin = null;
  if (/7\s*-?\s*sitzer|sieben\s*sitz|7\s*pl[aä]tze|7\s*personen/i.test(text)) {
    seatsMin = 7;
    if (!features.includes('seats_7')) features.push('seats_7');
    const span = findPhrase(text, '7-sitzer') ?? findPhrase(text, '7 sitzer') ?? findPhrase(text, 'siebensitzer');
    if (span) markSpan(spans, span.start, span.end);
  }
  const seats = text.match(/(\d)\s*-?\s*sitz/i);
  if (seats) seatsMin = Number(seats[1]);

  const intent = {
    rawQuery,
    normalizedQuery: text,
    payment: payment ?? (maxRate && !maxPrice ? 'leasing' : null),
    maxRate,
    maxPrice,
    fuel,
    brand,
    model,
    modelExplicit,
    trim,
    bodyType,
    transmission,
    availability,
    location,
    radiusKm: locParsed?.radiusKm ?? null,
    mileagePerYear,
    durationMonths,
    features: [...new Set(features)],
    towCapacityKg,
    rangeKmMin,
    seatsMin,
    powerPsTarget: power?.powerPsTarget ?? null,
    powerPsMin: power?.powerPsMin ?? null,
    powerPsMax: power?.powerPsMax ?? null,
    confidence: 0,
    warnings: [],
    possibleCorrections: [],
    ambiguousTerms,
    fuzzySuggestions: tolerant.suggestions ?? [],
    corrections: tolerant.corrections ?? [],
    consumedSpans: spans,
  };

  if (!intent.payment && intent.maxPrice && !intent.maxRate) {
    intent.payment = 'cash';
  }
  if (!intent.payment && intent.maxRate) {
    intent.payment = 'leasing';
  }

  intent.confidence = computeConfidence(intent);
  return intent;
}

export function intentToResidualQuery(intent) {
  return intent.rawQuery.length > 0 && intent.confidence < 0.35 ? intent.rawQuery : '';
}
