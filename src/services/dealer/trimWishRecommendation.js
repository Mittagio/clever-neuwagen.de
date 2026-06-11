/**
 * Clever empfiehlt Ausstattung – Fahrzeug zuerst, Trim-Name erst danach.
 */
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  getModelTrims,
  normalizeModelKey,
  TRIM_FEATURE_MAP,
} from '../../data/features/trimFeatureMapping.js';

const TRIM_TAGLINES = {
  air: 'günstiger',
  vision: 'günstiger',
  earth: 'beste Preis-Leistung',
  spirit: 'beste Preis-Leistung',
  'gt-line': 'mehr Komfort und Design',
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
  if (trimId === 'air' || trimId === 'vision') return 1;
  return 0;
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
  if (best.trim.id === 'gt-line' && valuePick.score >= best.score - 10) {
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

function scoreTrim(trim, wishIds) {
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

  const fulfilled = reasons.filter((r) => r.status === 'standard').length;
  const scorable = wishIds.length || 1;
  const percent = wishIds.length
    ? Math.round((fulfilled / scorable) * 100)
    : null;

  return {
    trim,
    score,
    reasons,
    packagesNeeded: [...packagesNeeded],
    cleverQuotePercent: percent,
  };
}

function formatPick(entry, wishIds) {
  const tagline = TRIM_TAGLINES[entry.trim.id] ?? null;
  const includedLines = buildTrimIncludedLines(entry.trim, wishIds);
  const highlightLines = entry.reasons.slice(0, 3).map((r) => r.line);

  return {
    trimId: entry.trim.id,
    trimLabel: entry.trim.name,
    cleverQuotePercent: entry.cleverQuotePercent,
    reasons: highlightLines.length ? highlightLines : includedLines.slice(0, 3),
    includedLines,
    packagesNeeded: entry.packagesNeeded,
    tagline,
    valueNote: entry.trim.id === 'earth' || entry.trim.id === 'spirit'
      ? 'Beste Preis-Leistung'
      : tagline,
    recommended: false,
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
    .map((trim) => scoreTrim(trim, wishIds))
    .sort((a, b) => b.score - a.score || trimTierBonus(b.trim.id) - trimTierBonus(a.trim.id));

  const biased = applyValueBias(scored);
  const allTrims = biased.map((entry) => formatPick(entry, wishIds));
  const [best, ...rest] = allTrims;

  if (best) best.recommended = true;

  const vehicleFitReasons = buildVehicleFitReasons(searchProfile, searchFilters, wishFeatureIds, trims);

  return {
    modelKey,
    mappingKey,
    vehicleTitle: `Kia ${vehicleLabel}`,
    vehicleShortLabel: vehicleLabel,
    modelLabel: `Kia ${vehicleLabel}`,
    vehicleFitReasons,
    primary: best ?? null,
    alternatives: rest.slice(0, 2),
    allTrims,
    wishFeatureIds: wishIds,
    selectedTrimId: best?.trimId ?? null,
  };
}
