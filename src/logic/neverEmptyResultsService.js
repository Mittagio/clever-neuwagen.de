/**
 * Never Empty Results – Fallback-Ebenen für die Ergebnisseite
 */

import { filterMarketplaceVehicles } from './marketplaceService.js';
import { hasLocalizedSearch, adjustRateForTerm } from './oneSearchService.js';
import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';
import { countUniqueDealers } from './localOfferPresentation.js';

export const RESULT_STATES = {
  EXACT: 'exact',
  ALTERNATIVES: 'alternatives',
  EXPANDED: 'expanded',
  INSPIRATION: 'inspiration',
};

function prepareVehicles(vehicles, filters) {
  const withRates = vehicles.map((vehicle) => ({
    ...vehicle,
    displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),
  }));
  return filterMarketplaceVehicles(withRates, filters);
}

function runMatch(filters, wishes, vehicles) {
  return matchVehiclesToWish({
    wishes,
    vehicles,
    getDisplayRate: (v) => v.displayRate,
  });
}

function mergePatch(base, delta) {
  if (!delta || !Object.keys(delta).length) return base;
  return { ...base, ...delta };
}

const RELAXATION_STEPS = [
  (f) => (f.modelExplicit && f.model ? { model: '', brand: '', trim: '', modelExplicit: false } : null),
  (f) => (f.maxRate != null ? { maxRate: Math.min(Math.round(f.maxRate * 1.15), 800) } : null),
  (f) => (f.trim ? { trim: '' } : null),
  (f) => (f.availability ? { availability: '' } : null),
  (f) => (f.termMonths === 48 ? { termMonths: 36 } : null),
  (f) => (f.termMonths === 48 ? { termMonths: 60 } : null),
  (f) => (f.mileagePerYear === 10000 ? { mileagePerYear: 15000 } : null),
  (f) => (f.radius != null && f.radius <= 25 ? { radius: 50 } : null),
  (f) => (f.radius != null && f.radius <= 50 ? { radius: 100 } : null),
  (f) => (f.radius != null ? { radius: null, locSkip: false } : null),
];

function tryRelaxedMatches(filters, wishes, vehicles) {
  let patch = {};
  for (const step of RELAXATION_STEPS) {
    const delta = step({ ...filters, ...patch });
    if (!delta) continue;
    patch = mergePatch(patch, delta);
    const matches = runMatch({ ...filters, ...patch }, wishes, vehicles);
    if (matches.length > 0) {
      return { matches, patch, relaxed: true };
    }
  }
  return null;
}

function tryLooseMatches(filters, wishes, vehicles) {
  const loose = {
    ...filters,
    trim: '',
    maxRate: null,
    maxPrice: null,
    availability: '',
    excludedBrands: filters.excludedBrands ?? [],
    excludedModels: filters.excludedModels ?? [],
  };
  let matches = runMatch(loose, wishes, vehicles);
  if (matches.length > 0) return { matches, patch: loose, relaxed: true };

  const minimal = {
    query: filters.query,
    city: filters.city,
    plz: filters.plz,
    locLabel: filters.locLabel,
    locSkip: filters.locSkip,
    radius: filters.radius,
    fuel: filters.fuel,
    model: filters.model,
    type: filters.type || 'all',
    payment: filters.payment,
    termMonths: filters.termMonths,
    mileagePerYear: filters.mileagePerYear,
    sort: filters.sort,
    features: filters.features,
    brand: filters.brand,
    trim: '',
    maxRate: null,
    maxPrice: null,
    availability: '',
    household: '',
    seo: '',
    excludedBrands: filters.excludedBrands ?? [],
    excludedModels: filters.excludedModels ?? [],
    modelExplicit: filters.modelExplicit,
  };
  matches = runMatch(minimal, wishes, vehicles);
  if (matches.length > 0) return { matches, patch: minimal, relaxed: true };

  return null;
}

function pickPopularMatches(vehicles, filters, wishes, limit = 5) {
  const pool = vehicles;

  const sorted = [...pool].sort((a, b) => {
    const aSofort = a.availability === 'sofort' ? 1 : 0;
    const bSofort = b.availability === 'sofort' ? 1 : 0;
    if (bSofort !== aSofort) return bSofort - aSofort;
    return (a.monthlyRate ?? 999) - (b.monthlyRate ?? 999);
  });

  const matches = matchVehiclesToWish({
    wishes,
    vehicles: sorted.slice(0, Math.max(limit * 2, 8)),
    getDisplayRate: (v) => v.displayRate,
  });

  return matches.slice(0, limit);
}

function isVerySpecificSearch(filters, wishes) {
  let specificity = 0;
  if (filters.trim) specificity += 2;
  if (filters.maxRate) specificity += 1;
  if (filters.availability) specificity += 1;
  if (filters.model && filters.fuel) specificity += 2;
  if (wishes.features.length >= 3) specificity += 2;
  return specificity >= 4;
}

function buildStatus(state, matchCount, localized) {
  const near = localized ? ' in Ihrer Nähe' : '';

  if (state === RESULT_STATES.EXACT) {
    const n = matchCount;
    return {
      tone: 'success',
      title: `${n} passende Angebote${near} gefunden`,
      subtitle: null,
      hint: null,
    };
  }

  if (state === RESULT_STATES.INSPIRATION) {
    return {
      tone: 'guide',
      title: 'Für diese Kombination gibt es aktuell keine exakten Angebote',
      subtitle: 'Diese ähnlichen Fahrzeuge könnten trotzdem interessant sein.',
      hint: 'Wir haben Ihre Suche automatisch leicht erweitert, damit Sie trotzdem passende Fahrzeuge sehen.',
    };
  }

  return {
    tone: 'alternative',
    title: 'Kein exakter Treffer gefunden – wir zeigen passende Alternativen',
    subtitle: 'Diese Angebote kommen Ihrer Suche am nächsten.',
    hint: 'Wir haben Ihre Suche automatisch leicht erweitert, damit Sie trotzdem passende Fahrzeuge sehen.',
  };
}

function buildHeadline(state, filters, wishes, topMatch) {
  const model = wishes.model ?? filters.model ?? topMatch?.vehicle?.model;

  if (state === RESULT_STATES.EXACT) {
    if (model) {
      return {
        title: `Wir haben Ihren ${model} gefunden`,
        subtitle: null,
      };
    }
    return {
      title: 'Ihre passenden Angebote',
      subtitle: 'Wir haben passende Fahrzeuge für Ihre Suche gefunden',
    };
  }

  if (state === RESULT_STATES.INSPIRATION) {
    return {
      title: 'Ihre Suche ist sehr speziell',
      subtitle: 'Diese Fahrzeuge kommen ihr am nächsten',
    };
  }

  if (model) {
    return {
      title: `Kein exakter ${model}-Treffer`,
      subtitle: 'Diese Alternativen passen gut zu Ihrer Suche',
    };
  }

  return {
    title: 'Kein exakter Treffer – passende Alternativen',
    subtitle: 'Wir haben ähnliche Angebote für Sie gefunden',
  };
}

function heroMetaForState(state) {
  if (state === RESULT_STATES.EXACT) {
    return { isFallbackHero: false, heroBadge: 'Empfohlen für Ihre Suche' };
  }
  if (state === RESULT_STATES.INSPIRATION) {
    return { isFallbackHero: true, heroBadge: 'Nächstes passendes Angebot' };
  }
  return { isFallbackHero: true, heroBadge: 'Beste Alternative' };
}

/**
 * @param {object} params
 * @param {object} params.filters
 * @param {object} params.wishes
 * @param {Array} params.exactMatches
 * @param {Array} params.allVehicles
 */
export function buildNeverEmptyResults({ filters, wishes, exactMatches, allVehicles }) {
  const vehicles = prepareVehicles(allVehicles, filters);
  const localized = hasLocalizedSearch(filters);

  if (exactMatches.length > 0) {
    const topMatch = exactMatches[0];
    const restMatches = exactMatches.slice(1, 9);
    const offerCount = exactMatches.length;
    const state = RESULT_STATES.EXACT;
    const popularMatches = pickPopularMatches(vehicles, filters, wishes, 5).filter(
      (m) => !exactMatches.some((e) => e.vehicleId === m.vehicleId),
    );

    return {
      state,
      status: buildStatus(state, offerCount, localized),
      headline: buildHeadline(state, filters, wishes, topMatch),
      topMatch,
      restMatches,
      alternativeMatches: [],
      popularMatches,
      showAlternativeSection: false,
      showExpandedHint: false,
      offerCount,
      dealerCount: countUniqueDealers(exactMatches.map((m) => m.vehicle)),
      ...heroMetaForState(state),
    };
  }

  let resolved = tryRelaxedMatches(filters, wishes, vehicles);
  if (!resolved) resolved = tryLooseMatches(filters, wishes, vehicles);

  if (!resolved || resolved.matches.length === 0) {
    const allRanked = matchVehiclesToWish({
      wishes,
      vehicles,
      getDisplayRate: (v) => v.displayRate,
    });
    resolved = { matches: allRanked, patch: {}, relaxed: true };
  }

  const verySpecific = isVerySpecificSearch(filters, wishes);
  const state = verySpecific ? RESULT_STATES.INSPIRATION : RESULT_STATES.ALTERNATIVES;
  const topMatch = resolved.matches[0];
  const restMatches = resolved.matches.slice(1, 9);
  const alternativeMatches = resolved.matches.slice(1, 6);
  const popularMatches = pickPopularMatches(vehicles, filters, wishes, 5).filter(
    (m) => m.vehicleId !== topMatch?.vehicleId && !restMatches.some((r) => r.vehicleId === m.vehicleId),
  );

  return {
    state,
    status: buildStatus(state, resolved.matches.length, localized),
    headline: buildHeadline(state, filters, wishes, topMatch),
    topMatch,
    restMatches,
    alternativeMatches,
    popularMatches,
    showAlternativeSection: true,
    showExpandedHint: resolved.relaxed,
    offerCount: 0,
    exactCount: 0,
    dealerCount: countUniqueDealers(resolved.matches.map((m) => m.vehicle)),
    ...heroMetaForState(state),
  };
}
