import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import {
  getModelTrims,
  getTrimConfig,
  inferTrimFromTitle,
  normalizeModelKey,
  TRIM_FEATURE_MAP,
} from '../../data/features/trimFeatureMapping.js';

const WEIGHTS = {
  features: 0.45,
  budget: 0.25,
  distance: 0.15,
  delivery: 0.1,
  availability: 0.05,
};

function featuresFromEquipment(equipment = []) {
  const text = equipment.join(' ').toLowerCase();
  const found = [];
  if (/360|kamera|rundum/i.test(text)) found.push('camera_360');
  if (/totwinkel|blind/i.test(text)) found.push('blind_spot');
  if (/sitzheizung|sitzklima|wärme/i.test(text)) found.push('heated_seats');
  if (/anhänger|kupplung/i.test(text)) found.push('towbar');
  if (/rückfahr|park/i.test(text)) found.push('parking_rear');
  return found;
}

function scoreTrimAgainstFeatures(trim, wishFeatureIds) {
  if (!trim || !wishFeatureIds.length) {
    return {
      matchedFeatures: [],
      missingFeatures: [],
      availableWithPackage: [],
      wishesTotal: wishFeatureIds.length,
      wishesMatched: 0,
    };
  }

  const matched = [];
  const missing = [];
  const viaPackage = [];

  for (const fid of wishFeatureIds) {
    if (trim.standardFeatures.includes(fid)) {
      matched.push(fid);
    } else if (trim.availableViaPackage.includes(fid)) {
      viaPackage.push(fid);
    } else if (trim.notAvailable.includes(fid)) {
      missing.push(fid);
    } else {
      missing.push(fid);
    }
  }

  const wishesMatched = matched.length + viaPackage.length * 0.7;

  return {
    matchedFeatures: matched,
    missingFeatures: missing,
    availableWithPackage: viaPackage,
    wishesTotal: wishFeatureIds.length,
    wishesMatched: Math.round(wishesMatched),
  };
}

function findBestTrim(modelKey, wishFeatureIds, equipmentExtras = []) {
  const trims = getModelTrims(modelKey);
  if (!trims.length) return null;

  let best = null;
  let bestScore = -1;

  for (const trim of trims) {
    const effectiveTrim = {
      ...trim,
      standardFeatures: [...new Set([...trim.standardFeatures, ...equipmentExtras])],
    };
    const result = scoreTrimAgainstFeatures(effectiveTrim, wishFeatureIds);
    const score = result.wishesMatched / Math.max(result.wishesTotal, 1);
    if (score > bestScore) {
      bestScore = score;
      best = { trim: effectiveTrim, ...result };
    }
  }

  return best;
}

function budgetScore(vehicle, wishes, displayRate) {
  const max = wishes.budget?.maxMonthlyRate;
  if (!max) return 1;
  const rate = displayRate ?? vehicle.monthlyRate;
  if (rate <= max) return 1;
  if (rate <= max * 1.1) return 0.6;
  if (rate <= max * 1.2) return 0.3;
  return 0;
}

function distanceScore(vehicle, wishes) {
  const radius = wishes.location?.radiusKm ?? 100;
  const d = vehicle.distanceKm ?? 999;
  if (d <= radius * 0.5) return 1;
  if (d <= radius) return 0.85;
  if (d <= radius * 2) return 0.5;
  return 0.2;
}

function deliveryScore(vehicle) {
  const t = vehicle.deliveryTime ?? '';
  if (/sofort|2.?4|3.?5/i.test(t)) return 1;
  if (/4.?6|6.?8/i.test(t)) return 0.75;
  if (/8.?12|6.?10/i.test(t)) return 0.5;
  return 0.4;
}

function availabilityScore(vehicle) {
  if (vehicle.availability === 'sofort') return 1;
  if (vehicle.availability === 'vorlauf') return 0.7;
  return 0.4;
}

function vehicleTypeMatch(vehicle, wishes) {
  if (!wishes.vehicleType) return true;
  if (wishes.vehicleType === 'SUV') return vehicle.bodyType === 'suv';
  return true;
}

function powertrainMatch(vehicle, wishes) {
  if (wishes.features.includes('elektro') && vehicle.powertrain !== 'elektro') return false;
  if (wishes.features.includes('benzin') && !['verbrenner', 'hybrid'].includes(vehicle.powertrain)) return false;
  return true;
}

function buildReasons(match, vehicle, wishes) {
  const reasons = [];
  if (match.wishesMatched >= match.wishesTotal && match.wishesTotal > 0) {
    reasons.push('Erfüllt alle gewünschten Ausstattungen');
  } else if (match.matchedFeatures.length) {
    reasons.push(`Erfüllt ${match.matchedFeatures.length} Wünsche serienmäßig`);
  }
  if (wishes.location && vehicle.distanceKm <= (wishes.location.radiusKm ?? 25)) {
    reasons.push(`Passendes Angebot im Umkreis von ${wishes.location.radiusKm ?? 25} km`);
  }
  if (wishes.budget.maxMonthlyRate && vehicle.monthlyRate <= wishes.budget.maxMonthlyRate) {
    reasons.push('Innerhalb des gewünschten Budgets');
  }
  return reasons.slice(0, 3);
}

export function scoreVehicleAgainstWish(vehicle, wishes, displayRate) {
  const modelKey = normalizeModelKey(vehicle.brand, vehicle.model);
  const listedTrim = inferTrimFromTitle(vehicle.title);
  const equipmentExtras = featuresFromEquipment(vehicle.equipment);

  const wishFeatureIds = wishes.features.filter(
    (f) => !['family_suv', 'elektro', 'benzin'].includes(f),
  );

  if (wishes.vehicleType === 'SUV' && !wishFeatureIds.includes('family_suv')) {
    wishFeatureIds.push('family_suv');
  }

  const trimMatch = findBestTrim(modelKey, wishFeatureIds, equipmentExtras);
  const listedTrimConfig = listedTrim ? getTrimConfig(modelKey, listedTrim) : null;

  let match = trimMatch;
  if (listedTrimConfig) {
    const listedResult = scoreTrimAgainstFeatures(
      { ...listedTrimConfig, standardFeatures: [...listedTrimConfig.standardFeatures, ...equipmentExtras] },
      wishFeatureIds,
    );
    if (listedResult.wishesMatched >= (match?.wishesMatched ?? 0)) {
      match = { trim: listedTrimConfig, ...listedResult };
    }
  }

  if (!match) {
    match = {
      trim: { id: 'base', name: vehicle.title, standardFeatures: equipmentExtras },
      matchedFeatures: equipmentExtras.filter((f) => wishFeatureIds.includes(f)),
      missingFeatures: wishFeatureIds.filter((f) => !equipmentExtras.includes(f)),
      availableWithPackage: [],
      wishesTotal: wishFeatureIds.length,
      wishesMatched: equipmentExtras.filter((f) => wishFeatureIds.includes(f)).length,
    };
  }

  const fScore = match.wishesTotal
    ? match.wishesMatched / match.wishesTotal
    : (vehicleTypeMatch(vehicle, wishes) ? 0.7 : 0.3);

  const bScore = budgetScore(vehicle, wishes, displayRate);
  const dScore = distanceScore(vehicle, wishes);
  const delScore = deliveryScore(vehicle);
  const aScore = availabilityScore(vehicle);

  let score = Math.round(
    fScore * WEIGHTS.features * 100
    + bScore * WEIGHTS.budget * 100
    + dScore * WEIGHTS.distance * 100
    + delScore * WEIGHTS.delivery * 100
    + aScore * WEIGHTS.availability * 100,
  );

  if (!vehicleTypeMatch(vehicle, wishes)) score = Math.round(score * 0.5);
  if (!powertrainMatch(vehicle, wishes)) score = Math.round(score * 0.4);

  const modelMeta = TRIM_FEATURE_MAP[modelKey];

  return {
    vehicleId: vehicle.id,
    slug: vehicle.slug,
    model: modelMeta?.modelLabel ?? `${vehicle.brand} ${vehicle.model}`,
    bestTrim: match.trim.name,
    bestTrimId: match.trim.id,
    score: Math.min(100, Math.max(0, score)),
    wishesTotal: match.wishesTotal,
    wishesMatched: Math.min(match.wishesTotal, Math.round(match.wishesMatched)),
    matchedFeatures: match.matchedFeatures,
    missingFeatures: match.missingFeatures,
    availableWithPackage: match.availableWithPackage,
    bestOffer: {
      dealer: vehicle.dealerName,
      monthlyRate: displayRate ?? vehicle.monthlyRate,
      distanceKm: vehicle.distanceKm,
      deliveryTime: vehicle.deliveryTime,
      availability: vehicle.availability,
    },
    reasons: buildReasons(match, vehicle, wishes),
    vehicle,
  };
}

export function matchVehiclesToWish({ wishes, vehicles, getDisplayRate }) {
  return vehicles
    .map((vehicle) => {
      const displayRate = getDisplayRate?.(vehicle) ?? vehicle.displayRate ?? vehicle.monthlyRate;
      return scoreVehicleAgainstWish(vehicle, wishes, displayRate);
    })
    .sort((a, b) => b.score - a.score);
}

export function matchTrimsToWish(modelKey, wishes) {
  const trims = getModelTrims(modelKey);
  const wishFeatureIds = wishes.features.filter(
    (f) => !['family_suv', 'elektro', 'benzin'].includes(f),
  );

  return trims.map((trim) => {
    const result = scoreTrimAgainstFeatures(trim, wishFeatureIds);
    const baseRate = TRIM_FEATURE_MAP[modelKey]?.baseRate?.[trim.id] ?? null;
    return {
      trimId: trim.id,
      trimName: trim.name,
      ...result,
      baseRate,
      isBest: false,
    };
  }).sort((a, b) => b.wishesMatched - a.wishesMatched);
}

export function getSavingsHint(modelKey, trimResults, removedFeatureId) {
  if (!removedFeatureId || trimResults.length < 2) return null;
  const best = trimResults[0];
  const cheaper = trimResults.find((t) => t.wishesMatched >= best.wishesMatched - 1 && t.baseRate && best.baseRate && t.baseRate < best.baseRate);
  if (!cheaper) return null;
  const saving = best.baseRate - cheaper.baseRate;
  if (saving <= 0) return null;
  return `Ohne ${getFeatureLabel(removedFeatureId)} reicht bereits ${cheaper.trimName} und spart ca. ${saving} €/Monat.`;
}
