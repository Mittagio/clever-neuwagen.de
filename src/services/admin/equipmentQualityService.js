/**
 * Qualitäts- und Freigabestatus für importierte Ausstattungsprofile (Admin/Inspector).
 */
import { getGlobalFeatureById } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { getImportedUnknownFeatures } from '../configuration/equipmentImportRegistry.js';
import {
  findMappingForRawLabel,
  getFeatureAliasMappings,
  isUnknownFeatureIgnored,
} from './featureAliasMappingService.js';
import { getProfileQualityOverride, saveProfileQualityOverride } from './equipmentProfileQualityStore.js';

/** @typedef {'draft' | 'needs_review' | 'partially_verified' | 'verified'} EquipmentQualityStatus */

/**
 * @typedef {object} EquipmentReviewItem
 * @property {string} id
 * @property {'unknown_feature' | 'unknown_status' | 'low_confidence' | 'missing_source' | 'contradiction'} type
 * @property {string} label
 * @property {string} [featureId]
 * @property {string} [rawLabel]
 * @property {string} [trimId]
 * @property {string} reason
 * @property {'low' | 'medium' | 'high'} severity
 * @property {import('../../data/features/modelEquipmentSchema.js').EquipmentSourceRef | string | null} [sourceRef]
 * @property {'map' | 'ignore' | 'mark_verified' | 'none'} [action]
 */

export const QUALITY_BADGE_LABELS = {
  draft: 'Entwurf',
  needs_review: 'Prüfung nötig',
  partially_verified: 'Teilweise geprüft',
  verified: 'Geprüft',
};

export const QUALITY_BADGE_TONES = {
  draft: 'neutral',
  needs_review: 'warning',
  partially_verified: 'info',
  verified: 'success',
};

/**
 * @param {EquipmentQualityStatus} qualityStatus
 */
export function getQualityBadgeLabel(qualityStatus) {
  return QUALITY_BADGE_LABELS[qualityStatus] ?? qualityStatus;
}

/**
 * @param {EquipmentQualityStatus} qualityStatus
 */
export function getQualityBadgeTone(qualityStatus) {
  return QUALITY_BADGE_TONES[qualityStatus] ?? 'neutral';
}

function hasSourceRef(sourceRef) {
  if (!sourceRef) return false;
  if (typeof sourceRef === 'string') return Boolean(sourceRef.trim());
  return Boolean(
    sourceRef.document
    || sourceRef.rawText
    || sourceRef.section
    || sourceRef.page != null
    || sourceRef.url,
  );
}

function isManualVerifiedEntry(entry) {
  return entry?.confidence === 'manual_verified'
    || entry?.source?.type === 'admin_override'
    || entry?.source?.confidence === 'manual_verified';
}

/**
 * @param {string} modelKey
 */
export function getOpenUnknownFeatureGroupsForQuality(modelKey) {
  const unknownFeatures = getImportedUnknownFeatures(modelKey);
  const openUnknownFeatures = [];
  const ignoredUnknownFeatures = [];

  for (const item of unknownFeatures) {
    if (isUnknownFeatureIgnored(item.rawLabel)) {
      ignoredUnknownFeatures.push(item);
      continue;
    }
    if (findMappingForRawLabel(item.rawLabel)) {
      continue;
    }
    openUnknownFeatures.push(item);
  }

  return { openUnknownFeatures, ignoredUnknownFeatures };
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null | undefined} profile
 * @param {{ openUnknownFeatures?: object[], ignoredUnknownFeatures?: object[] }} [options]
 * @returns {EquipmentReviewItem[]}
 */
export function getOpenReviewItems(profile, options = {}) {
  if (!profile) return [];

  const items = [];
  const openUnknownFeatures = options.openUnknownFeatures ?? [];

  for (const unknown of openUnknownFeatures) {
    items.push({
      id: `unknown:${unknown.rawLabel}:${unknown.trimId ?? 'all'}`,
      type: 'unknown_feature',
      label: unknown.rawLabel,
      rawLabel: unknown.rawLabel,
      trimId: unknown.trimId ?? null,
      reason: 'Unbekanntes Feature aus Import',
      severity: 'high',
      sourceRef: unknown.sourceRef ?? null,
      action: 'map',
    });
  }

  for (const entry of profile.featureAvailability ?? []) {
    const feature = getGlobalFeatureById(entry.featureId);
    const label = feature?.label ?? entry.featureId;
    const trimSuffix = entry.trimId ?? 'all';

    if (entry.status === S.UNKNOWN) {
      items.push({
        id: `unknown-status:${entry.featureId}:${trimSuffix}`,
        type: 'unknown_status',
        label,
        featureId: entry.featureId,
        trimId: entry.trimId,
        reason: 'Status unklar (unknown)',
        severity: 'high',
        sourceRef: entry.sourceRef ?? null,
        action: 'mark_verified',
      });
    }

    if (entry.confidence === 'low' && !isManualVerifiedEntry(entry)) {
      items.push({
        id: `low-confidence:${entry.featureId}:${trimSuffix}`,
        type: 'low_confidence',
        label,
        featureId: entry.featureId,
        trimId: entry.trimId,
        reason: 'Niedrige Datenqualität (confidence: low)',
        severity: 'medium',
        sourceRef: entry.sourceRef ?? null,
        action: 'mark_verified',
      });
    }

    if (entry.status !== S.NOT_AVAILABLE && !hasSourceRef(entry.sourceRef)) {
      items.push({
        id: `missing-source:${entry.featureId}:${trimSuffix}`,
        type: 'missing_source',
        label,
        featureId: entry.featureId,
        trimId: entry.trimId,
        reason: 'Quellenangabe fehlt',
        severity: 'medium',
        sourceRef: null,
        action: 'mark_verified',
      });
    }
  }

  const entriesByKey = new Map();
  for (const entry of profile.featureAvailability ?? []) {
    const key = `${entry.featureId}::${entry.trimId}`;
    if (!entriesByKey.has(key)) entriesByKey.set(key, []);
    entriesByKey.get(key).push(entry);
  }

  for (const [key, entries] of entriesByKey) {
    const statuses = new Set(entries.map((entry) => entry.status));
    if (statuses.size <= 1) continue;

    const [featureId, trimId] = key.split('::');
    const feature = getGlobalFeatureById(featureId);
    items.push({
      id: `contradiction:${key}`,
      type: 'contradiction',
      label: feature?.label ?? featureId,
      featureId,
      trimId,
      reason: `Widersprüchliche Status: ${[...statuses].join(', ')}`,
      severity: 'high',
      sourceRef: entries[0]?.sourceRef ?? null,
      action: 'mark_verified',
    });
  }

  return items;
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelFeatureAvailabilityEntry} featureAvailabilityEntry
 * @param {{ qualityStatus?: EquipmentQualityStatus }} profileQuality
 * @param {EquipmentReviewItem[]} [openReviewItems]
 */
export function isFeatureSafeForCustomer(featureAvailabilityEntry, profileQuality, openReviewItems = []) {
  if (!featureAvailabilityEntry) return false;
  if (featureAvailabilityEntry.status === S.UNKNOWN) return false;

  if (featureAvailabilityEntry.confidence === 'low' && !isManualVerifiedEntry(featureAvailabilityEntry)) {
    return false;
  }

  const hasOpenReview = openReviewItems.some((item) => {
    if (item.featureId !== featureAvailabilityEntry.featureId) return false;
    if (item.trimId && item.trimId !== featureAvailabilityEntry.trimId) return false;
    return true;
  });

  return !hasOpenReview;
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null | undefined} profile
 * @param {{ modelKey?: string, openUnknownFeatures?: object[], ignoredUnknownFeatures?: object[], reviewItems?: EquipmentReviewItem[] }} [options]
 */
export function calculateEquipmentProfileQuality(profile, options = {}) {
  const modelKey = options.modelKey ?? profile?.modelKey;
  const unknownGroups = options.openUnknownFeatures
    ? {
      openUnknownFeatures: options.openUnknownFeatures,
      ignoredUnknownFeatures: options.ignoredUnknownFeatures ?? [],
    }
    : getOpenUnknownFeatureGroupsForQuality(modelKey);

  const reviewItems = options.reviewItems ?? getOpenReviewItems(profile, unknownGroups);
  const override = getProfileQualityOverride(profile?.modelKey, profile?.modelYear);

  const manualVerifiedEntryCount = (profile?.featureAvailability ?? []).filter(isManualVerifiedEntry).length;
  const manualVerifiedMappingCount = getFeatureAliasMappings().length;

  const confirmedFeatureCount = (profile?.featureAvailability ?? []).filter((entry) => (
    isFeatureSafeForCustomer(entry, { qualityStatus: 'verified' }, reviewItems)
  )).length;

  let qualityStatus = /** @type {EquipmentQualityStatus} */ ('verified');

  const hasProgress = manualVerifiedEntryCount > 0
    || unknownGroups.ignoredUnknownFeatures.length > 0
    || manualVerifiedMappingCount > 0;

  if (reviewItems.length > 0) {
    if (hasProgress) {
      qualityStatus = 'partially_verified';
    } else if (reviewItems.some((item) => item.severity !== 'low')) {
      qualityStatus = 'needs_review';
    } else {
      qualityStatus = 'draft';
    }
  }

  const manuallyVerifiedOverride = override?.status === 'verified';

  if (manuallyVerifiedOverride) {
    qualityStatus = 'verified';
  }

  return {
    qualityStatus,
    openReviewCount: reviewItems.length,
    confirmedFeatureCount,
    unknownFeatureCount: unknownGroups.openUnknownFeatures.length,
    ignoredFeatureCount: unknownGroups.ignoredUnknownFeatures.length,
    manualVerifiedMappingCount,
    manualVerifiedEntryCount,
    manuallyVerifiedOverride,
    overrideNote: manuallyVerifiedOverride ? 'Manuell als geprüft markiert' : null,
    override,
    reviewItems,
  };
}

/**
 * @param {string} modelKey
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null | undefined} profile
 */
export function buildProfileQualityContext(modelKey, profile) {
  const unknownGroups = getOpenUnknownFeatureGroupsForQuality(modelKey);
  const reviewItems = getOpenReviewItems(profile, unknownGroups);
  const quality = calculateEquipmentProfileQuality(profile, {
    modelKey,
    ...unknownGroups,
    reviewItems,
  });

  return {
    ...quality,
    ...unknownGroups,
    reviewItems,
  };
}

/**
 * @param {string} modelKey
 * @param {string | number | null} [modelYear]
 */
export function markProfileAsVerified(modelKey, modelYear = null) {
  const entry = {
    modelKey,
    modelYear,
    status: 'verified',
    verifiedBy: 'local-admin',
  };
  console.log('[equipmentQualityService] Profil als geprüft markiert', entry);
  return saveProfileQualityOverride(entry);
}
