/**
 * CleverQuote v2 – 50/20/15/10/5 Gewichtung (Phase 2).
 */
import { getCleverQuoteTier } from './cleverQuoteConstants.js';
import { evaluateVehicleForProfile } from '../cleverData/cleverDataEngine.js';
import { resolveCleverRecord } from '../../data/clever/cleverDataRegistry.js';

export const CLEVER_QUOTE_V2_WEIGHTS = {
  wish: 0.50,
  budget: 0.20,
  availability: 0.15,
  category: 0.10,
  popularity: 0.05,
};

function scoreBudget(profile, vehicle, record) {
  const maxMonthly = profile.maxMonthlyRate ?? profile.budget?.maxMonthlyRate ?? null;
  const maxPrice = profile.maxPrice ?? profile.budget?.maxPrice ?? null;
  const rate = vehicle.monthlyRate ?? record?.basis?.leasingRate ?? null;
  const cash = vehicle.cashPrice ?? record?.basis?.listPriceGross ?? null;

  if (maxMonthly != null && rate != null) {
    if (rate <= maxMonthly) return 100;
    const over = (rate - maxMonthly) / maxMonthly;
    return Math.max(0, Math.round(100 - over * 100));
  }
  if (maxPrice != null && cash != null) {
    if (cash <= maxPrice) return 100;
    const over = (cash - maxPrice) / maxPrice;
    return Math.max(0, Math.round(100 - over * 80));
  }
  return 85;
}

function scoreAvailability(vehicle, record) {
  const inStock = vehicle.availability === 'sofort' || vehicle.stockStatus === 'lager' || record?.basis?.inStock;
  if (inStock) return 100;
  const weeks = record?.basis?.deliveryWeeks ?? vehicle.deliveryTime ?? '';
  if (/4|5|6/.test(String(weeks))) return 85;
  if (/8|10|12/.test(String(weeks))) return 65;
  return 75;
}

function scoreCategory(profile, record) {
  if (!record?.cleverScores) return 70;
  const scores = record.cleverScores;
  if (profile.seatsMin >= 7) return (scores.familyVehicle ?? 7) * 10;
  if (profile.fuel === 'electric' || profile.fuel === 'elektro') {
    return (scores.commuter ?? 7) * 10;
  }
  if (profile.towCapacityKg >= 2000) return (scores.caravanReady ?? 7) * 10;
  return (scores.valuePick ?? 7) * 10;
}

function scorePopularity(record) {
  const raw = record?.popularityScore ?? 7;
  return Math.min(10, Math.max(1, raw)) * 10;
}

/**
 * @param {object} match
 * @param {object} profile SearchProfile
 */
export function computeCleverQuoteV2(match, profile) {
  if (!match?.vehicle || !profile) return null;

  const vehicle = match.vehicle;
  const record = resolveCleverRecord(vehicle);
  const evaluation = evaluateVehicleForProfile(profile, vehicle);
  const wishScore = evaluation.cleverQuotePercent ?? evaluation.recordEval?.wishPercent ?? 0;

  const components = {
    wish: Math.round(wishScore * CLEVER_QUOTE_V2_WEIGHTS.wish),
    budget: Math.round(scoreBudget(profile, vehicle, record) * CLEVER_QUOTE_V2_WEIGHTS.budget),
    availability: Math.round(scoreAvailability(vehicle, record) * CLEVER_QUOTE_V2_WEIGHTS.availability),
    category: Math.round(scoreCategory(profile, record) * CLEVER_QUOTE_V2_WEIGHTS.category),
    popularity: Math.round(scorePopularity(record) * CLEVER_QUOTE_V2_WEIGHTS.popularity),
  };

  const percent = Math.min(100, Math.max(0,
    components.wish + components.budget + components.availability + components.category + components.popularity,
  ));
  const tier = getCleverQuoteTier(percent);

  return {
    percent,
    tier,
    tierLabel: tier.label,
    dot: tier.dot,
    label: `CleverQuote ${percent} %`,
    matched: evaluation.fulfilledCount,
    scorableTotal: evaluation.totalChecks,
    total: evaluation.totalChecks,
    fulfillmentLabel: evaluation.totalChecks
      ? `${evaluation.fulfilledCount} von ${evaluation.totalChecks} Wünschen`
      : null,
    profileTruth: true,
    engineVersion: 2,
    components,
    items: evaluation.checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status === 'fulfilled' ? 'fulfilled' : check.status === 'unknown' ? 'uncertain' : 'missing',
      fulfilled: check.status === 'fulfilled',
      scorable: check.status !== 'unknown',
      detail: check.detail ?? null,
    })),
    trustNote: evaluation.unknownCount > 0
      ? `${evaluation.unknownCount} Eigenschaft${evaluation.unknownCount === 1 ? '' : 'en'} derzeit nicht in der Clever-Datenbank`
      : null,
    cleverRecordId: record?.id ?? null,
  };
}
