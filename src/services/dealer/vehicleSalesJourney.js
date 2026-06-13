/**
 * Verkäufer-Journey – Fahrzeug zuerst, Ausstattung später.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_TECHNICAL_SPECS } from '../../data/kia/kiaTechnicalSpecs.js';
import { normalizeModelKey } from '../../data/features/trimFeatureMapping.js';
import { buildWishMatchBullets } from '../cleverQuote/cleverQuoteRecommendation.js';
import { getPackagesForTrim } from '../../data/dealer/dealerTrimPackages.js';
import { createDefaultConfiguration } from './modelConfiguratorCatalog.js';
import { recommendTrimForWishes, resolveTrimPick } from './trimWishRecommendation.js';

/** @type {Record<string, string>} */
export const VEHICLE_TAGLINES = {
  ev4: 'Vollelektrische Limousine für viel Reichweite und moderne Technik.',
  'ev4-fastback': 'Elektrisches Fastback mit sportlicher Silhouette und Alltagstauglichkeit.',
  ev3: 'Kompakter Elektro-SUV – wendig in der Stadt, souverän auf langen Strecken.',
  ev5: 'Großer Elektro-SUV mit viel Platz für Familie und Gepäck.',
  ev9: 'Flaggschiff-Elektro-SUV mit bis zu sieben Sitzen.',
  sportage: 'Der Bestseller-SUV – vielseitig, sicher und alltagstauglich.',
  sorento: 'Großer SUV mit bis zu sieben Sitzen – ideal für Familie und Anhänger.',
  niro: 'Effizienter Crossover als Elektro, Hybrid oder Plug-in.',
};

function formatLength(mm) {
  if (!mm) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

function formatLiters(l) {
  if (!l) return null;
  return `${l} l`;
}

/**
 * @param {object|null} searchProfile
 * @param {object|null} searchFilters
 */
export function buildSearchCriteriaLabels(searchProfile, searchFilters) {
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
  if (searchProfile?.bodyType === 'suv') labels.push('SUV');
  if (searchProfile?.seatsMin >= 7) labels.push('7 Sitze');
  return labels;
}

/**
 * @param {object} group – modelLineGroup
 * @param {object} options
 */
export function buildVehicleFitReasons(group, { searchProfile, searchWishes, chipIds } = {}) {
  const match = group?.primaryMatch;
  if (!match) return [];

  const bullets = buildWishMatchBullets(match, {
    wishes: searchWishes,
    chipIds,
    maxReasons: 6,
  });

  const withoutPrice = bullets.filter((line) => !/€|budget|preis|monat|leasing/i.test(line));

  const cqItems = group.modelQuote?.items ?? match.cleverQuote?.items ?? [];
  const fromQuote = cqItems
    .filter((i) => i.status === 'fulfilled' && i.label)
    .map((i) => i.label)
    .slice(0, 4);

  const merged = [...new Set([...fromQuote, ...withoutPrice])];
  return merged.slice(0, 5);
}

/**
 * @param {string} modelKey
 */
export function buildVehicleBrief(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  const attrs = KIA_MODEL_ATTRIBUTES[key] ?? KIA_MODEL_ATTRIBUTES[normalizeModelKey('Kia', key)];
  const specs = KIA_TECHNICAL_SPECS[key] ?? KIA_TECHNICAL_SPECS[normalizeModelKey('Kia', key)];
  const label = attrs?.label ?? key;

  const specRows = [
    specs?.lengthMm && { icon: '📏', label: 'Länge', value: formatLength(specs.lengthMm) },
    specs?.electricRangeKm && { icon: '🔋', label: 'Reichweite', value: `bis ${specs.electricRangeKm} km` },
    attrs?.fuel === 'electric' && { icon: '⚡', label: 'Laden', value: 'DC-Schnellladen' },
    specs?.trunkL && { icon: '📦', label: 'Kofferraum', value: formatLiters(specs.trunkL) },
    attrs?.seats && { icon: '👨‍👩‍👧‍👦', label: 'Sitze', value: `${attrs.seats}` },
  ].filter(Boolean);

  return {
    modelKey: key,
    title: `Kia ${label}`,
    tagline: VEHICLE_TAGLINES[key] ?? `Der Kia ${label} – passend zu Ihrer Suche.`,
    specRows,
    bodyType: attrs?.bodyType ?? 'suv',
  };
}

function formatTowCapacity(kg) {
  if (!kg) return null;
  const tons = kg / 1000;
  const label = Number.isInteger(tons) ? String(tons) : tons.toFixed(1).replace('.', ',');
  return `${label} t`;
}

/**
 * Kontext-Satz für Verstehen-Schritt – modell + Suchsignale, ohne Preis.
 * @param {string} modelKey
 * @param {object} [options]
 */
export function buildVehicleContextLine(modelKey, options = {}) {
  const { searchProfile = null, searchFilters = null, searchChipIds = [] } = options;
  const key = String(modelKey ?? '').toLowerCase();
  const mappingKey = normalizeModelKey('Kia', key);
  const attrs = KIA_MODEL_ATTRIBUTES[key] ?? KIA_MODEL_ATTRIBUTES[mappingKey];
  const specs = KIA_TECHNICAL_SPECS[key] ?? KIA_TECHNICAL_SPECS[mappingKey];
  if (!attrs) return null;

  const chipIds = searchChipIds ?? [];
  const hasTow = searchProfile?.requiredFeatures?.includes('towbar')
    || searchProfile?.requiredFeatures?.includes('tow_capacity_2000')
    || (searchFilters?.towCapacityKg ?? 0) >= 1500
    || chipIds.some((id) => ['towbar', 'tow_2000', 'tow_braked'].includes(id));
  const has7Seats = (searchProfile?.seatsMin ?? 0) >= 7
    || (searchFilters?.seatsMin ?? 0) >= 7
    || chipIds.includes('seats_7');
  const hasRange = searchProfile?.requiredFeatures?.includes('range_400')
    || searchProfile?.softPreferences?.includes('range_400')
    || (searchFilters?.rangeKmMin ?? 0) >= 400
    || chipIds.includes('range_400');
  const hasLargeTrunk = searchProfile?.requiredFeatures?.includes('large_trunk')
    || Boolean(searchFilters?.trunkLMin)
    || chipIds.includes('large_trunk');

  if (hasTow && attrs.towCapacityKg >= 2000) {
    return `Zieht bis ${formatTowCapacity(attrs.towCapacityKg)} – ideal für Anhänger und Wohnwagen.`;
  }
  if (has7Seats && attrs.isSevenSeater) {
    return `Bis zu ${attrs.seats} Sitze – viel Platz für Familie und Gepäck.`;
  }
  if (hasRange && specs?.electricRangeKm) {
    return `Bis zu ${specs.electricRangeKm} km Reichweite – gut für lange Strecken.`;
  }
  if (hasLargeTrunk && specs?.trunkL) {
    return `Großzügiger Kofferraum (${specs.trunkL} l) – perfekt für den Familienalltag.`;
  }
  if (attrs.fuel === 'electric' && specs?.electricRangeKm) {
    return `Elektro mit bis zu ${specs.electricRangeKm} km Reichweite – emissionsfrei unterwegs.`;
  }
  if (attrs.isSevenSeater) {
    return `Bis zu ${attrs.seats} Sitze – flexibel für Familie und Freunde.`;
  }
  return null;
}

/**
 * @param {string} modelKey
 * @param {object} trimPick
 * @param {string[]} wishFeatureIds
 * @param {string[]} [wishChipIds]
 */
export function buildConfigSummaryFromTrim(
  modelKey,
  trimPick,
  wishFeatureIds = [],
  wishChipIds = [],
  selectedTrimId = null,
  packageIds = [],
) {
  const key = String(modelKey ?? '').toLowerCase();
  const attrs = KIA_MODEL_ATTRIBUTES[key];
  const pick = trimPick?.selectedPick
    ?? resolveTrimPick(trimPick, selectedTrimId ?? trimPick?.selectedTrimId);
  const packages = getPackagesForTrim(key, pick?.trimId ?? '').filter(
    (pkg) => packageIds.includes(pkg.id),
  );

  return {
    modelKey: key,
    modelLabel: attrs?.label ?? key,
    trimLabel: pick?.trimLabel ?? null,
    trimId: pick?.trimId ?? null,
    colorLabel: null,
    powertrainLabel: attrs?.fuel === 'electric' ? 'Elektro' : null,
    packageLabels: packages.map((pkg) => pkg.label),
    packageIds,
    wishFeatureIds,
    wishChipIds,
    cleverQuotePercent: pick?.cleverQuotePercent ?? null,
    imageSlug: key,
  };
}

/**
 * @param {string} modelKey
 * @param {object} trimPick
 */
export function buildConfigurationFromTrim(modelKey, trimPick, selectedTrimId = null, packageIds = []) {
  const pick = trimPick?.selectedPick
    ?? resolveTrimPick(trimPick, selectedTrimId ?? trimPick?.selectedTrimId);
  const trimId = pick?.trimId;
  if (!trimId) return null;

  const mergedPackageIds = [
    ...new Set([...(pick.packagesNeeded ?? []), ...packageIds]),
  ];

  const defaultConfig = createDefaultConfiguration(modelKey);
  if (defaultConfig) {
    return {
      ...defaultConfig,
      trimId,
      packageIds: mergedPackageIds,
    };
  }

  return {
    catalogId: modelKey,
    modelKey,
    trimId,
    packageIds: mergedPackageIds,
    colorId: null,
    powertrainId: null,
  };
}

export { recommendTrimForWishes };
