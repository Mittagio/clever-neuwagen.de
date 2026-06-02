import { getFeatureLabel } from '../data/features/featureCatalog.js';
import { filterMarketplaceVehicles } from './marketplaceService.js';
import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';
import { adjustRateForTerm } from './oneSearchService.js';

function countMatches(vehicles, filters, patch, wishes) {
  const merged = { ...filters, ...patch };
  const filtered = filterMarketplaceVehicles(vehicles, merged).map((vehicle) => ({
    ...vehicle,
    displayRate: adjustRateForTerm(vehicle.monthlyRate, merged.termMonths ?? 48),
  }));

  if (wishes?.length) {
    return matchVehiclesToWish({
      wishes,
      vehicles: filtered,
      getDisplayRate: (v) => v.displayRate,
    }).length;
  }

  return filtered.length;
}

function radiusLabel(radius) {
  if (radius == null) return 'Deutschlandweit';
  return `${radius} km Radius`;
}

function buildRadiusInsight(filters, vehicles, wishes, currentCount) {
  const currentRadius = filters.radius;
  if (currentRadius == null) return null;

  let next = null;
  if (currentRadius <= 25) next = 50;
  else if (currentRadius <= 50) next = 100;
  else if (currentRadius <= 100) next = null;
  else return null;

  const nextCount = countMatches(vehicles, filters, { radius: next }, wishes);
  const extra = nextCount - currentCount;
  if (extra <= 0) return null;

  return {
    id: `radius-${next ?? 'de'}`,
    kind: 'radius',
    headline: `Mit ${radiusLabel(next)} finden wir`,
    body: `${extra} weitere passende Fahrzeuge.`,
    actionLabel: next == null ? 'Deutschlandweit suchen' : 'Radius erweitern',
    patch: { radius: next },
    extraCount: extra,
  };
}

function buildBudgetInsight(filters, vehicles, wishes, currentCount) {
  if (filters.maxRate == null) return null;

  const bump = filters.maxRate <= 300 ? 50 : 100;
  const nextRate = Math.min(filters.maxRate + bump, 800);
  if (nextRate <= filters.maxRate) return null;

  const nextCount = countMatches(vehicles, filters, { maxRate: nextRate }, wishes);
  const extra = nextCount - currentCount;
  if (extra <= 0) return null;

  return {
    id: `budget-${nextRate}`,
    kind: 'budget',
    headline: `Mit ${nextRate} € monatlich erhalten Sie`,
    body: `${extra} weitere Treffer.`,
    actionLabel: 'Budget erhöhen',
    patch: { maxRate: nextRate },
    extraCount: extra,
  };
}

function buildHybridInsight(filters, vehicles, wishes, currentCount) {
  const isElectroOnly = filters.fuel === 'elektro'
    || filters.type === 'elektro'
    || /elektro|ev\b|strom/i.test(filters.query ?? '');

  if (!isElectroOnly) return null;

  const nextCount = countMatches(
    vehicles,
    filters,
    { fuel: '', type: 'hybrid', features: filters.features },
    wishes,
  );
  const extra = nextCount - currentCount;
  if (extra <= 0) return null;

  return {
    id: 'hybrid-alt',
    kind: 'alternative',
    headline: 'Passt auch als Hybrid',
    body: `${extra} Hybrid-Angebote in Ihrer Nähe.`,
    actionLabel: 'Hybrid anzeigen',
    patch: { fuel: 'hybrid', type: 'hybrid' },
    extraCount: extra,
  };
}

function buildFeatureInsight(filters, topMatch) {
  if (!topMatch?.availableWithPackage?.length) return null;

  const featureId = topMatch.availableWithPackage[0];
  if (filters.features?.includes(featureId)) return null;

  const label = getFeatureLabel(featureId);
  const model = topMatch.model ?? topMatch.vehicle?.model ?? 'Dieses Modell';

  return {
    id: `feature-${featureId}`,
    kind: 'feature',
    headline: `${model} ist aktuell auch`,
    body: `mit ${label} verfügbar.`,
    actionLabel: 'Anzeigen',
    patch: { features: [...(filters.features ?? []), featureId] },
    extraCount: null,
  };
}

function buildAvailabilityInsight(filters, vehicles, wishes, currentCount) {
  if (filters.availability === 'sofort') return null;

  const nextCount = countMatches(vehicles, filters, { availability: 'sofort' }, wishes);
  const extra = nextCount - currentCount;
  if (extra <= 0) return null;

  return {
    id: 'avail-sofort',
    kind: 'availability',
    headline: 'Sofort verfügbare Fahrzeuge',
    body: `${extra} Angebote können schneller geliefert werden.`,
    actionLabel: 'Sofort verfügbar',
    patch: { availability: 'sofort' },
    extraCount: extra,
  };
}

/**
 * Intelligente, konkrete Suchvorschläge — keine Chat-UI.
 * @returns {import('./cleverInsightsService.js').CleverInsight[]}
 */
export function buildCleverInsights({
  filters,
  vehicles,
  wishes = [],
  wishMatches = [],
  maxInsights = 3,
}) {
  const currentCount = wishMatches.length
    || countMatches(vehicles, filters, {}, wishes);

  const candidates = [
    buildRadiusInsight(filters, vehicles, wishes, currentCount),
    buildBudgetInsight(filters, vehicles, wishes, currentCount),
    buildHybridInsight(filters, vehicles, wishes, currentCount),
    buildFeatureInsight(filters, wishMatches[0]),
    buildAvailabilityInsight(filters, vehicles, wishes, currentCount),
  ].filter(Boolean);

  const seen = new Set();
  return candidates
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, maxInsights);
}

/** Kompakte Variante für Mobile-Tipp (ein Vorschlag). */
export function pickMobileInsight(insights) {
  return insights[0] ?? null;
}

/**
 * @typedef {Object} CleverInsight
 * @property {string} id
 * @property {string} kind
 * @property {string} headline
 * @property {string} body
 * @property {string} actionLabel
 * @property {Record<string, unknown>} patch
 * @property {number|null} extraCount
 */
