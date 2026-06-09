import { parseLandingQuery } from '../landingAdvisorBridge.js';
import { parseLocationFromText } from '../../logic/advisorLocation.js';
import { FEATURE_CATALOG } from '../../data/features/featureCatalog.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { filterWishFeatures } from '../search/profileCriteriaCanonical.js';

const META_FEATURES = new Set(['elektro', 'benzin', 'reichweite', 'range_400', 'seats_7', 'family_suv']);

/**
 * Legacy-Katalog-Matching – nur Ergänzungen, die der Intent-Parser nicht strukturiert liefert.
 */
export function matchFeaturesFromText(text, intent = null) {
  const lower = text.toLowerCase();
  const found = new Set();

  for (const feature of FEATURE_CATALOG) {
    const patterns = [feature.label.toLowerCase(), ...(feature.aliases ?? [])];
    if (patterns.some((p) => lower.includes(p))) {
      found.add(feature.id);
    }
  }

  if (/familien.?suv|familienauto|familie.*suv/i.test(text)) {
    found.add('family_suv');
  }
  if (/hund|dog/i.test(text)) found.add('large_trunk');

  const parsedIntent = intent ?? parseSearchIntent(text);
  return filterWishFeatures([...found], parsedIntent);
}

/**
 * Wunsch-Features: Intent-Parser = Wahrheit, URL-Chips + Katalog gefiltert.
 */
export function resolveWishFeatures(text = '', urlFeatures = []) {
  const intent = parseSearchIntent(text);
  const fromCatalog = matchFeaturesFromText(text, intent);
  const merged = [...new Set([
    ...(intent.features ?? []),
    ...urlFeatures,
    ...fromCatalog,
  ])];
  return filterWishFeatures(merged, intent);
}

function parseModelFromText(text) {
  const lower = text.toLowerCase();
  const models = ['sportage', 'ev3', 'kuga', 'tucson', 'niro', 'ceed'];
  for (const m of models) {
    if (lower.includes(m)) {
      if (m === 'ev3') return 'EV3';
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  }
  return null;
}

function parseTrimFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('gt-line') || lower.includes('gt line')) return 'GT-line';
  if (lower.includes('spirit')) return 'Spirit';
  if (lower.includes('vision')) return 'Vision';
  if (lower.includes('st-line')) return 'ST-Line';
  return null;
}

export function parseCustomerWish(inputText = '', urlFeatures = []) {
  const text = (inputText ?? '').trim();
  const intent = parseSearchIntent(text);
  const landing = parseLandingQuery(text);
  const location = parseLocationFromText(text) ?? null;

  const features = resolveWishFeatures(text, urlFeatures).filter((id) => !META_FEATURES.has(id));

  const budget = {
    type: landing.profile.paymentType ?? 'leasing',
    maxMonthlyRate: landing.profile.desiredRate ?? null,
    maxPrice: landing.profile.maxPrice ?? null,
  };

  let vehicleType = null;
  if (/suv|familien/i.test(text)) vehicleType = 'SUV';
  else if (landing.profile.bodyType === 'suv') vehicleType = 'SUV';

  const usage = [];
  if (/familie|kinder|hund/i.test(text) || landing.profile.household) {
    usage.push('family');
  }
  if (/hund/i.test(text) || landing.profile.household === 'family-dog') {
    usage.push('dog');
  }

  return {
    features,
    budget,
    location: location
      ? {
          city: location.city ?? '',
          plz: location.plz ?? '',
          radiusKm: location.radiusKm ?? 25,
        }
      : null,
    vehicleType,
    usage,
    brand: null,
    model: parseModelFromText(text),
    trim: parseTrimFromText(text),
    rawQuery: text,
    intent,
  };
}

export function wishesToSummaryChips(wishes, { locationLabel = '', localized = false, radius = 25 } = {}) {
  const chips = [];

  if (localized && locationLabel) {
    chips.push({
      id: 'location',
      label: `${locationLabel} +${radius} km`,
      field: 'location',
    });
  } else if (wishes.location?.city) {
    chips.push({
      id: 'location',
      label: `${wishes.location.city} +${wishes.location.radiusKm ?? 25} km`,
      field: 'location',
    });
  }

  if (wishes.vehicleType) {
    chips.push({ id: 'type', label: wishes.vehicleType, field: 'type' });
  }

  if (wishes.usage.includes('family')) {
    chips.push({ id: 'family', label: 'Familie', field: 'family' });
  }

  for (const featureId of wishes.features) {
    const feature = FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) continue;
    if (['family_suv', 'elektro', 'benzin'].includes(featureId) && chips.some((c) => c.id === featureId)) continue;
    chips.push({
      id: featureId,
      label: feature.label,
      field: 'feature',
      featureId,
    });
  }

  if (wishes.budget.maxMonthlyRate) {
    chips.push({
      id: 'budget',
      label: `bis ${wishes.budget.maxMonthlyRate} €`,
      field: 'maxRate',
    });
  }

  return chips.slice(0, 8);
}
