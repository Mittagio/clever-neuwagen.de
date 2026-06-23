/**
 * Clever Auswahl – mehrere Trim-Varianten als Angebotsvorschläge pro Modell.
 */
import {
  getModelTrims,
  normalizeModelKey,
  TRIM_FEATURE_MAP,
} from '../../data/features/trimFeatureMapping.js';
import { buildWishConditionChips } from '../customerAkte.js';

export const OFFER_VARIANT_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  OPENED: 'opened',
  INTERESTED: 'interested',
  REJECTED: 'rejected',
  OFFER_REQUESTED: 'offer_requested',
};

export const OFFER_SELECTION_GROUP_STATUS = {
  PREPARED: 'prepared',
  SENT: 'sent',
  CUSTOMER_REACTED: 'customer_reacted',
};

export const CUSTOMER_LINK_BUTTON_LABEL = 'Auswahl als Kundenlink vorbereiten';

const TRIM_COMFORT_LINE = {
  air: 'gute Basis mit sinnvoller Ausstattung',
  vision: 'gute Basis mit sinnvoller Ausstattung',
  earth: 'ausgewogene Ausstattung mit guter Preis-Leistung',
  spirit: 'mehr Komfort und Ausstattung für Alltag',
  'gt-line': 'sportliche Optik und höchste Ausstattung',
  platinum: 'Premium-Ausstattung mit Komfort-Extras',
  elite: 'höchste Ausstattung und Extras',
};

const TIER_PICK_ORDER = [
  ['vision', 'air', 'r', 'core'],
  ['spirit', 'earth', 'platinum'],
  ['gt-line', 'elite', 'black-edition'],
];

const TIER_ROLE_LABELS = {
  entry: 'Preisbewusst',
  middle: 'Mehr Komfort',
  premium: 'Top-Ausstattung',
  recommended: 'Clever Empfehlung',
};

const RECOMMENDED_TRIM_IDS = new Set(['earth', 'spirit']);

let idCounter = 0;

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function resolveMappingKey(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  if (TRIM_FEATURE_MAP[key]) return key;
  const normalized = normalizeModelKey('Kia', modelKey);
  if (TRIM_FEATURE_MAP[normalized]) return normalized;
  if (normalized.startsWith('sportage') && TRIM_FEATURE_MAP.sportage) return 'sportage';
  if (normalized.startsWith('ev3') && TRIM_FEATURE_MAP.ev3) return 'ev3';
  if (normalized.startsWith('ev4') && TRIM_FEATURE_MAP.ev4) return 'ev4';
  return normalized;
}

function sortTrimsByRate(trims, mappingKey) {
  const baseRate = TRIM_FEATURE_MAP[mappingKey]?.baseRate ?? {};
  return [...trims].sort((a, b) => {
    const rateA = baseRate[a.id] ?? 99999;
    const rateB = baseRate[b.id] ?? 99999;
    return rateA - rateB;
  });
}

/**
 * Wählt bis zu drei sinnvolle Trims aus vorhandenen Stammdaten.
 * @returns {string[]}
 */
export function pickSelectionTrimIds(modelKey) {
  const mappingKey = resolveMappingKey(modelKey);
  const trims = getModelTrims(mappingKey);
  if (!trims.length) return [];
  if (trims.length <= 3) return trims.map((trim) => trim.id);

  const sorted = sortTrimsByRate(trims, mappingKey);
  const picked = [];

  for (const pattern of TIER_PICK_ORDER) {
    const found = sorted.find((trim) => pattern.includes(trim.id) && !picked.includes(trim.id));
    if (found) picked.push(found.id);
  }

  if (picked.length < 3) {
    const fallback = [
      sorted[0]?.id,
      sorted[Math.floor(sorted.length / 2)]?.id,
      sorted[sorted.length - 1]?.id,
    ].filter(Boolean);
    for (const id of fallback) {
      if (!picked.includes(id)) picked.push(id);
    }
  }

  return picked.slice(0, 3);
}

function resolveVariantRoleLabel(trimId, tierIndex, totalTiers) {
  if (RECOMMENDED_TRIM_IDS.has(trimId) && tierIndex === 1) {
    return TIER_ROLE_LABELS.recommended;
  }
  if (tierIndex === 0) return TIER_ROLE_LABELS.entry;
  if (tierIndex === totalTiers - 1) return TIER_ROLE_LABELS.premium;
  return TIER_ROLE_LABELS.middle;
}

function resolveVariantShortDescription(trimId) {
  return TRIM_COMFORT_LINE[trimId] ?? 'passende Ausstattung für den Wunsch';
}

function formatRateLabel(rate) {
  if (rate == null || Number.isNaN(rate)) return null;
  return `ca. ${Math.round(rate)} €/Monat`;
}

function formatPriceLabel(price) {
  if (price == null || Number.isNaN(price)) return null;
  return `ca. ${Math.round(price).toLocaleString('de-DE')} €`;
}

function buildVariantPayment(wishConditions = {}) {
  return {
    paymentType: wishConditions.paymentType ?? 'leasing',
    termMonths: wishConditions.termMonths ?? null,
    mileagePerYear: wishConditions.mileagePerYear ?? null,
    desiredRate: wishConditions.desiredRate ?? null,
    desiredPrice: wishConditions.desiredPrice ?? null,
  };
}

function buildVariantFromTrim(trim, tierIndex, totalTiers, mappingKey, wishConditions) {
  const baseRate = TRIM_FEATURE_MAP[mappingKey]?.baseRate?.[trim.id] ?? null;
  const payment = buildVariantPayment(wishConditions);
  const isLeasing = (payment.paymentType ?? 'leasing') === 'leasing'
    || (payment.paymentType ?? '') === 'financing';

  return {
    id: nextId('variant'),
    trimId: trim.id,
    trimLabel: trim.name,
    packages: [],
    extras: [],
    payment,
    calculatedRate: isLeasing ? baseRate : null,
    calculatedPrice: !isLeasing ? null : null,
    label: resolveVariantRoleLabel(trim.id, tierIndex, totalTiers),
    shortDescription: resolveVariantShortDescription(trim.id),
    status: OFFER_VARIANT_STATUS.DRAFT,
  };
}

/**
 * @param {object} input
 * @returns {import('./offerSelectionGroup.js').OfferSelectionGroup|null}
 */
export function createOfferSelectionGroup({
  customerId = null,
  opportunityId = null,
  modelKey,
  modelLabel = null,
  wishConditions = {},
  id = null,
} = {}) {
  const mappingKey = resolveMappingKey(modelKey);
  const modelData = TRIM_FEATURE_MAP[mappingKey];
  if (!modelData) return null;

  const trimIds = pickSelectionTrimIds(mappingKey);
  const trims = trimIds
    .map((trimId) => modelData.trims.find((trim) => trim.id === trimId))
    .filter(Boolean);

  if (!trims.length) return null;

  const now = new Date().toISOString();
  const variants = trims.map((trim, index) => buildVariantFromTrim(
    trim,
    index,
    trims.length,
    mappingKey,
    wishConditions,
  ));

  return {
    id: id ?? nextId('osg'),
    customerId,
    opportunityId,
    modelKey: mappingKey,
    modelLabel: modelLabel ?? modelData.modelLabel ?? `Kia ${mappingKey}`,
    wishConditions: { ...wishConditions },
    variants,
    status: OFFER_SELECTION_GROUP_STATUS.PREPARED,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Erzeugt Gruppe aus Wunschfeldern, wenn sinnvoll.
 */
export function createOfferSelectionGroupFromWish({
  lead = null,
  wishFields = {},
} = {}) {
  const modelKey = wishFields.modelKey
    ?? (wishFields.model ? normalizeModelKey('Kia', wishFields.model) : null);
  if (!modelKey || !shouldAutoGenerateSelectionGroup(modelKey, wishFields)) return null;

  const modelLabel = /^kia\b/i.test(wishFields.model ?? '')
    ? wishFields.model
    : wishFields.model
      ? `Kia ${wishFields.model}`
      : TRIM_FEATURE_MAP[resolveMappingKey(modelKey)]?.modelLabel;

  return createOfferSelectionGroup({
    customerId: lead?.crm?.customerId ?? lead?.customerId ?? null,
    opportunityId: lead?.id ?? null,
    modelKey,
    modelLabel,
    wishConditions: {
      paymentType: wishFields.paymentType ?? 'leasing',
      termMonths: wishFields.termMonths ?? null,
      mileagePerYear: wishFields.mileagePerYear ?? null,
      desiredRate: wishFields.desiredRate ?? null,
      desiredPrice: wishFields.desiredPrice ?? null,
    },
  });
}

export function shouldAutoGenerateSelectionGroup(modelKey, wishFields = {}) {
  const mappingKey = resolveMappingKey(modelKey);
  const trims = getModelTrims(mappingKey);
  if (trims.length < 2) return false;
  if (wishFields.trimLabel?.trim()) return false;
  return true;
}

export function formatSelectionGroupStatus(group) {
  if (!group) return { label: 'Entwurf', tone: 'idea' };
  if (group.status === OFFER_SELECTION_GROUP_STATUS.SENT) {
    return { label: 'gesendet', tone: 'sent' };
  }
  if (group.status === OFFER_SELECTION_GROUP_STATUS.CUSTOMER_REACTED) {
    return { label: 'Kunde hat reagiert', tone: 'opened' };
  }
  return { label: 'vorbereitet', tone: 'ready' };
}

export function formatVariantPriceLine(variant, paymentType = 'leasing') {
  if (!variant) return null;
  const isCash = paymentType === 'cash';
  if (isCash && variant.calculatedPrice != null) {
    return formatPriceLabel(variant.calculatedPrice);
  }
  if (variant.calculatedRate != null) {
    return formatRateLabel(variant.calculatedRate);
  }
  return null;
}

export function formatSelectionGroupTrimLine(group) {
  return (group?.variants ?? [])
    .map((variant) => variant.trimLabel)
    .filter(Boolean)
    .join(' · ');
}

export function formatSelectionGroupSubtitle(group) {
  const count = group?.variants?.length ?? 0;
  if (!count) return 'Keine Vorschläge';
  return `${count} Vorschlag${count === 1 ? '' : 'e'} vorbereitet`;
}

export function formatWishConditionsLine(wishConditions = {}) {
  const chips = buildWishConditionChips({
    paymentType: wishConditions.paymentType ?? 'leasing',
    termMonths: wishConditions.termMonths,
    mileagePerYear: wishConditions.mileagePerYear,
    desiredRate: wishConditions.desiredRate,
    desiredPrice: wishConditions.desiredPrice,
  });
  return chips
    .filter((chip) => !['Leasing', 'Finanzierung', 'Kauf'].includes(chip))
    .join(' · ');
}

export function formatSelectionGroupBudgetLine(wishConditions = {}) {
  const chips = buildWishConditionChips({
    paymentType: wishConditions.paymentType ?? 'leasing',
    termMonths: wishConditions.termMonths,
    mileagePerYear: wishConditions.mileagePerYear,
    desiredRate: wishConditions.desiredRate,
    desiredPrice: wishConditions.desiredPrice,
  });
  const budget = chips.find((chip) => /€/.test(chip));
  return budget ? `Budget: ${budget}` : null;
}

/**
 * Board-Items: Gruppenkacheln + Einzelkarten ohne Duplikat pro Modell.
 */
export function buildBoardItems({ vehicleCards = [], offerSelectionGroups = [] } = {}) {
  const items = [];
  const groupedModelKeys = new Set(
    offerSelectionGroups.map((group) => group.modelKey),
  );

  for (const group of offerSelectionGroups) {
    items.push({
      type: 'selection_group',
      id: group.id,
      group,
    });
  }

  for (const card of vehicleCards) {
    if (groupedModelKeys.has(card.modelKey)) continue;
    items.push({
      type: 'vehicle',
      id: card.id,
      card,
    });
  }

  return items;
}

export function buildCleverAuswahlDetailModel(group) {
  if (!group) return null;
  const paymentType = group.wishConditions?.paymentType ?? 'leasing';
  return {
    title: 'Clever Auswahl',
    modelLabel: group.modelLabel,
    wishConditionsLine: formatWishConditionsLine(group.wishConditions),
    status: formatSelectionGroupStatus(group),
    customerLinkButtonLabel: CUSTOMER_LINK_BUTTON_LABEL,
    variants: (group.variants ?? []).map((variant, index) => ({
      index: index + 1,
      id: variant.id,
      trimLabel: variant.trimLabel,
      label: variant.label,
      priceLine: formatVariantPriceLine(variant, paymentType),
      shortDescription: variant.shortDescription,
      status: variant.status,
      editButtonLabel: 'Variante bearbeiten',
    })),
  };
}

export function hasCustomerLinkButton(detailModel) {
  return detailModel?.customerLinkButtonLabel === CUSTOMER_LINK_BUTTON_LABEL;
}

export function resolveOfferSelectionGroups({
  lead = null,
  wishFields = {},
  storedGroups = null,
} = {}) {
  const fromCrm = storedGroups ?? lead?.crm?.offerSelectionGroups ?? [];
  if (fromCrm.length > 0) return fromCrm;

  const generated = createOfferSelectionGroupFromWish({ lead, wishFields });
  return generated ? [generated] : [];
}

export function groupHasPreparedStatus(group) {
  return group?.status === OFFER_SELECTION_GROUP_STATUS.PREPARED;
}

export function groupHasCustomerReaction(group) {
  if (group?.status === OFFER_SELECTION_GROUP_STATUS.CUSTOMER_REACTED) return true;
  return (group?.variants ?? []).some((variant) => (
    [
      OFFER_VARIANT_STATUS.INTERESTED,
      OFFER_VARIANT_STATUS.OFFER_REQUESTED,
      OFFER_VARIANT_STATUS.OPENED,
      OFFER_VARIANT_STATUS.REJECTED,
    ].includes(variant.status)
  ));
}

/**
 * Speichert Kundenreaktion auf eine Variante (für spätere Kundenlink-Seite).
 */
export function updateVariantCustomerReaction(group, variantId, status) {
  if (!group || !variantId || !status) return group;
  const validStatuses = Object.values(OFFER_VARIANT_STATUS);
  if (!validStatuses.includes(status)) return group;

  const variants = (group.variants ?? []).map((variant) => (
    variant.id === variantId
      ? { ...variant, status, updatedAt: new Date().toISOString() }
      : variant
  ));

  const hasReaction = variants.some((variant) => (
    [
      OFFER_VARIANT_STATUS.INTERESTED,
      OFFER_VARIANT_STATUS.OFFER_REQUESTED,
      OFFER_VARIANT_STATUS.OPENED,
      OFFER_VARIANT_STATUS.REJECTED,
    ].includes(variant.status)
  ));

  return {
    ...group,
    variants,
    status: hasReaction
      ? OFFER_SELECTION_GROUP_STATUS.CUSTOMER_REACTED
      : group.status,
    updatedAt: new Date().toISOString(),
  };
}

export function findPreparedSelectionGroup(offerSelectionGroups = []) {
  return offerSelectionGroups.find((group) => groupHasPreparedStatus(group)) ?? null;
}

export function findReactedSelectionGroup(offerSelectionGroups = []) {
  return offerSelectionGroups.find((group) => groupHasCustomerReaction(group)) ?? null;
}
