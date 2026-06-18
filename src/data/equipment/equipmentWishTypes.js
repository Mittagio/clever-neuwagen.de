/**
 * Ausstattungswünsche in Verkaufschancen – Typen & kundenfreundliche Labels.
 */
import { FEATURE_AVAILABILITY_STATUS as S } from '../features/modelEquipmentSchema.js';

export const EQUIPMENT_WISH_TYPE = 'equipment_feature';

export const EQUIPMENT_WISH_CREATED_FROM = {
  salesSearch: 'equipment_sales_search',
};

export const EQUIPMENT_WISH_STATUS_BADGES = {
  [S.STANDARD]: { label: 'serienmäßig', tone: 'standard' },
  [S.AVAILABLE]: { label: 'verfügbar', tone: 'available' },
  [S.OPTIONAL]: { label: 'optional', tone: 'optional' },
  [S.PACKAGE_REQUIRED]: { label: 'Paket nötig', tone: 'package' },
  [S.NOT_AVAILABLE]: { label: 'nicht verfügbar', tone: 'unavailable' },
  [S.UNKNOWN]: { label: 'wird geprüft', tone: 'pending' },
};

/**
 * @param {string} status
 */
export function getEquipmentWishStatusBadge(status) {
  return EQUIPMENT_WISH_STATUS_BADGES[status] ?? EQUIPMENT_WISH_STATUS_BADGES[S.UNKNOWN];
}

/**
 * Kunden-/Angebots-sichere Sicht (ohne interne Quellen).
 * @param {object} wish
 */
export function toCustomerSafeEquipmentWish(wish) {
  if (!wish) return null;
  return {
    id: wish.id,
    type: wish.type,
    featureId: wish.featureId,
    featureLabel: wish.featureLabel,
    modelKey: wish.modelKey,
    modelLabel: wish.modelLabel,
    modelYear: wish.modelYear ?? null,
    status: wish.status,
    statusLabel: wish.statusLabel,
    trimId: wish.trimId ?? null,
    trimLabel: wish.trimLabel ?? null,
    packageId: wish.packageId ?? null,
    packageLabel: wish.packageLabel ?? null,
    recommendedTrimId: wish.recommendedTrimId ?? null,
    recommendedTrimLabel: wish.recommendedTrimLabel ?? null,
    customerText: wish.customerText,
    createdFrom: wish.createdFrom,
    createdAt: wish.createdAt,
  };
}
