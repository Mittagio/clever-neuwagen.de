/**
 * Clever Auswahl – Varianten-Konfigurator (Angebotswelt, nicht Wunschformular).
 */
import { applyDealerDefaultsToDraft } from '../dealer/dealerOfferDefaults.js';
import {
  buildConfigureOptions,
  computeLiveRateForDraft,
} from '../dealerAiVehicleConfigureFlow.js';
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';
import {
  buildPackageCatalog,
  sanitizePackageIdsForTrim,
} from '../configuration/configurePackageCatalog.js';
import { PAYMENT_TYPE_LABELS } from '../dealerAiParser.js';
import { OFFER_VARIANT_STATUS } from './offerSelectionGroup.js';

export const VARIANT_TERM_OPTIONS = [24, 36, 48, 60];
export const VARIANT_MILEAGE_OPTIONS = [5000, 10000, 15000, 20000, 30000];
export const VARIANT_DOWN_OPTIONS = [0, 1000, 3000, 5000];

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
  const trim = options.trims?.find((t) => t.id === variant.trimId) ?? options.trims?.[0];

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
    downPayment: payment.downPayment ?? lead?.wish?.downPayment ?? 0,
    desiredRate: payment.desiredRate ?? wish.desiredRate ?? lead?.desiredRate ?? null,
    customerGroup: variant.customerGroup ?? 'standard',
    packageIds: variant.packageIds ?? variant.packages ?? [],
    accessoryIds: variant.accessoryIds ?? [],
    extras: variant.extras ?? {},
    options,
    customer: {
      name: lead?.contact?.name ?? null,
      phone: lead?.contact?.phone ?? null,
      email: lead?.contact?.email ?? null,
    },
  };

  return applyDealerDefaultsToDraft(draft, conditions);
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

export function computeVariantConfiguratorPreview(draft, conditions, baseDraft = null) {
  if (!draft) return { rate: null, baseRate: null, delta: null, paymentLabel: null };

  const live = computeLiveRateForDraft(draft, conditions);
  const rate = live?.amount ?? null;
  const paymentMode = normalizePaymentType(draft.paymentType);

  let baseRate = rate;
  if (baseDraft) {
    const baseLive = computeLiveRateForDraft(baseDraft, conditions);
    baseRate = baseLive?.amount ?? rate;
  }

  const delta = rate != null && baseRate != null ? Math.round(rate - baseRate) : null;
  const paymentLabel = PAYMENT_TYPE_LABELS[draft.paymentType]
    ?? PAYMENT_TYPE_LABELS.leasing;

  return {
    rate,
    baseRate,
    delta,
    paymentLabel,
    isCash: paymentMode === 'cash',
  };
}

export function formatConfiguratorRate(preview) {
  if (preview?.rate == null) return '–';
  if (preview.isCash) {
    return `${Math.round(preview.rate).toLocaleString('de-DE')} €`;
  }
  return `${Math.round(preview.rate).toLocaleString('de-DE')} €/Monat`;
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
    payment: {
      ...(variant.payment ?? {}),
      paymentType: draft.paymentType,
      termMonths: draft.termMonths,
      mileagePerYear: draft.mileagePerYear,
      downPayment: draft.downPayment ?? 0,
      desiredRate: draft.desiredRate ?? null,
    },
    calculatedRate: isCash ? null : preview?.rate ?? null,
    calculatedPrice: isCash ? preview?.rate ?? null : null,
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
    label: `${sourceVariant.label ?? 'Variante'} (Kopie)`,
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

export function formatPackageMonthlyDelta(pkg, paymentType = 'leasing') {
  if (paymentType === 'cash') {
    return pkg.priceGross ? `+ ${pkg.priceGross.toLocaleString('de-DE')} €` : 'Serie';
  }
  if (pkg.rateDelta) return `+ ${pkg.rateDelta.toLocaleString('de-DE')} €/Monat`;
  if (pkg.priceGross) return `+ ${pkg.priceGross.toLocaleString('de-DE')} €`;
  return 'Serie';
}

export function buildVariantPackageCatalog(draft) {
  if (!draft?.modelKey || !draft.trimId) return { groups: [], packages: [] };
  return buildPackageCatalog(draft.modelKey, draft.trimId, draft.packageIds ?? []);
}
