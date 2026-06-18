/**
 * Dynamische Ausstattungs-Chips aus globalem Katalog + Modell-Verfügbarkeit (Layer 1 + 2).
 */
import {
  getChipEligibleGlobalFeatures,
  getGlobalFeatureById,
  resolveLegacyFeatureId,
} from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { resolveModelFeatureAvailability } from './modelEquipmentData.js';

/** UI-Gruppen → Katalog-Kategorien */
const CHIP_UI_GROUPS = [
  {
    id: 'sitze_komfort',
    label: 'Sitze & Komfort',
    categories: ['Sitze & Komfort', 'Klima & Komfort'],
  },
  {
    id: 'parken_alltag',
    label: 'Parken & Alltag',
    categories: ['Parken & Kamera', 'Komfort & Zugang'],
  },
  {
    id: 'navigation_digital',
    label: 'Navigation & Digitales',
    categories: ['Digital & Infotainment'],
  },
  {
    id: 'sicherheit',
    label: 'Sicherheit & Assistenz',
    categories: ['Assistenz & Sicherheit'],
  },
  {
    id: 'licht_design',
    label: 'Licht & Design',
    categories: ['Licht & Design', 'Karosserie & Design'],
  },
  {
    id: 'elektro',
    label: 'Elektro & Laden',
    categories: ['Elektro & Laden'],
  },
  {
    id: 'alltag_nutzen',
    label: 'Alltag & Nutzen',
    categories: ['Antrieb & Nutzen'],
  },
];

const RELEVANT_STATUSES = new Set([
  S.STANDARD,
  S.AVAILABLE,
  S.OPTIONAL,
  S.PACKAGE_REQUIRED,
]);

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ResolvedModelFeatureAvailability} availability
 */
export function buildAvailabilitySummary(availability) {
  if (!availability) return null;

  const trimNames = [...new Set(availability.availableTrims?.map((t) => t.trimName) ?? [])];
  const pkgName = availability.availablePackages?.[0]?.name;

  if (availability.modelStatus === S.PACKAGE_REQUIRED) {
    return pkgName ? `über ${pkgName} erhältlich` : 'über ein Paket erhältlich';
  }
  if (availability.modelStatus === S.STANDARD && trimNames.length === 1) {
    return `Serie ab ${trimNames[0]}`;
  }
  if (availability.modelStatus === S.OPTIONAL || availability.modelStatus === S.AVAILABLE) {
    return 'optional verfügbar';
  }
  if (trimNames.length > 1) {
    return `verfügbar in ${trimNames.length} Ausstattungslinien`;
  }
  if (trimNames.length === 1) {
    return `verfügbar ab ${trimNames[0]}`;
  }
  return 'verfügbar';
}

/**
 * @param {import('../../data/features/globalFeatureCatalog.js').GlobalFeature} feature
 * @param {import('../../data/features/modelEquipmentSchema.js').ResolvedModelFeatureAvailability | null} availability
 */
function buildEquipmentChip(feature, availability) {
  const legacyFeatureId = resolveLegacyFeatureId(feature);
  const status = availability?.modelStatus ?? S.UNKNOWN;

  return {
    id: feature.id,
    featureId: feature.id,
    globalFeatureId: feature.id,
    legacyFeatureId,
    featureIds: legacyFeatureId ? [legacyFeatureId] : [feature.id],
    label: feature.label,
    category: feature.category,
    tags: feature.tags ?? [],
    advisorRelevant: feature.advisorRelevant !== false,
    searchable: feature.searchable !== false,
    showAsChip: feature.showAsChip === true,
    confidence: availability?.confidence ?? feature.confidence,
    status,
    availabilitySummary: buildAvailabilitySummary(availability),
    availableTrims: availability?.availableTrims ?? [],
    availablePackages: availability?.availablePackages ?? [],
    sourceRefs: availability?.sourceRefs ?? [],
  };
}

export function isModelRelevantChipStatus(modelStatus) {
  return RELEVANT_STATUSES.has(modelStatus);
}

/**
 * @returns {ReturnType<typeof buildEquipmentChip>[]}
 */
export function getRecommendedEquipmentChips(brand, model, modelKey) {
  const candidates = getChipEligibleGlobalFeatures().filter((f) => f.showAsChip && f.searchable);
  const chips = [];

  for (const feature of candidates) {
    const availability = resolveModelFeatureAvailability(brand, model, modelKey, feature.id);
    if (!availability || !isModelRelevantChipStatus(availability.modelStatus)) continue;
    chips.push(buildEquipmentChip(feature, availability));
  }

  return chips;
}

/**
 * Chips gruppiert für die Kundenseite.
 * @returns {{ id: string, label: string, chips: object[] }[]}
 */
export function buildEquipmentChipsForModel(brand, model, modelKey) {
  const chips = getRecommendedEquipmentChips(brand, model, modelKey);
  const byCategory = new Map(chips.map((chip) => [chip.featureId, chip]));

  return CHIP_UI_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    chips: group.categories
      .flatMap((category) => chips.filter((chip) => chip.category === category))
      .filter((chip, index, list) => list.findIndex((c) => c.featureId === chip.featureId) === index),
  })).filter((group) => group.chips.length > 0);
}

/**
 * Scoring-IDs für Trim-Mapping (legacy featureCatalog-IDs).
 */
export function resolveChipToScoringFeatureIds(chipId) {
  const chip = getGlobalFeatureById(chipId);
  if (chip) {
    const legacy = resolveLegacyFeatureId(chip);
    return legacy ? [legacy] : [chip.id];
  }
  return [chipId];
}

export function getDynamicEquipmentWishChip(chipId) {
  const feature = getGlobalFeatureById(chipId);
  if (!feature) return null;
  const legacyFeatureId = resolveLegacyFeatureId(feature);
  return {
    id: feature.id,
    label: feature.label,
    featureIds: legacyFeatureId ? [legacyFeatureId] : [feature.id],
    globalFeatureId: feature.id,
    legacyFeatureId,
    advisorRelevant: feature.advisorRelevant !== false,
  };
}
