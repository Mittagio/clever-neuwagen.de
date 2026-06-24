/**
 * Aktionen – Geltungsbereich, Zielgruppen, Kombinationsregeln
 */

export const PROMOTION_SCOPE_TYPES = {
  MODEL: 'model',
  MODELS: 'models',
  BRAND: 'brand',
};

export const PROMOTION_SCOPE_LABELS = {
  [PROMOTION_SCOPE_TYPES.MODEL]: 'Nur dieses Modell',
  [PROMOTION_SCOPE_TYPES.MODELS]: 'Mehrere Modelle',
  [PROMOTION_SCOPE_TYPES.BRAND]: 'Ganze Marke',
};

export const DEFAULT_TARGET_GROUPS = [
  { id: 'privat', label: 'Privat' },
  { id: 'gewerbe', label: 'Gewerbe' },
  { id: 'schwerbehindert', label: 'Schwerbehinderung' },
  { id: 'corporate', label: 'Corporate Benefits' },
  { id: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },
  { id: 'freiberufler', label: 'Freiberufler' },
  { id: 'selbststaendig', label: 'Selbstständig' },
];

export const LEGACY_TARGET_GROUP_MAP = {
  all: 'privat',
  studenten: 'studenten',
  gewerbe: 'gewerbe',
  schwerbehindert: 'schwerbehindert',
  corporate: 'corporate',
  oeffentlicherDienst: 'oeffentlicherDienst',
};

const CUSTOMER_GROUP_TO_TARGET = {
  standard: 'privat',
  corporateBenefits: 'corporate',
  schwerbehindert: 'schwerbehindert',
  oeffentlicherDienst: 'oeffentlicherDienst',
  gewerbe: 'gewerbe',
  studenten: 'studenten',
  aktion: 'privat',
  privat: 'privat',
};

export function mapCustomerGroupToTargetGroup(customerGroup = 'standard') {
  return CUSTOMER_GROUP_TO_TARGET[customerGroup]
    ?? LEGACY_TARGET_GROUP_MAP[customerGroup]
    ?? customerGroup
    ?? 'privat';
}

export function resolveTargetGroups(conditions = {}) {
  const custom = (conditions.customTargetGroups ?? []).map((g) => ({
    id: g.id,
    label: g.label,
    custom: true,
  }));
  return [...DEFAULT_TARGET_GROUPS, ...custom];
}

export function resolveTargetGroupLabel(conditions = {}, targetGroupId = '') {
  const groups = resolveTargetGroups(conditions);
  return groups.find((g) => g.id === targetGroupId)?.label ?? targetGroupId;
}

export function normalizePromotionScope(raw = {}, modelId = '') {
  if (!raw?.type) {
    return { type: PROMOTION_SCOPE_TYPES.MODEL, modelIds: [modelId], brand: null };
  }
  return {
    type: raw.type,
    modelIds: raw.modelIds?.length ? raw.modelIds : [modelId],
    brand: raw.brand ?? null,
  };
}

export function promotionAppliesToModel(promotion = {}, model = {}) {
  const scope = normalizePromotionScope(promotion.scope, model.id);
  if (scope.type === PROMOTION_SCOPE_TYPES.BRAND) {
    return !scope.brand || scope.brand === model.brand;
  }
  if (scope.type === PROMOTION_SCOPE_TYPES.MODELS) {
    return scope.modelIds.includes(model.id);
  }
  return scope.modelIds.includes(model.id);
}

export function canCombinePromotions(promoA = {}, promoB = {}) {
  if (promoA.combinable === false || promoB.combinable === false) return false;
  const exclusiveA = promoA.exclusiveWith ?? [];
  const exclusiveB = promoB.exclusiveWith ?? [];
  if (exclusiveA.includes(promoB.id) || exclusiveB.includes(promoA.id)) return false;
  return true;
}

export function filterCombinablePromotions(promotions = []) {
  const selected = [];
  for (const promo of promotions) {
    const conflicts = selected.some((existing) => !canCombinePromotions(existing, promo));
    if (!conflicts) selected.push(promo);
  }
  return selected;
}

export function detectPromotionConflicts(promotions = []) {
  const conflicts = [];
  for (let i = 0; i < promotions.length; i += 1) {
    for (let j = i + 1; j < promotions.length; j += 1) {
      if (!canCombinePromotions(promotions[i], promotions[j])) {
        conflicts.push({
          a: promotions[i],
          b: promotions[j],
          label: `„${promotions[i].title}“ und „${promotions[j].title}“ sind nicht kombinierbar`,
        });
      }
    }
  }
  return conflicts;
}

export function createCustomTargetGroup(label = 'Eigene Zielgruppe') {
  const slug = label.toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `custom-${Date.now()}`;
  return { id: slug, label: label.trim() || 'Eigene Zielgruppe' };
}
