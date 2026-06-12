/**
 * Clever empfiehlt Ausstattung – Fahrzeug zuerst, Trim-Name erst danach.
 */
import { findDealerWishChip } from '../../data/dealer/dealerWishCatalog.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  getModelTrims,
  normalizeModelKey,
  TRIM_FEATURE_MAP,
} from '../../data/features/trimFeatureMapping.js';

const TRIM_TAGLINES = {
  air: 'günstiger',
  r: 'günstigste Variante',
  vision: 'günstiger',
  earth: 'beste Preis-Leistung',
  spirit: 'beste Preis-Leistung',
  'gt-line': 'mehr Komfort und Design',
  elite: 'beste Ausstattung',
  platinum: 'mehr Komfort & Technik',
};

const TRIM_COMFORT_LINE = {
  air: 'Solide Basisausstattung',
  vision: 'Solide Basisausstattung',
  earth: 'Erweiterte Komfortausstattung',
  spirit: 'Erweiterte Komfortausstattung',
  'gt-line': 'Vollausstattung mit Design-Paket',
  platinum: 'Premium-Ausstattung',
};

function resolveMappingKey(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  if (TRIM_FEATURE_MAP[key]) return key;
  return normalizeModelKey('Kia', modelKey);
}

function trimTierBonus(trimId) {
  if (trimId === 'earth' || trimId === 'spirit') return 2;
  if (trimId === 'air' || trimId === 'vision' || trimId === 'r') return 1;
  return 0;
}

function scoreWishChips(trim, chipIds = []) {
  let total = 0;
  let earned = 0;
  let fulfilled = 0;

  for (const chipId of chipIds) {
    const chip = findDealerWishChip(chipId);
    if (!chip?.features?.length) continue;
    total += 1;
    const statuses = chip.features.map((featureId) => wishStatus(trim, featureId));
    if (statuses.every((status) => status === 'standard')) {
      earned += 1;
      fulfilled += 1;
    } else if (statuses.some((status) => status === 'standard' || status === 'package')) {
      earned += 0.5;
    }
  }

  return {
    percent: total ? Math.round((earned / total) * 100) : null,
    fulfilled,
    total,
  };
}

function buildTrimWishChipLines(trim, chipIds = []) {
  const fulfilled = [];
  const missing = [];

  for (const chipId of chipIds) {
    const chip = findDealerWishChip(chipId);
    if (!chip) continue;
    const allStandard = chip.features.every((featureId) => wishStatus(trim, featureId) === 'standard');
    if (allStandard) {
      fulfilled.push(chip.label);
    } else {
      missing.push(chip.label);
    }
  }

  return { fulfilled, missing };
}

function resolveTrimRole(trimId, orderedTrimIds, recommendedTrimId) {
  const index = orderedTrimIds.indexOf(trimId);
  if (trimId === recommendedTrimId) {
    return { medal: '🏆', role: 'empfohlen' };
  }
  if (index === 0) {
    return { medal: '🥈', role: TRIM_TAGLINES[trimId] ?? 'günstigste Variante' };
  }
  if (index === orderedTrimIds.length - 1) {
    return { medal: '🥇', role: TRIM_TAGLINES[trimId] ?? 'beste Ausstattung' };
  }
  return { medal: '', role: TRIM_TAGLINES[trimId] ?? '' };
}

function wishStatus(trim, featureId) {
  if (trim.standardFeatures?.includes(featureId)) return 'standard';
  if (trim.availableViaPackage?.includes(featureId)) return 'package';
  if (trim.notAvailable?.includes(featureId)) return 'unavailable';
  return 'unknown';
}

function applyValueBias(scored) {
  if (scored.length < 2) return scored;
  const best = scored[0];
  const valuePick = scored.find((entry) => (
    entry.trim.id === 'earth' || entry.trim.id === 'spirit'
  ));
  if (!valuePick || valuePick.trim.id === best.trim.id) return scored;
  const scoreGap = best.score - valuePick.score;
  const preferValueTrim = scoreGap <= 15
    || (best.trim.id === 'gt-line' && valuePick.score >= best.score - 10)
    || (best.trim.id === 'elite' && valuePick.score >= best.score - 12);
  if (preferValueTrim) {
    return [valuePick, ...scored.filter((entry) => entry.trim.id !== valuePick.trim.id)];
  }
  return scored;
}

function buildReasonLine(featureId, status) {
  const label = getFeatureLabel(featureId) ?? featureId;
  if (status === 'standard') return `${label} enthalten`;
  if (status === 'package') return `${label} möglich`;
  return null;
}

function buildSearchCriteriaLabels(searchProfile, searchFilters) {
  const labels = [];
  if (searchProfile?.fuel === 'electric' || searchFilters?.fuel === 'elektro') {
    labels.push('Elektro');
  }
  if (searchProfile?.maxMonthlyRate) {
    labels.push(`unter ${searchProfile.maxMonthlyRate} €`);
  }
  if (searchProfile?.requiredFeatures?.includes('range_400')
    || searchProfile?.softPreferences?.includes('range_400')) {
    labels.push('über 400 km Reichweite');
  }
  return labels;
}

function buildVehicleFitReasons(searchProfile, searchFilters, wishFeatureIds, trims) {
  const lines = buildSearchCriteriaLabels(searchProfile, searchFilters);

  for (const wishId of wishFeatureIds) {
    const canFulfill = trims.some((trim) => {
      const status = wishStatus(trim, wishId);
      return status === 'standard' || status === 'package';
    });
    if (!canFulfill) continue;
    const label = getFeatureLabel(wishId);
    if (!label) continue;
    const anyStandard = trims.some((t) => t.standardFeatures?.includes(wishId));
    lines.push(anyStandard ? `${label} enthalten` : `${label} möglich`);
  }

  if (!lines.some((l) => /preis-leistung/i.test(l))) {
    lines.push('Beste Preis-Leistung');
  }

  return [...new Set(lines)].slice(0, 5);
}

function buildTrimIncludedLines(trim, wishIds) {
  const lines = [];
  const seen = new Set();

  for (const wishId of wishIds) {
    const status = wishStatus(trim, wishId);
    const line = buildReasonLine(wishId, status);
    if (line && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  const comfort = TRIM_COMFORT_LINE[trim.id];
  if (comfort && !seen.has(comfort)) {
    lines.push(comfort);
  }

  return lines.slice(0, 4);
}

function scoreTrim(trim, wishIds, wishChipIds = []) {
  let score = trimTierBonus(trim.id);
  const reasons = [];
  const packagesNeeded = new Set();

  for (const wishId of wishIds) {
    const status = wishStatus(trim, wishId);
    if (status === 'standard') {
      score += 12;
      const line = buildReasonLine(wishId, status);
      if (line) reasons.push({ featureId: wishId, line, status });
    } else if (status === 'package') {
      score += 7;
      const line = buildReasonLine(wishId, status);
      if (line) reasons.push({ featureId: wishId, line, status });
      packagesNeeded.add(wishId);
    } else if (status === 'unknown') {
      score += 1;
    }
  }

  const chipScore = wishChipIds.length
    ? scoreWishChips(trim, wishChipIds)
    : null;
  const fulfilled = reasons.filter((r) => r.status === 'standard').length;
  const scorable = wishIds.length || 1;
  const percent = chipScore?.percent ?? (wishIds.length
    ? Math.round((fulfilled / scorable) * 100)
    : null);

  return {
    trim,
    score,
    reasons,
    packagesNeeded: [...packagesNeeded],
    cleverQuotePercent: percent,
    fulfilledWishCount: chipScore?.fulfilled ?? fulfilled,
    totalWishCount: chipScore?.total ?? wishIds.length,
    wishChipLines: wishChipIds.length ? buildTrimWishChipLines(trim, wishChipIds) : null,
  };
}

function formatPick(entry, wishIds, wishChipIds, orderedTrimIds, recommendedTrimId) {
  const tagline = TRIM_TAGLINES[entry.trim.id] ?? null;
  const includedLines = buildTrimIncludedLines(entry.trim, wishIds);
  const highlightLines = entry.reasons.slice(0, 3).map((r) => r.line);
  const role = resolveTrimRole(entry.trim.id, orderedTrimIds, recommendedTrimId);

  return {
    trimId: entry.trim.id,
    trimLabel: entry.trim.name,
    cleverQuotePercent: entry.cleverQuotePercent,
    fulfilledWishCount: entry.fulfilledWishCount,
    totalWishCount: entry.totalWishCount,
    wishChipLines: entry.wishChipLines,
    reasons: highlightLines.length ? highlightLines : includedLines.slice(0, 3),
    includedLines,
    packagesNeeded: entry.packagesNeeded,
    tagline,
    roleLabel: role.role,
    medal: role.medal,
    valueNote: entry.trim.id === 'earth' || entry.trim.id === 'spirit'
      ? 'Beste Preis-Leistung'
      : tagline,
    recommended: false,
  };
}

function buildRecommendationWhyLines(primary, wishChipIds = []) {
  const lines = [];
  if (primary?.wishChipLines?.fulfilled?.length) {
    for (const label of primary.wishChipLines.fulfilled.slice(0, 3)) {
      lines.push(`${label} enthalten`);
    }
  } else if (primary?.reasons?.length) {
    lines.push(...primary.reasons.slice(0, 3));
  }
  if (primary?.valueNote && !lines.some((line) => /preis-leistung/i.test(line))) {
    lines.push(primary.valueNote);
  }
  if (primary?.fulfilledWishCount != null && primary?.totalWishCount > 0) {
    lines.push(`erfüllt ${primary.fulfilledWishCount} von ${primary.totalWishCount} Wünschen`);
  }
  return [...new Set(lines)].slice(0, 4);
}

/**
 * @param {object} recommendation
 * @param {string} selectedTrimId
 * @param {string[]} wishChipIds
 */
export function buildUpgradePitch(recommendation, selectedTrimId, wishChipIds = []) {
  const allTrims = recommendation?.allTrims ?? [];
  if (allTrims.length < 2) return null;

  const selectedIndex = allTrims.findIndex((trim) => trim.trimId === selectedTrimId);
  const selected = allTrims[selectedIndex >= 0 ? selectedIndex : 0];
  const next = allTrims[selectedIndex + 1];
  if (!selected || !next) return null;

  const mappingKey = recommendation.mappingKey;
  const rawTrims = getModelTrims(mappingKey);
  const fromTrim = rawTrims.find((trim) => trim.id === selected.trimId);
  const toTrim = rawTrims.find((trim) => trim.id === next.trimId);
  if (!fromTrim || !toTrim) return null;

  const extras = [];
  for (const chipId of wishChipIds) {
    const chip = findDealerWishChip(chipId);
    if (!chip) continue;
    const inNext = chip.features.every((featureId) => wishStatus(toTrim, featureId) === 'standard');
    const inSelected = chip.features.every((featureId) => wishStatus(fromTrim, featureId) === 'standard');
    if (inNext && !inSelected) extras.push(chip.label);
  }
  for (const featureId of toTrim.standardFeatures ?? []) {
    if (fromTrim.standardFeatures?.includes(featureId)) continue;
    const label = getFeatureLabel(featureId);
    if (label && !extras.includes(label)) extras.push(label);
  }
  if (!extras.length) return null;

  const modelData = TRIM_FEATURE_MAP[mappingKey];
  const fromRate = modelData?.baseRate?.[selected.trimId] ?? null;
  const toRate = modelData?.baseRate?.[next.trimId] ?? null;
  const monthlyDelta = fromRate != null && toRate != null ? Math.max(0, toRate - fromRate) : null;

  return {
    fromTrimId: selected.trimId,
    fromTrimLabel: selected.trimLabel,
    toTrimId: next.trimId,
    toTrimLabel: next.trimLabel,
    extras: extras.slice(0, 5),
    monthlyDelta,
  };
}

/**
 * @param {object} recommendation
 * @param {string|null} trimId
 */
export function resolveTrimPick(recommendation, trimId = null) {
  if (!recommendation) return null;
  const id = trimId ?? recommendation.selectedTrimId ?? recommendation.primary?.trimId;
  if (!id || id === recommendation.primary?.trimId) return recommendation.primary;
  return recommendation.allTrims?.find((t) => t.trimId === id)
    ?? recommendation.alternatives?.find((t) => t.trimId === id)
    ?? recommendation.primary;
}

/**
 * @param {string} modelKey
 * @param {string[]} wishFeatureIds
 * @param {object|null} searchProfile
 * @param {object|null} [searchFilters]
 */
export function recommendTrimForWishes(
  modelKey,
  wishFeatureIds = [],
  searchProfile = null,
  searchFilters = null,
  wishChipIds = [],
) {
  const mappingKey = resolveMappingKey(modelKey);
  const modelData = TRIM_FEATURE_MAP[mappingKey];
  const trims = getModelTrims(mappingKey);
  const attrs = KIA_MODEL_ATTRIBUTES[mappingKey] ?? KIA_MODEL_ATTRIBUTES[modelKey];
  const vehicleLabel = attrs?.label ?? modelData?.modelLabel?.replace(/^Kia\s+/i, '') ?? modelKey;

  if (!trims.length) {
    return {
      modelKey,
      mappingKey,
      vehicleTitle: `Kia ${vehicleLabel}`,
      vehicleShortLabel: vehicleLabel,
      modelLabel: modelData?.modelLabel ?? `Kia ${vehicleLabel}`,
      vehicleFitReasons: [],
      primary: null,
      alternatives: [],
      allTrims: [],
      wishFeatureIds,
    };
  }

  const profileWishes = searchProfile?.requiredFeatures ?? [];
  const wishIds = [...new Set([
    ...wishFeatureIds,
    ...profileWishes.filter((id) => !['elektro', 'benzin', 'family_suv'].includes(id)),
  ])];

  const scored = trims
    .map((trim) => scoreTrim(trim, wishIds, wishChipIds))
    .sort((a, b) => b.score - a.score || trimTierBonus(b.trim.id) - trimTierBonus(a.trim.id));

  const biased = applyValueBias(scored);
  const orderedTrimIds = trims.map((trim) => trim.id);
  const recommendedTrimId = biased[0]?.trim.id ?? null;
  const allTrims = trims
    .map((trim) => {
      const entry = biased.find((item) => item.trim.id === trim.id);
      return formatPick(entry, wishIds, wishChipIds, orderedTrimIds, recommendedTrimId);
    });
  const best = allTrims.find((trim) => trim.trimId === recommendedTrimId) ?? allTrims[0] ?? null;
  const rest = allTrims.filter((trim) => trim.trimId !== best?.trimId);

  if (best) best.recommended = true;

  const vehicleFitReasons = buildVehicleFitReasons(searchProfile, searchFilters, wishFeatureIds, trims);
  const recommendationWhy = best ? buildRecommendationWhyLines(best, wishChipIds) : [];

  return {
    modelKey,
    mappingKey,
    vehicleTitle: `Kia ${vehicleLabel}`,
    vehicleShortLabel: vehicleLabel,
    modelLabel: `Kia ${vehicleLabel}`,
    vehicleFitReasons,
    recommendationWhy,
    primary: best ?? null,
    alternatives: rest.slice(0, 2),
    allTrims,
    wishFeatureIds: wishIds,
    wishChipIds,
    selectedTrimId: best?.trimId ?? null,
  };
}
