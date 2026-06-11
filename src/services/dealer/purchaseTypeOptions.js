/**
 * Phase 3 – Kaufart (Customer Journey).
 */
import {
  getSpecialConditionLabels,
  resolvePrimaryDiscountGroup,
} from './specialConditionOptions.js';

/** @typedef {'cash'|'finance'|'leasing'|'open'} PurchaseTypeId */

/** @type {{ id: PurchaseTypeId, label: string, hint?: string }[]} */
export const PURCHASE_TYPE_OPTIONS = [
  { id: 'cash', label: 'Kauf' },
  { id: 'finance', label: 'Finanzierung' },
  { id: 'leasing', label: 'Leasing' },
  {
    id: 'open',
    label: 'Noch offen',
    hint: 'Clever zeigt Ihnen später Kauf, Finanzierung und Leasing – zum Vergleichen.',
  },
];

/**
 * @param {PurchaseTypeId|null|undefined} id
 */
export function getPurchaseTypeLabel(id) {
  return PURCHASE_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? null;
}

/**
 * @param {PurchaseTypeId|null|undefined} id
 */
export function shouldShowAllPaymentVariants(id) {
  return id === 'open';
}

/**
 * @param {object} params
 * @param {object|null} params.configSummary
 * @param {PurchaseTypeId|null} params.purchaseType
 * @param {string[]|null} [params.specialConditions]
 * @param {object|null} [params.configuration]
 */
export function buildDealerJourneySnapshot({
  configSummary,
  purchaseType,
  specialConditions = null,
  configuration = null,
}) {
  if (!configSummary) return null;

  const conditionIds = specialConditions ?? [];
  const discountGroup = resolvePrimaryDiscountGroup(conditionIds);

  return {
    configuration,
    vehicle: {
      modelKey: configSummary.modelKey,
      modelLabel: configSummary.modelLabel,
      trimLabel: configSummary.trimLabel,
      colorLabel: configSummary.colorLabel,
      powertrainLabel: configSummary.powertrainLabel,
      packageLabels: configSummary.packageLabels ?? [],
    },
    purchaseType: purchaseType ?? null,
    purchaseTypeLabel: getPurchaseTypeLabel(purchaseType),
    showAllPaymentVariants: shouldShowAllPaymentVariants(purchaseType),
    specialConditions: conditionIds,
    specialConditionLabels: getSpecialConditionLabels(conditionIds),
    discountGroup,
  };
}
