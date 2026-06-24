/**
 * Händler-Fahrzeugverwaltung – Modellkarten, Konditionen, Aktionen, Überführung
 */
import {
  DEALER_MODEL_CATALOG,
  resolveDiscountsForModel,
} from '../../data/dealerConditionsSchema.js';
import {
  DEFAULT_TARGET_GROUPS,
  normalizePromotionScope,
  PROMOTION_SCOPE_TYPES,
} from './dealerPromotionEngine.js';
import { resolveTrimSettings } from './dealerTrimConditions.js';

export const PAYMENT_DISCOUNT_QUICK_VALUES = [8, 10, 12, 15];

/** @deprecated Nutze resolveTargetGroups – Legacy-Alias */
export const ACTION_TARGET_GROUPS = [
  ...DEFAULT_TARGET_GROUPS,
  { id: 'studenten', label: 'Studenten' },
  { id: 'all', label: 'Alle Kunden' },
];

export const CASH_PREPARATION_MODES = [
  { id: 'separate', label: 'bei Barpreis separat anzeigen' },
  { id: 'included', label: 'in Barpreis einrechnen' },
  { id: 'custom', label: 'eigener Text' },
];

let promoIdCounter = 0;

export function nextPromotionId() {
  promoIdCounter += 1;
  return `promo-${Date.now()}-${promoIdCounter}`;
}

export function buildDefaultModelSettings(modelId, conditions = {}) {
  const catalog = DEALER_MODEL_CATALOG.find((m) => m.id === modelId);
  const standardDiscount = conditions.discountsByModel?.[modelId]?.standard ?? 10;
  const delivery = conditions.deliveryByModel?.[modelId] ?? {};

  return {
    listPrice: null,
    priceFrom: null,
    customerHint: '',
    paymentDiscounts: {
      cash: standardDiscount,
      leasing: standardDiscount,
      financing: standardDiscount,
    },
    bonusAmount: null,
    discountMin: null,
    discountMax: 50,
    showOnCustomerSite: true,
    highlight: false,
    landingPriority: 50,
    preparationFee: {
      useDealerDefault: true,
      amount: null,
      cashDisplayMode: 'separate',
      customLegalText: '',
      leasingAlwaysSeparate: true,
    },
    promotions: [],
    deliveryTime: delivery.defaultDeliveryTime ?? catalog?.defaultDeliveryTime ?? '4–6 Wochen',
    leasingFactorSkipped: {},
    financeWizardSkipped: {},
  };
}

export function resolveModelSettings(conditions = {}, modelId = '') {
  const stored = conditions.modelSettingsByModel?.[modelId] ?? {};
  const defaults = buildDefaultModelSettings(modelId, conditions);
  return {
    ...defaults,
    ...stored,
    paymentDiscounts: {
      ...defaults.paymentDiscounts,
      ...(stored.paymentDiscounts ?? {}),
    },
    preparationFee: {
      ...defaults.preparationFee,
      ...(stored.preparationFee ?? {}),
    },
    promotions: (stored.promotions ?? []).map((p) => normalizePromotion(p, modelId)),
  };
}

export function normalizePromotion(raw = {}, modelId = '') {
  return {
    id: raw.id ?? nextPromotionId(),
    title: raw.title ?? '',
    description: raw.description ?? '',
    bonusAmount: raw.bonusAmount ?? null,
    extraDiscountPercent: raw.extraDiscountPercent ?? null,
    targetGroup: raw.targetGroup ?? 'privat',
    scope: normalizePromotionScope(raw.scope, modelId),
    combinable: raw.combinable !== false,
    exclusiveWith: raw.exclusiveWith ?? [],
    validFrom: raw.validFrom ?? '',
    validUntil: raw.validUntil ?? '',
    showOnCustomerSite: raw.showOnCustomerSite !== false,
    badgeText: raw.badgeText ?? '',
    highlight: raw.highlight === true,
    badgePriority: raw.badgePriority ?? 50,
    active: raw.active !== false,
  };
}

export function createEmptyPromotion(modelId = '') {
  return normalizePromotion({
    title: 'Neue Aktion',
    badgeText: 'Händleraktion',
    targetGroup: 'privat',
    scope: { type: PROMOTION_SCOPE_TYPES.MODEL, modelIds: [modelId] },
    showOnCustomerSite: true,
    active: true,
    combinable: true,
  }, modelId);
}

function isPromotionActive(promo, now = new Date()) {
  if (!promo.active || !promo.showOnCustomerSite) return false;
  const from = promo.validFrom ? new Date(promo.validFrom) : null;
  const until = promo.validUntil ? new Date(promo.validUntil) : null;
  if (from && !Number.isNaN(from.getTime()) && now < from) return false;
  if (until && !Number.isNaN(until.getTime()) && now > until) return false;
  return true;
}

export function getActivePromotions(settings, now = new Date()) {
  return (settings.promotions ?? []).filter((p) => isPromotionActive(p, now));
}

export function resolvePreparationFeeAmount(conditions, modelId) {
  const settings = resolveModelSettings(conditions, modelId);
  const prep = settings.preparationFee ?? {};
  if (prep.useDealerDefault !== false) {
    return Number(conditions.preparationFee) || 0;
  }
  return Number(prep.amount) || Number(conditions.preparationFee) || 0;
}

export function formatPreparationFeeSuffix(conditions, modelId, paymentType = 'leasing') {
  const amount = resolvePreparationFeeAmount(conditions, modelId);
  if (!amount) return null;
  const settings = resolveModelSettings(conditions, modelId);
  const prep = settings.preparationFee ?? {};

  if (paymentType === 'leasing' || paymentType === 'financing' || prep.leasingAlwaysSeparate !== false) {
    return `zzgl. ${amount.toLocaleString('de-DE')} € Überführung`;
  }

  if (prep.cashDisplayMode === 'included') {
    return `inkl. ${amount.toLocaleString('de-DE')} € Überführung`;
  }
  if (prep.cashDisplayMode === 'custom' && prep.customLegalText?.trim()) {
    return prep.customLegalText.trim();
  }
  return `zzgl. ${amount.toLocaleString('de-DE')} € Überführung`;
}

export function formatValidUntilShort(iso = '') {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Badges für Kunden-Landingpage – mit Priorität und Overflow
 */
export function prioritizeCustomerBadges(badges = [], maxVisible = 2) {
  const sorted = [...badges].sort((a, b) => {
    if (a.highlight && !b.highlight) return -1;
    if (!a.highlight && b.highlight) return 1;
    return (a.priority ?? 50) - (b.priority ?? 50);
  });
  const visible = sorted.slice(0, maxVisible);
  const hiddenCount = Math.max(0, sorted.length - visible.length);
  return {
    badges: visible,
    allBadges: sorted,
    hiddenCount,
    overflowLabel: hiddenCount > 0 ? `+ ${hiddenCount} weitere Vorteile` : null,
  };
}

export function buildCustomerModelBadges(
  conditions = {},
  modelId = '',
  { trimId = null, maxVisible = 5 } = {},
) {
  const presentation = buildCustomerModelBadgePresentation(conditions, modelId, { trimId, maxVisible });
  return presentation.allBadges ?? presentation.badges;
}

export function buildCustomerModelBadgePresentation(
  conditions = {},
  modelId = '',
  { trimId = null, maxVisible = 2 } = {},
) {
  const badges = [];
  const settings = resolveModelSettings(conditions, modelId);
  const trimSettings = trimId ? resolveTrimSettings(settings, trimId) : settings;
  const { resolved } = resolveDiscountsForModel(conditions.discountsByModel, modelId);
  const leasingDiscount = trimSettings.paymentDiscounts?.leasing ?? settings.paymentDiscounts?.leasing ?? resolved.standard;

  if (leasingDiscount > 0) {
    badges.push({
      id: 'dealer-discount',
      label: `${leasingDiscount} % Rabatt`,
      tone: 'purple',
      priority: 10,
      highlight: true,
    });
  }

  for (const promo of getActivePromotions(settings)) {
    if (promo.bonusAmount > 0) {
      badges.push({
        id: `bonus-${promo.id}`,
        label: promo.badgeText?.trim() || `${promo.bonusAmount.toLocaleString('de-DE')} € ${ACTION_TARGET_GROUPS.find((g) => g.id === promo.targetGroup)?.label ?? 'Bonus'}`,
        tone: 'green',
        priority: promo.highlight ? 5 : (promo.badgePriority ?? 30),
        highlight: promo.highlight === true,
      });
    } else if (promo.extraDiscountPercent > 0) {
      badges.push({
        id: `extra-${promo.id}`,
        label: promo.badgeText?.trim() || `${promo.extraDiscountPercent} % extra`,
        tone: 'blue',
        priority: promo.highlight ? 5 : (promo.badgePriority ?? 40),
        highlight: promo.highlight === true,
      });
    } else if (promo.badgeText?.trim()) {
      badges.push({
        id: `badge-${promo.id}`,
        label: promo.badgeText.trim(),
        tone: 'neutral',
        priority: promo.highlight ? 5 : (promo.badgePriority ?? 60),
        highlight: promo.highlight === true,
      });
    }

    const untilLabel = formatValidUntilShort(promo.validUntil);
    if (untilLabel && promo.showOnCustomerSite) {
      badges.push({
        id: `until-${promo.id}`,
        label: `gültig bis ${untilLabel.replace(/\.\d{4}$/, '.')}`,
        tone: 'muted',
        priority: 90,
      });
    }
  }

  return prioritizeCustomerBadges(badges, maxVisible);
}

export function buildModelManagementCard(conditions = {}, model = {}) {
  const settings = resolveModelSettings(conditions, model.id);
  const { resolved } = resolveDiscountsForModel(conditions.discountsByModel, model.id);
  const activePromos = getActivePromotions(settings);
  const primaryDiscount = settings.paymentDiscounts?.leasing ?? resolved.standard;

  return {
    id: model.id,
    brand: model.brand ?? 'Kia',
    name: model.name ?? model.id,
    active: Boolean(model.active),
    showOnDealerPage: Boolean(model.showOnDealerPage),
    discountPercent: primaryDiscount,
    activeActionCount: activePromos.length,
    actionLabels: activePromos.map((p) => p.badgeText || p.title).filter(Boolean).slice(0, 2),
    deliveryTime: settings.deliveryTime ?? model.defaultDeliveryTime ?? '4–6 Wochen',
    highlight: settings.highlight,
    landingPriority: settings.landingPriority ?? 50,
  };
}

export function listManagementModels(conditions = {}, { search = '', filter = 'all' } = {}) {
  const models = (conditions.activeModels ?? []).map((model) => ({
    model,
    card: buildModelManagementCard(conditions, model),
  }));

  const query = search.trim().toLowerCase();
  let filtered = models;

  if (query) {
    filtered = filtered.filter(({ model }) => (
      `${model.brand} ${model.name}`.toLowerCase().includes(query)
      || model.id.toLowerCase().includes(query)
    ));
  }

  if (filter === 'active') {
    filtered = filtered.filter(({ model }) => model.active);
  } else if (filter === 'inactive') {
    filtered = filtered.filter(({ model }) => !model.active);
  } else if (filter === 'actions') {
    filtered = filtered.filter(({ card }) => card.activeActionCount > 0);
  } else if (filter === 'highlight') {
    filtered = filtered.filter(({ card }) => card.highlight);
  }

  return filtered.sort((a, b) => {
    const prioA = a.card.landingPriority ?? 50;
    const prioB = b.card.landingPriority ?? 50;
    if (prioA !== prioB) return prioB - prioA;
    return a.model.name.localeCompare(b.model.name, 'de');
  });
}

export function clampDiscount(value, min = 0, max = 50) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
}
