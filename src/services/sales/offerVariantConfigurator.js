/**
 * Clever Auswahl – Varianten-Konfigurator (Angebotswelt, nicht Wunschformular).
 */
import { applyDealerDefaultsToDraft, resolveDealerPaymentDefaults } from '../dealer/dealerOfferDefaults.js';
import { resolvePaymentDiscountPercent } from '../dealer/dealerModelPricing.js';
import { PAYMENT_DISCOUNT_QUICK_VALUES } from '../dealer/dealerVehicleManagement.js';
import {
  buildConfigureOptions,
  computeLiveRateForDraft,
} from '../dealerAiVehicleConfigureFlow.js';
import { buildVehicleConfiguration } from '../configuration/vehicleConfigurationModel.js';
import { buildOfferConditionsFromDraft } from '../configuration/offerConditionsModel.js';
import { computeOfferCalculation } from '../configuration/offerCalculation.js';
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';
import {
  buildPackageCatalog,
  sanitizePackageIdsForTrim,
} from '../configuration/configurePackageCatalog.js';
import { PAYMENT_TYPE_LABELS } from '../dealerAiParser.js';
import { computeUvpPricing } from '../configuration/uvpPricing.js';
import { OFFER_VARIANT_STATUS } from './offerSelectionGroup.js';
import {
  formatWishConditionsBanner,
  hasMeaningfulWishConditions,
} from './wishConditionsSync.js';

export const VARIANT_TERM_OPTIONS = [24, 36, 48, 60];
export const VARIANT_MILEAGE_OPTIONS = [5000, 10000, 15000, 20000, 30000];
export const VARIANT_DOWN_OPTIONS = [0, 1000, 3000, 5000];
export const VARIANT_PREP_PRESETS = [990, 1190, 1290, 1490];
export { PAYMENT_DISCOUNT_QUICK_VALUES };

export const VARIANT_PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Kauf / Bar' },
  { id: 'leasing', label: 'Leasing' },
  { id: 'financing', label: 'Finanzierung' },
];

let idCounter = 0;

function nextVariantId() {
  idCounter += 1;
  return `variant-${Date.now()}-${idCounter}`;
}

function normalizePaymentType(paymentType = 'leasing') {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'financing';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

function resolveModelLabel(group, modelKey) {
  const mfg = resolveConfigureModel(modelKey);
  if (mfg?.model) return mfg.model;
  return String(group?.modelLabel ?? modelKey ?? '').replace(/^Kia\s+/i, '').trim();
}

/**
 * Configure-Draft aus Clever-Auswahl-Variante + Händlerdefaults.
 */
export function buildDraftFromSelectionVariant({
  group,
  variant,
  lead = null,
  conditions = null,
} = {}) {
  if (!group?.modelKey || !variant) return null;

  const modelKey = group.modelKey;
  const wish = group.wishConditions ?? {};
  const payment = variant.payment ?? {};
  const options = buildConfigureOptions(modelKey, variant.trimId);
  const trim = options.trims?.find((t) => t.id === variant.trimId)
    ?? (variant.trimLabel
      ? options.trims?.find((t) => (
        String(t.label ?? '').toLowerCase() === String(variant.trimLabel).toLowerCase()
      ))
      : null)
    ?? options.trims?.[0];

  const draft = {
    modelKey,
    brand: 'Kia',
    model: resolveModelLabel(group, modelKey),
    trimId: variant.trimId ?? trim?.id ?? null,
    trimLabel: variant.trimLabel ?? trim?.label ?? null,
    engineId: variant.engineId ?? options.engines?.[0]?.id ?? null,
    batteryLabel: variant.batteryLabel ?? options.engines?.[0]?.label ?? null,
    colorId: variant.colorId ?? options.colors?.[0]?.id ?? null,
    colorLabel: variant.colorLabel ?? options.colors?.[0]?.label ?? null,
    paymentType: payment.paymentType ?? wish.paymentType ?? 'leasing',
    termMonths: payment.termMonths ?? wish.termMonths ?? null,
    mileagePerYear: payment.mileagePerYear ?? wish.mileagePerYear ?? null,
    downPayment: payment.downPayment ?? wish.downPayment ?? lead?.wish?.downPayment ?? 0,
    desiredRate: payment.desiredRate ?? wish.desiredRate ?? lead?.desiredRate ?? null,
    desiredPrice: payment.desiredPrice ?? wish.desiredPrice ?? lead?.wish?.desiredPrice ?? null,
    customerGroup: variant.customerGroup ?? payment.customerGroup ?? 'standard',
    customDiscountPercent: variant.customDiscountPercent ?? payment.customDiscountPercent ?? null,
    discountLabel: variant.discountLabel ?? null,
    preparationFee: variant.preparationFee ?? payment.preparationFee ?? null,
    packageIds: variant.packageIds ?? variant.packages ?? [],
    accessoryIds: variant.accessoryIds ?? [],
    extras: variant.extras ?? {},
    displayPriceOverride: variant.displayPriceOverride ?? null,
    displayRateOverride: variant.displayRateOverride ?? null,
    options,
    customer: {
      name: lead?.contact?.name ?? null,
      phone: lead?.contact?.phone ?? null,
      email: lead?.contact?.email ?? null,
    },
  };

  const enriched = applyDealerDefaultsToDraft(draft, conditions);
  const wishSummaryLine = hasMeaningfulWishConditions(wish)
    ? formatWishConditionsBanner(wish)
    : null;

  return {
    ...enriched,
    conditionsFromWish: hasMeaningfulWishConditions(wish) && !variant.conditionsLocked,
    wishSummaryLine,
  };
}

/**
 * Basis-Draft ohne optionale Pakete – für Mehrpreis-Vergleich.
 */
export function buildBaseDraftForVariant(draft) {
  if (!draft) return null;
  return {
    ...draft,
    packageIds: [],
    accessoryIds: [],
  };
}

export function resolveVariantDiscountPercent(draft, conditions) {
  if (!draft) return 0;
  return resolvePaymentDiscountPercent(
    conditions,
    draft.modelKey,
    'cash',
    draft.customerGroup ?? 'standard',
    draft.customDiscountPercent,
    draft.trimId,
  );
}

export function buildVariantPrepFeeChips(defaultFee) {
  const values = new Set([...VARIANT_PREP_PRESETS, defaultFee].filter((v) => v != null));
  return [...values].sort((a, b) => a - b);
}

/**
 * Barkauf wie Angebotsprogramm: UPE → Rabatt → Hauspreis + Überführung = Angebotspreis.
 */
export function computeVariantCashOffer(draft, conditions) {
  const vehicleConfiguration = buildVehicleConfiguration(draft);
  if (!vehicleConfiguration || !draft) return null;

  const offerConditions = buildOfferConditionsFromDraft(draft, conditions);
  const calculation = computeOfferCalculation(vehicleConfiguration, offerConditions, conditions);
  if (!calculation) return null;

  const preparationFee = offerConditions.preparationFee
    ?? conditions?.preparationFee
    ?? 1290;
  const housePrice = calculation.housePrice ?? 0;
  const uvp = calculation.configurationPrice
    ?? vehicleConfiguration.uvpConfigurationPrice
    ?? null;
  const discountPercent = calculation.discountPercent ?? 0;
  const discountAmount = calculation.discountAmount ?? 0;
  const totalPrice = housePrice + preparationFee;

  return {
    uvp,
    discountPercent,
    discountAmount,
    housePrice,
    preparationFee,
    totalPrice,
    discountLabel: draft.discountLabel ?? null,
  };
}

export function computeVariantConfiguratorPreview(draft, conditions, baseDraft = null) {
  if (!draft) return { rate: null, baseRate: null, delta: null, paymentLabel: null };

  const paymentMode = normalizePaymentType(draft.paymentType);
  const paymentLabel = PAYMENT_TYPE_LABELS[draft.paymentType]
    ?? PAYMENT_TYPE_LABELS.leasing;

  if (paymentMode === 'cash') {
    const cashOffer = computeVariantCashOffer(draft, conditions);
    const rate = cashOffer?.totalPrice ?? null;
    let baseRate = rate;
    if (baseDraft) {
      const baseOffer = computeVariantCashOffer(baseDraft, conditions);
      baseRate = baseOffer?.totalPrice ?? rate;
    }
    const delta = rate != null && baseRate != null ? Math.round(rate - baseRate) : null;
    return {
      rate,
      baseRate,
      delta,
      paymentLabel,
      isCash: true,
      cashOffer,
    };
  }

  const live = computeLiveRateForDraft(draft, conditions);
  const rate = live?.amount ?? null;

  let baseRate = rate;
  if (baseDraft) {
    const baseLive = computeLiveRateForDraft(baseDraft, conditions);
    baseRate = baseLive?.amount ?? rate;
  }

  const delta = rate != null && baseRate != null ? Math.round(rate - baseRate) : null;

  return {
    rate,
    baseRate,
    delta,
    paymentLabel,
    isCash: false,
    cashOffer: null,
  };
}

export function formatConfiguratorRate(preview) {
  if (preview?.rate == null) return '–';
  if (preview.isCash) {
    return `${Math.round(preview.rate).toLocaleString('de-DE')} €`;
  }
  return `${Math.round(preview.rate).toLocaleString('de-DE')} €/Monat`;
}

/** Anzeige-Betrag mit optionalen VK-Overrides (PDF/Bank). */
export function resolveVariantDisplayAmounts(draft, preview, variant = null) {
  if (!draft) {
    return { isCash: false, amount: null, formatted: '–' };
  }
  const isCash = preview?.isCash ?? normalizePaymentType(draft.paymentType) === 'cash';
  const priceOverride = draft.displayPriceOverride ?? variant?.displayPriceOverride ?? null;
  const rateOverride = draft.displayRateOverride ?? variant?.displayRateOverride ?? null;

  if (isCash) {
    const amount = priceOverride ?? preview?.rate ?? variant?.calculatedPrice ?? null;
    if (amount == null) return { isCash: true, amount: null, formatted: '–' };
    return {
      isCash: true,
      amount: Math.round(amount),
      formatted: `${Math.round(amount).toLocaleString('de-DE')} €`,
    };
  }

  const amount = rateOverride ?? preview?.rate ?? variant?.calculatedRate ?? null;
  if (amount == null) return { isCash: false, amount: null, formatted: '–' };
  return {
    isCash: false,
    amount: Math.round(amount),
    formatted: `${Math.round(amount).toLocaleString('de-DE')} €/Monat`,
  };
}

export function formatVariantConditionsLine(variant) {
  if (!variant) return '';
  const payment = variant.payment ?? {};
  return buildConfiguratorConditionsLine({
    paymentType: payment.paymentType ?? 'leasing',
    termMonths: payment.termMonths ?? null,
    mileagePerYear: payment.mileagePerYear ?? null,
    downPayment: payment.downPayment ?? 0,
  }, PAYMENT_TYPE_LABELS[payment.paymentType]);
}

/** Konditionen als Chip-Labels für Clever-Auswahl-Sheet. */
export function buildVariantConditionChips(variant) {
  const line = formatVariantConditionsLine(variant);
  if (!line) return [];
  return line.split(' · ').map((part) => part.trim()).filter(Boolean);
}

export function formatVariantCustomerPriceLine(variant) {
  if (!variant) return null;
  const paymentType = variant.payment?.paymentType ?? 'leasing';
  const isCash = normalizePaymentType(paymentType) === 'cash';
  if (isCash) {
    const price = variant.displayPriceOverride ?? variant.calculatedPrice;
    if (price == null) return null;
    return `${Math.round(price).toLocaleString('de-DE')} €`;
  }
  const rate = variant.displayRateOverride ?? variant.calculatedRate;
  if (rate == null) return null;
  return `${Math.round(rate).toLocaleString('de-DE')} €/Monat`;
}

/** Label für Duplikat-Variante: „Air · Leasing · 48 Monate · 10.000 km/Jahr“. */
export function buildVariantOfferLabel(draft, preview = null) {
  if (!draft?.trimLabel) return null;
  const conditions = buildConfiguratorConditionsLine(
    draft,
    preview?.paymentLabel ?? PAYMENT_TYPE_LABELS[draft.paymentType],
  );
  if (!conditions || conditions === 'Kauf') {
    return `${draft.trimLabel} · Kauf`;
  }
  return `${draft.trimLabel} · ${conditions}`;
}

export function buildPortfolioSummaryLine({ modelLabel, trimLabel, conditionsLine, displayFormatted }) {
  const title = trimLabel ? `${modelLabel} · ${trimLabel}` : modelLabel;
  const cond = conditionsLine && conditionsLine !== 'Kauf' ? ` (${conditionsLine})` : '';
  if (!displayFormatted || displayFormatted === '–') {
    return `• ${title}${cond}`;
  }
  return `• ${title}${cond}: ${displayFormatted}`;
}

export function formatConfiguratorDelta(delta, isCash = false) {
  if (delta == null || delta === 0) return null;
  const sign = delta > 0 ? '+' : '';
  const suffix = isCash ? ' €' : ' €/Monat';
  return `${sign}${delta.toLocaleString('de-DE')}${suffix}`;
}

export function buildConfiguratorSummaryLine(draft) {
  if (!draft) return '';
  const parts = [];
  if (draft.trimLabel) parts.push(draft.trimLabel);
  if (draft.termMonths) parts.push(`${draft.termMonths} Monate`);
  if (draft.mileagePerYear) {
    parts.push(`${draft.mileagePerYear.toLocaleString('de-DE')} km`);
  }
  if (draft.downPayment != null) {
    parts.push(`${draft.downPayment.toLocaleString('de-DE')} € Anzahlung`);
  }
  return parts.join(' · ');
}

/** Konditionen aus Kundenakte – nur für Footer-Anzeige (ohne Trim). */
export function buildConfiguratorConditionsLine(draft, paymentLabel = null) {
  if (!draft) return '';
  const mode = normalizePaymentType(draft.paymentType);
  if (mode === 'cash') return 'Kauf';

  const parts = [];
  const label = (paymentLabel ?? PAYMENT_TYPE_LABELS[draft.paymentType] ?? '')
    .replace(' / Barzahlung', '')
    .replace('Kauf / Barzahlung', 'Kauf');
  if (label) parts.push(label);
  if (draft.termMonths) parts.push(`${draft.termMonths} Monate`);
  if (draft.mileagePerYear) {
    parts.push(`${draft.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  }
  if (draft.downPayment != null && mode !== 'cash') {
    parts.push(`${draft.downPayment.toLocaleString('de-DE')} € Anzahlung`);
  }
  return parts.join(' · ');
}

export function formatConfiguratorUvpAmount(draft) {
  const uvp = computeUvpPricing(draft);
  if (uvp?.uvpConfigurationPrice == null) return '–';
  return `${Math.round(uvp.uvpConfigurationPrice).toLocaleString('de-DE')} € UPE`;
}

export function formatEuroAmount(amount) {
  if (amount == null) return '–';
  return `${Math.round(amount).toLocaleString('de-DE')} €`;
}

export function formatCashOfferDiscountLine(cashOffer) {
  if (!cashOffer?.discountPercent) return null;
  const label = cashOffer.discountLabel?.trim();
  const prefix = label ? `${label} (${cashOffer.discountPercent} %)` : `${cashOffer.discountPercent} % Rabatt`;
  return `${prefix}: − ${formatEuroAmount(cashOffer.discountAmount)}`;
}

export function applyCashPaymentDefaults(draft, conditions) {
  if (!draft?.modelKey) return draft;
  const defaults = resolveDealerPaymentDefaults(
    conditions,
    draft.modelKey,
    'cash',
    draft.trimId,
  );
  return {
    ...draft,
    paymentType: 'cash',
    mileagePerYear: null,
    termMonths: null,
    preparationFee: draft.preparationFee ?? defaults.preparationFee,
    customerGroup: draft.customerGroup ?? defaults.customerGroup ?? 'standard',
  };
}

/**
 * Monatsrate, wenn dieses Paket in der aktuellen Konfiguration enthalten ist.
 */
export function computePackageMonthlyRate(draft, packageId, conditions = null) {
  if (!draft?.modelKey || !packageId) return null;
  if (normalizePaymentType(draft.paymentType) === 'cash') return null;

  const ids = new Set(draft.packageIds ?? []);
  if (!ids.has(packageId)) ids.add(packageId);

  const nextDraft = {
    ...draft,
    packageIds: sanitizePackageIdsForTrim(draft.modelKey, draft.trimId, [...ids]),
  };
  const live = computeLiveRateForDraft(nextDraft, conditions);
  return live?.amount ?? null;
}

/** Paketzeile: immer UPE-Aufpreis; bei Leasing/Finanzierung zusätzlich Rate. */
export function formatPackageDisplayLine(pkg, paymentType = 'leasing', monthlyRate = null) {
  if (pkg?.status === 'included') return 'Serie';

  const upePart = pkg?.priceGross > 0
    ? `+ ${Math.round(pkg.priceGross).toLocaleString('de-DE')} € UPE`
    : null;

  if (normalizePaymentType(paymentType) === 'cash') {
    return upePart ?? 'Serie';
  }

  if (monthlyRate != null) {
    const ratePart = `${Math.round(monthlyRate).toLocaleString('de-DE')} €/Monat`;
    return upePart ? `${upePart} · ${ratePart}` : ratePart;
  }

  return upePart ?? 'Serie';
}

function packageLabelsFromIds(catalog, packageIds = []) {
  return packageIds
    .map((id) => catalog.packages?.find((p) => p.id === id)?.name)
    .filter(Boolean);
}

export function draftToSelectionVariantFields(variant, draft, preview, catalog) {
  const packageIds = sanitizePackageIdsForTrim(
    draft.modelKey,
    draft.trimId,
    draft.packageIds ?? [],
  );
  const isCash = preview?.isCash;
  const display = resolveVariantDisplayAmounts(draft, preview, variant);
  const offerLabel = buildVariantOfferLabel(draft, preview);

  return {
    ...variant,
    trimId: draft.trimId,
    trimLabel: draft.trimLabel,
    engineId: draft.engineId,
    batteryLabel: draft.batteryLabel,
    colorId: draft.colorId,
    colorLabel: draft.colorLabel,
    packages: packageIds,
    packageIds,
    packageLabels: packageLabelsFromIds(catalog, packageIds),
    accessoryIds: draft.accessoryIds ?? [],
    extras: draft.extras ?? {},
    customerGroup: draft.customerGroup ?? 'standard',
    customDiscountPercent: draft.customDiscountPercent ?? null,
    discountLabel: draft.discountLabel ?? null,
    preparationFee: draft.preparationFee ?? null,
    displayPriceOverride: draft.displayPriceOverride ?? null,
    displayRateOverride: draft.displayRateOverride ?? null,
    payment: {
      ...(variant.payment ?? {}),
      paymentType: draft.paymentType,
      termMonths: draft.termMonths,
      mileagePerYear: draft.mileagePerYear,
      downPayment: draft.downPayment ?? 0,
      desiredRate: draft.desiredRate ?? null,
      desiredPrice: draft.desiredPrice ?? null,
      customerGroup: draft.customerGroup ?? 'standard',
      customDiscountPercent: draft.customDiscountPercent ?? null,
      preparationFee: draft.preparationFee ?? null,
    },
    conditionsLocked: true,
    calculatedRate: isCash ? null : display.amount,
    calculatedPrice: isCash ? display.amount : null,
    label: offerLabel ?? variant.label,
    updatedAt: new Date().toISOString(),
  };
}

export function updateSelectionGroupVariant(groups, groupId, variantId, patch) {
  return (groups ?? []).map((group) => {
    if (group.id !== groupId) return group;
    return {
      ...group,
      variants: (group.variants ?? []).map((variant) => (
        variant.id === variantId ? { ...variant, ...patch } : variant
      )),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function duplicateSelectionGroupVariant(group, sourceVariant, draft, preview, catalog) {
  const fields = draftToSelectionVariantFields(sourceVariant, draft, preview, catalog);
  const duplicate = {
    ...fields,
    id: nextVariantId(),
    label: buildVariantOfferLabel(draft, preview) ?? `${sourceVariant.trimLabel ?? 'Variante'} (Kopie)`,
    status: OFFER_VARIANT_STATUS.DRAFT,
    createdAt: new Date().toISOString(),
  };
  return {
    ...group,
    variants: [...(group.variants ?? []), duplicate],
    updatedAt: new Date().toISOString(),
  };
}

function configHaystack(draft, catalog) {
  if (!draft) return '';
  const pkgText = (catalog?.packages ?? [])
    .filter((p) => (draft.packageIds ?? []).includes(p.id))
    .flatMap((p) => [p.name, ...(p.highlights ?? [])])
    .join(' ');
  return [
    draft.trimLabel,
    draft.colorLabel,
    pkgText,
    ...(draft.accessoryIds ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function wishMatchStatus(label, draft, preview, catalog) {
  if (!draft) return 'open';
  const norm = String(label ?? '').toLowerCase();
  const haystack = configHaystack(draft, catalog);

  if (/budget|rate|€\/monat|pro monat/.test(norm)) {
    const budget = draft.desiredRate ?? null;
    if (budget == null || preview?.rate == null) return 'open';
    return preview.rate <= budget ? 'fulfilled' : 'missing';
  }
  if (/monat|laufzeit/.test(norm) && draft.termMonths) {
    const m = norm.match(/(\d+)\s*monat/);
    if (m && Number(m[1]) === draft.termMonths) return 'fulfilled';
    if (norm.includes(String(draft.termMonths))) return 'fulfilled';
  }
  if (/km|kilometer/.test(norm) && draft.mileagePerYear) {
    const km = draft.mileagePerYear;
    if (norm.includes(String(km)) || norm.includes(String(km / 1000))) return 'fulfilled';
  }
  if (/anzahlung/.test(norm) && draft.downPayment != null) {
    if (norm.includes(String(draft.downPayment))) return 'fulfilled';
  }

  const tokens = norm
    .replace(/[^a-zäöüß0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (!tokens.length) return 'open';

  const hits = tokens.filter((t) => haystack.includes(t));
  if (hits.length === tokens.length) return 'fulfilled';
  if (hits.length > 0) return 'partial';
  return 'missing';
}

const WISH_STATUS_META = {
  fulfilled: { icon: '✓', label: 'erfüllt' },
  partial: { icon: '⚠', label: 'teilweise' },
  missing: { icon: '✕', label: 'nicht enthalten' },
  open: { icon: '○', label: 'offen' },
};

/**
 * Wunsch-Abgleich für Kundenwünsche und Ausstattungswünsche.
 */
export function buildWishAlignmentRows({
  draft,
  wishConditionChips = [],
  equipmentWishes = [],
  wishEquipmentText = '',
  preview,
  catalog,
} = {}) {
  if (!draft) return [];
  const rows = [];

  for (const chip of wishConditionChips) {
    if (['Leasing', 'Finanzierung', 'Kauf'].includes(chip)) continue;
    const status = wishMatchStatus(chip, draft, preview, catalog);
    const meta = WISH_STATUS_META[status];
    rows.push({
      id: `chip-${chip}`,
      label: chip,
      status,
      statusIcon: meta.icon,
      statusLabel: meta.label,
    });
  }

  for (const wish of equipmentWishes ?? []) {
    const label = wish.featureLabel ?? wish.packageLabel ?? wish.customerText ?? 'Ausstattungswunsch';
    const status = wishMatchStatus(label, draft, preview, catalog);
    const meta = WISH_STATUS_META[status];
    rows.push({
      id: wish.id ?? `eq-${label}`,
      label,
      status,
      statusIcon: meta.icon,
      statusLabel: meta.label,
    });
  }

  if (wishEquipmentText?.trim()) {
    wishEquipmentText
      .split(/[,;·\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part, index) => {
        const status = wishMatchStatus(part, draft, preview, catalog);
        if (rows.some((r) => r.label.toLowerCase() === part.toLowerCase())) return;
        const meta = WISH_STATUS_META[status];
        rows.push({
          id: `free-${index}-${part}`,
          label: part,
          status,
          statusIcon: meta.icon,
          statusLabel: meta.label,
        });
      });
  }

  return rows;
}

export function buildPackageWishStatus(pkg, wishRows = []) {
  if (!pkg?.highlights?.length || !wishRows.length) return null;
  for (const row of wishRows) {
    if (row.status !== 'fulfilled' && row.status !== 'partial') continue;
    const hit = pkg.highlights.some((h) => (
      row.label.toLowerCase().includes(h.toLowerCase())
      || h.toLowerCase().includes(row.label.toLowerCase())
    ));
    if (hit) return row.status;
  }
  return null;
}

export function formatPackageMonthlyDelta(pkg, paymentType = 'leasing', monthlyRate = null) {
  return formatPackageDisplayLine(pkg, paymentType, monthlyRate);
}

export function buildVariantPackageCatalog(draft) {
  if (!draft?.modelKey || !draft.trimId) return { groups: [], packages: [] };
  return buildPackageCatalog(draft.modelKey, draft.trimId, draft.packageIds ?? []);
}
