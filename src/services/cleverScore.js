/** Clever Score 0–100 – zentral, ohne Zirkular-Imports */

export const CLEVER_SCORE_WEIGHTS = {
  priceValue: 0.2,
  leasingRate: 0.18,
  deliveryTime: 0.12,
  demand: 0.15,
  equipment: 0.1,
  range: 0.1,
  familyFriendly: 0.15,
};

function clampScore(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function calculateCleverScore(factors, weights = CLEVER_SCORE_WEIGHTS) {
  const dims = {
    priceValue: factors.priceValue ?? 0.5,
    leasingRate: factors.leasingRate ?? 0.5,
    deliveryTime: factors.deliveryTime ?? 0.5,
    demand: factors.demand ?? 0.5,
    equipment: factors.equipment ?? 0.5,
    range: factors.range ?? 0.5,
    familyFriendly: factors.familyFriendly ?? 0.5,
  };

  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (dims[key] != null) {
      total += dims[key] * weight;
      weightSum += weight;
    }
  }

  return clampScore((total / (weightSum || 1)) * 100);
}

export function updateCleverScoreWeights(newWeights) {
  return { ...CLEVER_SCORE_WEIGHTS, ...newWeights };
}
