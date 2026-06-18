/**
 * Kunden-Chips für Ausstattungsberatung.
 * Statische Gruppen sind deprecated – dynamische Chips kommen aus equipmentChipBuilder.
 */
import { getGlobalFeatureById } from './globalFeatureCatalog.js';
import {
  getDynamicEquipmentWishChip,
  resolveChipToScoringFeatureIds,
} from '../../services/configuration/equipmentChipBuilder.js';

/** @deprecated Nur noch für andere Flows (SmartSales, DealerSearch) – nicht Ausstattungsschritt */
export const EQUIPMENT_WISH_GROUPS = [];

const CHIP_BY_ID = new Map(
  EQUIPMENT_WISH_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, { ...c, groupId: g.id }])),
);

export function getEquipmentWishChip(chipId) {
  return CHIP_BY_ID.get(chipId) ?? getDynamicEquipmentWishChip(chipId);
}

export function chipToFeatureIds(chipId) {
  return resolveChipToScoringFeatureIds(chipId);
}

export function featureIdsToChipIds(featureIds = []) {
  const set = new Set(featureIds);
  const chips = [];

  for (const featureId of featureIds) {
    const feature = getGlobalFeatureById(featureId);
    if (feature?.showAsChip && set.has(feature.id)) {
      chips.push(feature.id);
    }
  }

  for (const featureId of featureIds) {
    const feature = getGlobalFeatureById(featureId);
    if (!feature?.showAsChip) continue;
    const legacy = feature.legacyFeatureId;
    if (legacy && set.has(legacy) && !chips.includes(feature.id)) {
      chips.push(feature.id);
    }
  }

  for (const [chipId, chip] of CHIP_BY_ID) {
    if (chip.featureIds.every((fid) => set.has(fid)) && !chips.includes(chipId)) {
      chips.push(chipId);
    }
  }

  return [...new Set(chips)];
}

export function isChipSelected(chipId, featureIds = []) {
  if (featureIds.includes(chipId)) return true;
  const chip = getEquipmentWishChip(chipId);
  if (!chip) return false;
  const ids = chip.featureIds ?? [chipId];
  return ids.length > 0 && ids.every((fid) => featureIds.includes(fid));
}

export function chipToGlobalFeatureId(chipId) {
  const chip = getEquipmentWishChip(chipId);
  return chip?.globalFeatureId ?? chip?.id ?? chipId;
}
