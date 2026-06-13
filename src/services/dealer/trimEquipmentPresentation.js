/**
 * Serienausstattung & Pakete – Phase 4/5 der Berater-Journey (kein Konfigurator-Einstieg).
 */
import { FEATURE_CATALOG, getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getModelTrims, normalizeModelKey, TRIM_FEATURE_MAP } from '../../data/features/trimFeatureMapping.js';
import { getPackagesForTrim, resolvePackageFeatureIds } from '../../data/dealer/dealerTrimPackages.js';
import { findDealerWishChip } from '../../data/dealer/dealerWishCatalog.js';
import { scoreTrim } from './trimWishRecommendation.js';

const EXTRA_SERIAL_LABELS = {
  range_400: 'Reichweite über 400 km',
  family_suv: 'Geräumiger Innenraum',
  seats_7: '7 Sitze',
  large_trunk: 'Großer Kofferraum',
  automatic: 'Automatik',
  towbar: 'Anhängerkupplung',
};

const SKIP_SERIAL = new Set(['elektro', 'reichweite', 'benzin', 'family_suv']);

function resolveMappingKey(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  if (TRIM_FEATURE_MAP[key]) return key;
  return normalizeModelKey('Kia', modelKey);
}

function featureLabel(featureId) {
  return getFeatureLabel(featureId) ?? EXTRA_SERIAL_LABELS[featureId] ?? featureId;
}

function resolveFeatureCategory(featureId) {
  const meta = FEATURE_CATALOG.find((f) => f.id === featureId);
  if (meta?.category === 'assistenz' || meta?.category === 'sicherheit') return 'Sicherheit';
  if (meta?.category === 'komfort' || meta?.category === 'audio') return 'Komfort';
  if (['heat_pump', 'range_400'].includes(featureId)) return 'Elektro';
  return 'Komfort';
}

/**
 * @param {object} trim – raw trim from TRIM_FEATURE_MAP
 * @param {string[]} [packageFeatureIds]
 */
export function buildSerialEquipmentSections(trim, packageFeatureIds = []) {
  if (!trim) return [];

  const standard = new Set([
    ...(trim.standardFeatures ?? []),
    ...packageFeatureIds.filter((id) => !trim.notAvailable?.includes(id)),
  ]);

  /** @type {Map<string, string[]>} */
  const groups = new Map();

  for (const featureId of standard) {
    if (SKIP_SERIAL.has(featureId)) continue;
    const label = featureLabel(featureId);
    const group = resolveFeatureCategory(featureId);
    if (!groups.has(group)) groups.set(group, []);
    const items = groups.get(group);
    if (!items.includes(label)) items.push(label);
  }

  const order = ['Komfort', 'Sicherheit', 'Elektro', 'Transport'];
  return order
    .filter((title) => groups.has(title))
    .map((title) => ({ title, items: groups.get(title) }));
}

function applyPackageFeatures(trim, packageFeatureIds = []) {
  if (!packageFeatureIds.length) return trim;
  return {
    ...trim,
    standardFeatures: [
      ...new Set([...(trim.standardFeatures ?? []), ...packageFeatureIds]),
    ],
    availableViaPackage: (trim.availableViaPackage ?? []).filter(
      (id) => !packageFeatureIds.includes(id),
    ),
  };
}

function buildWishChipLinesVirtual(trim, chipIds) {
  const fulfilled = [];
  const missing = [];

  for (const chipId of chipIds) {
    const chip = findDealerWishChip(chipId);
    if (!chip) continue;
    const allStandard = chip.features.every((featureId) => (
      trim.standardFeatures?.includes(featureId)
    ));
    if (allStandard) fulfilled.push(chip.label);
    else missing.push(chip.label);
  }

  return { fulfilled, missing };
}

/**
 * Live-Quote für gewählten Trim inkl. aktiver Pakete.
 */
export function scoreTrimWithPackages({
  modelKey,
  trimId,
  wishFeatureIds = [],
  wishChipIds = [],
  packageIds = [],
}) {
  const mappingKey = resolveMappingKey(modelKey);
  const trims = getModelTrims(mappingKey);
  const trim = trims.find((entry) => entry.id === trimId);
  if (!trim) return null;

  const packageFeatures = resolvePackageFeatureIds(modelKey, packageIds);
  const virtualTrim = applyPackageFeatures(trim, packageFeatures);
  const scored = scoreTrim(virtualTrim, wishFeatureIds, wishChipIds);

  return {
    cleverQuotePercent: scored.cleverQuotePercent,
    fulfilledWishCount: scored.fulfilledWishCount,
    totalWishCount: scored.totalWishCount,
    wishChipLines: wishChipIds.length ? buildWishChipLinesVirtual(virtualTrim, wishChipIds) : null,
    packagesNeeded: scored.packagesNeeded,
  };
}

export { getPackagesForTrim, resolvePackageFeatureIds };
