/**
 * Verkaufsassistent – Fahrzeug konfigurieren (nach eindeutiger KI-Erkennung)
 */
import { resolveConfigureModel } from './configuration/configureModelBridge.js';
import { getModelColorCatalog } from '../data/manufacturer/configureModelColorCatalog.js';
import {
  DEALER_AI_MILEAGE_OPTIONS,
  DEALER_AI_TERM_OPTIONS,
  PAYMENT_TYPE_LABELS,
  formatBudgetDisplay,
  formatDeliveryDisplay,
  parseAllDownPaymentsFromText,
  parseAllMileagesFromText,
} from './dealerAiParser.js';
import { priceConfiguration } from './pricing/pricingEngine.js';
import { adjustRateForDownPayment } from '../logic/vehicleDetailConfig.js';
import { computeDetailPricing } from '../logic/vehicleDetailPricing.js';
import { buildVehicleConfiguration } from './configuration/vehicleConfigurationModel.js';
import { buildOfferConditionsFromDraft } from './configuration/offerConditionsModel.js';
import { buildOfferPreviewResult } from './configuration/offerPreviewBuilder.js';
import { computeUvpPricing } from './configuration/uvpPricing.js';
import { getKiaModelMediaEntry, resolveKiaColorImageUrl } from '../data/kia/kiaModelImages.js';

const DEFAULT_EV_COLORS = [
  { id: 'snow-white', label: 'Snow White Pearl' },
  { id: 'aurora-black', label: 'Aurora Black Pearl' },
  { id: 'wolf-gray', label: 'Wolf Gray' },
  { id: 'ocean-blue', label: 'Ocean Blue' },
  { id: 'runway-red', label: 'Runway Red' },
];

const COLOR_LABEL_ALIASES = {
  Weiß: 'Snow White Pearl',
  Schwarz: 'Aurora Black Pearl',
  Grau: 'Wolf Gray',
  Blau: 'Ocean Blue',
  Rot: 'Runway Red',
  Grün: 'Runway Red',
};

function normalizePaymentMode(paymentType) {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'finance';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

function resolveTrimId(trimLabel, mfg, trimOptions = []) {
  const trims = mfg?.data?.trims?.length
    ? mfg.data.trims
    : trimOptions.map((t) => ({ id: t.id, name: t.label ?? t.name }));
  if (!trims.length) return mfg?.defaultTrimId ?? null;
  if (!trimLabel) return mfg?.defaultTrimId ?? trims[0]?.id ?? null;
  const lower = trimLabel.toLowerCase();
  const hit = trims.find(
    (t) => t.id === lower || String(t.name).toLowerCase() === lower,
  );
  return hit?.id ?? mfg?.defaultTrimId ?? trims[0]?.id ?? null;
}

function resolveEngineId(fields, mfg) {
  if (fields.engineId) return fields.engineId;
  if (!mfg?.data?.engines?.length) return mfg?.defaultEngineId ?? null;
  if (fields.batteryKwh >= 75) {
    return mfg.data.engines.find((e) => e.id === 'ev-long')?.id ?? 'ev-long';
  }
  if (fields.batteryKwh && fields.batteryKwh <= 60) {
    return mfg.data.engines.find((e) => e.id === 'ev-std')?.id ?? 'ev-std';
  }
  return mfg.defaultEngineId ?? mfg.data.engines[0]?.id ?? null;
}

function resolveEngineLabel(engineId, mfg) {
  const engine = mfg?.data?.engines?.find((e) => e.id === engineId);
  if (engine?.name) return engine.name;
  if (engineId === 'ev-long') return '81 kWh';
  if (engineId === 'ev-std') return '58 kWh';
  return null;
}

function resolveColorId(colorLabel, colorIdHint, colors = DEFAULT_EV_COLORS) {
  if (colorIdHint && colors.some((c) => c.id === colorIdHint)) return colorIdHint;
  if (!colorLabel) return colors[0]?.id ?? DEFAULT_EV_COLORS[0].id;

  const normalized = String(colorLabel).toLowerCase();
  const aliasMap = {
    schwarz: ['zilinaschwarz', 'aurora-black'],
    weiß: ['carraraweiss', 'snow-white', 'deluxeweiß'],
    weiss: ['carraraweiss', 'snow-white', 'deluxeweiß'],
    grau: ['wolfgrau', 'wolf-gray'],
    blau: ['frostblau', 'ocean-blue'],
    rot: ['magma-red', 'runway-red'],
  };
  for (const [alias, ids] of Object.entries(aliasMap)) {
    if (normalized.includes(alias)) {
      const hit = colors.find((c) => ids.includes(c.id));
      if (hit) return hit.id;
    }
  }

  const mapped = COLOR_LABEL_ALIASES[colorLabel] ?? colorLabel;
  const hit = colors.find((c) => c.label === mapped || c.label.toLowerCase().includes(normalized));
  return hit?.id ?? colors[0]?.id ?? DEFAULT_EV_COLORS[0].id;
}

function resolveColorLabel(colorId, colorLabel, colors = DEFAULT_EV_COLORS) {
  const hit = colors.find((c) => c.id === colorId);
  if (hit?.label) return hit.label;
  if (colorLabel && COLOR_LABEL_ALIASES[colorLabel]) {
    return COLOR_LABEL_ALIASES[colorLabel];
  }
  return colorLabel ?? colors[0]?.label ?? DEFAULT_EV_COLORS[0].label;
}

function getModelColors(mfg) {
  const modelKey = mfg?.key ?? mfg?.data?.modelKey;
  const source = mfg?.data?.colors?.length
    ? mfg.data.colors
    : (getModelColorCatalog(modelKey) ?? DEFAULT_EV_COLORS);
  return source.map((c) => ({
    id: c.id,
    label: c.label ?? c.name,
    priceGross: c.priceGross ?? 0,
    hexPreview: c.hexPreview ?? null,
  }));
}

function inferEngineFuelGroup(engine) {
  if (engine.fuelType) return engine.fuelType;
  const name = String(engine.name ?? engine.label ?? '').toLowerCase();
  if (/plug.?in|phev/i.test(name)) return 'Plug-in Hybrid';
  if (/hybrid/i.test(name)) return 'Hybrid';
  if (/diesel|crdi/i.test(name)) return 'Diesel';
  if (/kwh|elektro|\bev\b/i.test(name)) return 'Elektro';
  return 'Standard';
}

function formatEngineShortLabel(engine) {
  const name = engine.name ?? engine.label ?? '';
  if (name.includes('kWh')) {
    return name.match(/\d+(?:[,.]\d+)?\s*kWh/i)?.[0]?.replace(',', '.') ?? name;
  }
  return name;
}

function resolveModelPackageIds(modelKey, packageIds = [], rawText = '') {
  const mfg = resolveConfigureModel(modelKey);
  const packages = mfg?.data?.packages ?? [];
  if (!packages.length) return packageIds.filter(Boolean);
  const resolved = new Set();

  for (const pkgId of packageIds) {
    if (packages.some((p) => p.id === pkgId)) {
      resolved.add(pkgId);
      continue;
    }
    if (pkgId === 'winter-connect') {
      const hit = packages.find((p) => /winter.?connect/i.test(p.name));
      if (hit) resolved.add(hit.id);
    }
  }

  if (/winter[\s-]?connect/i.test(rawText ?? '')) {
    const hit = packages.find((p) => /winter.?connect/i.test(p.name));
    if (hit) resolved.add(hit.id);
  }

  return [...resolved];
}

function detectExtrasFromText(rawText = '', fields = {}) {
  const mailExtras = fields.extrasFromMail ?? {};
  const lower = rawText.toLowerCase();
  return {
    ahk: mailExtras.ahk ?? /\bahk\b|anhänger|anhaenger|anhängerkupplung/.test(lower),
    wartung: mailExtras.wartung ?? /\bwartung|service\s*paket|wartungsvertrag\b/.test(lower),
    versicherung: mailExtras.versicherung ?? /\bversicherung|vollkasko\b/.test(lower),
    winterraeder: mailExtras.winterraeder ?? /\bwinterreifen|winterräder|winterraeder\b/.test(lower),
    freeText: mailExtras.freeText ?? fields.specialEquipment?.join(', ') ?? '',
  };
}

function vehicleImagePath(modelKey) {
  if (!modelKey) return null;
  const media = getKiaModelMediaEntry(modelKey, 'hero');
  return media?.hero ?? media?.default ?? `/images/manufacturers/kia/${modelKey}/default.svg`;
}

/** Hero-Bild für Konfigurator – reagiert auf Modell, Linie und Farbe */
export function resolveConfigureHeroImage(draft) {
  if (!draft?.modelKey) return null;
  if (draft.colorId) {
    const colorUrl = resolveKiaColorImageUrl(draft.modelKey, draft.colorId);
    if (colorUrl) return colorUrl;
  }
  const media = getKiaModelMediaEntry(draft.modelKey, 'hero');
  return media?.hero ?? media?.default ?? vehicleImagePath(draft.modelKey);
}

/**
 * Modell im Parser-Kontext erkannt (modelKey vorhanden) → direkt konfigurieren.
 */
export function hasRecognizedModelKey(parsed) {
  const fields = parsed?.fields;
  return Boolean(parsed?.ok && fields?.modelId && fields?.model);
}

/**
 * Modell eindeutig im Text erkannt → Fahrzeugsuche überspringen.
 */
export function isVehicleUniquelyRecognized(parsed) {
  const fields = parsed?.fields;
  if (!fields?.modelId || !fields?.model) return false;
  if (!parsed?.ok) return false;

  const suggestions = parsed.suggestedModels ?? [];
  if (!suggestions.length) return true;

  const distinctKeys = [...new Set(
    suggestions.slice(0, 4).map((m) => m.modelKey ?? m.id).filter(Boolean),
  )];
  if (distinctKeys.length > 1 && !distinctKeys.includes(fields.modelId)) {
    return false;
  }

  return true;
}

export function resolvePrimarySuggestedModel(parsed) {
  const fields = parsed?.fields;
  const suggestions = parsed?.suggestedModels ?? [];
  if (!suggestions.length) return null;

  const match = suggestions.find(
    (m) => (m.modelKey ?? m.id) === fields?.modelId,
  );
  return match ?? suggestions[0] ?? null;
}

export function buildConfigureOptions(modelKey, trimId = null) {
  const mfg = resolveConfigureModel(modelKey);
  if (!mfg) {
    return {
      trims: [],
      engines: [],
      colors: DEFAULT_EV_COLORS,
      packages: [],
      accessories: [],
    };
  }

  const engines = (mfg.data.engines ?? []).map((e) => ({
    id: e.id,
    label: formatEngineShortLabel(e),
    fullName: e.name ?? formatEngineShortLabel(e),
    fuelType: inferEngineFuelGroup(e),
    transmission: e.transmission ?? null,
    drive: e.drive ?? null,
    batteryKwh: e.batteryKwh ?? null,
  }));

  const packages = (mfg.data.packages ?? [])
    .filter((pkg) => !trimId || !pkg.availableTrims?.length || pkg.availableTrims.includes(trimId))
    .map((pkg) => ({ id: pkg.id, label: pkg.name }));

  const accessories = (mfg.data.accessories ?? [])
    .filter((acc) => !trimId || !acc.availableTrims?.length || acc.availableTrims.includes(trimId))
    .map((acc) => ({ id: acc.id, label: acc.name }));

  return {
    trims: (mfg.data.trims ?? []).map((t) => ({ id: t.id, label: t.name })),
    engines: engines.length
      ? engines
      : [{ id: mfg.defaultEngineId, label: 'Standard' }].filter((e) => e.id),
    colors: getModelColors(mfg),
    packages,
    accessories,
  };
}

export function buildConfigureDraft(parsed, conditions = null, primaryModel = null) {
  const fields = parsed?.fields ?? {};
  const modelKey = fields.modelId ?? primaryModel?.modelKey ?? primaryModel?.id;
  const mfg = resolveConfigureModel(modelKey);
  const options = buildConfigureOptions(modelKey, null);
  const modelColors = options.colors;

  const trimId = resolveTrimId(fields.trimLabel, mfg, options.trims)
    ?? (fields.trimId && options.trims.some((t) => t.id === fields.trimId) ? fields.trimId : null)
    ?? primaryModel?.primaryMatch?.vehicle?.trimId
    ?? options.trims[0]?.id
    ?? null;
  const trimLabel = fields.trimLabel
    ?? options.trims.find((t) => t.id === trimId)?.label
    ?? primaryModel?.primaryMatch?.vehicle?.trim
    ?? null;

  const engineId = resolveEngineId(fields, mfg);
  const batteryLabel = fields.batteryLabel ?? resolveEngineLabel(engineId, mfg);

  const colorId = resolveColorId(fields.colorLabel, fields.colorId, modelColors);
  const colorLabel = resolveColorLabel(colorId, fields.colorLabel, modelColors);

  const packageIds = resolveModelPackageIds(
    modelKey,
    fields.packageIds ?? [],
    fields.rawText,
  );

  const accessoryIds = [];
  const extras = detectExtrasFromText(fields.rawText, fields);
  if (extras.ahk && mfg?.data?.accessories?.length) {
    const ahk = mfg.data.accessories.find((a) => /anhänger|anhaenger/i.test(a.name));
    if (ahk) accessoryIds.push(ahk.id);
  }

  const preparationFee = conditions?.preparationFee ?? 1290;
  const customerName = fields.customerName
    ?? [fields.customerFirstName, fields.customerLastName].filter(Boolean).join(' ')
    ?? null;

  return {
    modelKey,
    brand: fields.brand ?? 'Kia',
    model: fields.model ?? mfg?.model ?? '',
    trimId,
    trimLabel,
    engineId,
    batteryLabel,
    motorLabel: fields.motorLabel ?? null,
    colorId,
    colorLabel,
    paymentType: fields.paymentType ?? 'leasing',
    termMonths: fields.termMonths ?? 48,
    mileagePerYear: fields.mileagePerYear ?? 15000,
    downPayment: fields.downPayment ?? 0,
    customerGroup: fields.customerGroup ?? 'standard',
    customDiscountPercent: fields.customDiscountPercent ?? null,
    desiredRate: fields.desiredRate ?? null,
    desiredPrice: fields.desiredPrice ?? null,
    desiredDeliveryDate: fields.desiredDeliveryDate ?? null,
    leasingEndDate: fields.leasingEndDate ?? null,
    vehicleChangeIntent: fields.vehicleChangeIntent ?? false,
    immediateAvailability: fields.immediateAvailability ?? false,
    specialEquipment: fields.specialEquipment ?? [],
    customer: {
      salutation: fields.customerSalutation ?? null,
      firstName: fields.customerFirstName ?? null,
      lastName: fields.customerLastName ?? null,
      name: customerName,
      phone: fields.customerPhone ?? null,
      email: fields.customerEmail ?? null,
      mailNote: fields.customerMailNote ?? null,
      interestedPartyName: fields.interestedPartyName ?? null,
    },
    preparationFee,
    accessoryIds,
    packageIds,
    extras,
    imageUrl: vehicleImagePath(modelKey),
    options: buildConfigureOptions(modelKey, trimId),
    primaryModelId: primaryModel?.id ?? modelKey,
  };
}

function variantSignature(v) {
  return `${v.termMonths}|${v.mileagePerYear}|${v.downPayment}`;
}

export function extractOfferVariants(rawText, baseFields = {}, draft = null) {
  const termMonths = draft?.termMonths ?? baseFields.termMonths ?? 48;
  const defaultMileage = draft?.mileagePerYear ?? baseFields.mileagePerYear ?? 15000;
  const defaultDown = draft?.downPayment ?? baseFields.downPayment ?? 0;

  const downPayments = parseAllDownPaymentsFromText(rawText);
  const mileages = parseAllMileagesFromText(rawText);

  const variants = [];
  const pushVariant = (partial, index) => {
    const next = {
      id: `variant-${index + 1}`,
      label: `Variante ${index + 1}`,
      termMonths,
      mileagePerYear: partial.mileagePerYear ?? defaultMileage,
      downPayment: partial.downPayment ?? 0,
    };
    const sig = variantSignature(next);
    if (!variants.some((v) => variantSignature(v) === sig)) {
      variants.push(next);
    }
  };

  pushVariant({ mileagePerYear: defaultMileage, downPayment: defaultDown }, 0);

  if (downPayments.length > 1 || mileages.length > 1) {
    for (const down of downPayments) {
      if (down !== defaultDown) {
        pushVariant({ mileagePerYear: defaultMileage, downPayment: down }, variants.length);
      }
    }
    for (const mileage of mileages) {
      if (mileage !== defaultMileage) {
        pushVariant({ mileagePerYear: mileage, downPayment: defaultDown }, variants.length);
      }
    }
  }

  return variants.map((v, index) => ({
    ...v,
    id: `variant-${index + 1}`,
    label: `Variante ${index + 1}`,
  }));
}

export function computeVariantMonthlyRate(draft, variant, conditions) {
  if (!draft?.modelKey) return null;

  const paymentMode = normalizePaymentMode(draft.paymentType);
  const pricing = priceConfiguration({
    brand: draft.brand,
    model: draft.model,
    modelKey: draft.modelKey,
    trimId: draft.trimId,
    engineId: draft.engineId,
    packageIds: draft.packageIds ?? [],
    accessoryIds: draft.accessoryIds ?? [],
    dealerConditions: conditions,
    termMonths: variant.termMonths ?? draft.termMonths ?? 48,
    mileagePerYear: variant.mileagePerYear ?? draft.mileagePerYear ?? 15000,
    paymentType: paymentMode === 'finance' ? 'finance' : paymentMode === 'cash' ? 'cash' : 'leasing',
  });

  if (!pricing) return null;

  const baseRate = paymentMode === 'cash'
    ? pricing.cashPrice
    : paymentMode === 'finance'
      ? pricing.financeRate
      : pricing.leasingRate;

  if (paymentMode === 'cash') return baseRate;

  const down = variant.downPayment ?? draft.downPayment ?? 0;
  return adjustRateForDownPayment(
    baseRate,
    down,
    variant.termMonths ?? draft.termMonths ?? 48,
  );
}

export function enrichVariantsWithRates(variants, draft, conditions) {
  return variants.map((variant) => ({
    ...variant,
    monthlyRate: computeVariantMonthlyRate(draft, variant, conditions),
  }));
}

const SENSIBLE_ALT_DOWN_PAYMENT = 3000;

function pickNextMileageOption(currentMileage) {
  const current = currentMileage ?? 15000;
  const next = DEALER_AI_MILEAGE_OPTIONS.find((m) => m > current);
  return next ?? null;
}

function pickSensibleTermAlternative(currentTerm) {
  if (currentTerm === 48) return 36;
  if (currentTerm === 60) return 48;
  if (currentTerm === 36) return 48;
  if (currentTerm === 42) return 36;
  if (currentTerm === 24) return 36;
  return null;
}

export function buildBudgetComparison(monthlyRate, budgetLimit, paymentType = 'leasing') {
  if (paymentType === 'cash' || budgetLimit == null || monthlyRate == null) {
    return { status: 'open', label: 'Budget offen', delta: null, icon: null };
  }
  if (monthlyRate <= budgetLimit) {
    return {
      status: 'ok',
      label: 'Budget erfüllt',
      delta: budgetLimit - monthlyRate,
      icon: '✓',
    };
  }
  const over = monthlyRate - budgetLimit;
  return {
    status: 'over',
    label: `Budget überschritten um ${over.toLocaleString('de-DE')} €`,
    delta: over,
    icon: '⚠',
  };
}

export function buildOfferPreview(draft, conditions, fields = {}) {
  const vehicleConfiguration = buildVehicleConfiguration(draft);
  if (!vehicleConfiguration) return { monthlyRate: null, budget: { status: 'open' } };

  const offerConditions = buildOfferConditionsFromDraft(draft, conditions);
  const preview = buildOfferPreviewResult(
    vehicleConfiguration,
    offerConditions,
    conditions,
    fields,
  );

  return {
    model: draft.model,
    trimLabel: draft.trimLabel,
    batteryLabel: draft.batteryLabel,
    vehicleTitle: preview.vehicleTitle,
    termMonths: offerConditions.termMonths,
    mileagePerYear: offerConditions.mileagePerYear,
    downPayment: offerConditions.downPayment,
    monthlyRate: preview.monthlyRate,
    budget: preview.budget,
    paymentType: offerConditions.paymentType,
    vehicleConfiguration: preview.vehicleConfiguration,
    offerConditions: preview.offerConditions,
    offerCalculation: preview.offerCalculation,
    uvpConfigurationPrice: preview.uvpConfigurationPrice,
    discountPercent: preview.discountPercent,
    discountAmount: preview.discountAmount,
    housePrice: preview.housePrice,
    livePricing: preview.offerCalculation
      ? { amount: preview.monthlyRate }
      : null,
  };
}

export function buildSensibleAlternatives(draft, conditions, fields = {}) {
  if (normalizePaymentMode(draft.paymentType) === 'cash') return [];

  const base = {
    termMonths: draft.termMonths ?? 48,
    mileagePerYear: draft.mileagePerYear ?? 15000,
    downPayment: draft.downPayment ?? 0,
  };
  const baseSig = variantSignature(base);
  const budgetLimit = draft.desiredRate ?? fields.desiredRate ?? null;
  const candidates = [];

  const nextMileage = pickNextMileageOption(base.mileagePerYear);
  if (nextMileage != null) {
    candidates.push({
      id: 'alt-mileage',
      headline: `${nextMileage.toLocaleString('de-DE')} km`,
      termMonths: base.termMonths,
      mileagePerYear: nextMileage,
      downPayment: base.downPayment,
      patch: { mileagePerYear: nextMileage },
    });
  }

  if (base.downPayment < SENSIBLE_ALT_DOWN_PAYMENT) {
    candidates.push({
      id: 'alt-down',
      headline: `${SENSIBLE_ALT_DOWN_PAYMENT.toLocaleString('de-DE')} € Anzahlung`,
      termMonths: base.termMonths,
      mileagePerYear: base.mileagePerYear,
      downPayment: SENSIBLE_ALT_DOWN_PAYMENT,
      patch: { downPayment: SENSIBLE_ALT_DOWN_PAYMENT },
    });
  }

  const altTerm = pickSensibleTermAlternative(base.termMonths);
  if (altTerm != null && DEALER_AI_TERM_OPTIONS.includes(altTerm)) {
    candidates.push({
      id: 'alt-term',
      headline: `${altTerm} Monate`,
      termMonths: altTerm,
      mileagePerYear: base.mileagePerYear,
      downPayment: base.downPayment,
      patch: { termMonths: altTerm },
    });
  }

  const unique = [];
  const seen = new Set([baseSig]);
  for (const candidate of candidates) {
    const sig = variantSignature(candidate);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(candidate);
  }

  return unique.slice(0, 3).map((candidate, index) => {
    const monthlyRate = computeVariantMonthlyRate(draft, candidate, conditions);
    return {
      ...candidate,
      label: `Alternative ${index + 1}`,
      monthlyRate,
      budget: buildBudgetComparison(monthlyRate, budgetLimit, draft.paymentType),
    };
  });
}

export function pickRecommendedVariantIndex(variants, fields = {}) {
  if (!variants.length) return 0;

  let bestIndex = 0;
  let bestScore = -1;

  variants.forEach((variant, index) => {
    let score = 0;
    if (fields.mileagePerYear && variant.mileagePerYear === fields.mileagePerYear) score += 3;
    if (fields.downPayment != null && variant.downPayment === (fields.downPayment ?? 0)) score += 3;
    if (fields.termMonths && variant.termMonths === fields.termMonths) score += 2;
    if (fields.desiredRate && variant.monthlyRate != null) {
      if (variant.monthlyRate <= fields.desiredRate) score += 4;
      else score -= 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function buildRecognizedWishLines(draft, fields = {}) {
  const merged = { ...fields, ...draft };
  const lines = [];

  const vehicle = [draft.model, draft.trimLabel, draft.batteryLabel].filter(Boolean).join(' ');
  if (vehicle) lines.push(vehicle);
  if (merged.motorLabel && !vehicle.includes(merged.motorLabel)) {
    lines.push(merged.motorLabel);
  }

  const pt = merged.paymentType ?? 'unknown';
  if (pt !== 'unknown') {
    lines.push(PAYMENT_TYPE_LABELS[pt]?.replace(' / Barzahlung', '') ?? pt);
  }
  if (merged.termMonths) lines.push(`${merged.termMonths} Monate`);
  if (merged.mileagePerYear) {
    lines.push(`${merged.mileagePerYear.toLocaleString('de-DE')} km`);
  }

  const budget = formatBudgetDisplay(merged);
  if (budget !== 'offen') lines.push(`Budget ${budget}`);

  if (merged.downPayment) {
    lines.push(`${merged.downPayment.toLocaleString('de-DE')} € Anzahlung`);
  }

  const delivery = formatDeliveryDisplay(merged);
  lines.push(
    delivery === 'offen' ? 'Wunschlieferdatum offen' : `Wunschlieferdatum ${delivery}`,
  );

  if (merged.leasingEndDate) lines.push(`Leasingende ${merged.leasingEndDate}`);
  if (merged.vehicleChangeIntent) lines.push('Fahrzeugwechsel');
  if (merged.immediateAvailability || merged.stockStatus === 'lager') {
    lines.push('Sofort verfügbar');
  }

  return lines;
}

/** Strukturierte Zusammenfassung: Wer? Was? Wann? Konditionen? */
export function buildRecognizedWishFramework(draft, fields = {}) {
  const merged = { ...fields, ...draft };
  const vehicle = [draft.model, draft.trimLabel, draft.batteryLabel, merged.motorLabel]
    .filter(Boolean)
    .join(' ');

  const pt = merged.paymentType ?? 'unknown';
  const paymentLabel = pt !== 'unknown'
    ? PAYMENT_TYPE_LABELS[pt]?.replace(' / Barzahlung', '')
    : null;

  const conditionParts = [
    paymentLabel,
    merged.termMonths ? `${merged.termMonths} Monate` : null,
    merged.mileagePerYear ? `${merged.mileagePerYear.toLocaleString('de-DE')} km` : null,
    formatBudgetDisplay(merged) !== 'offen' ? `Budget ${formatBudgetDisplay(merged)}` : null,
    merged.downPayment ? `${merged.downPayment.toLocaleString('de-DE')} € Anzahlung` : null,
  ].filter(Boolean);

  const timingParts = [
    formatDeliveryDisplay(merged) !== 'offen'
      ? `Wunschlieferdatum ${formatDeliveryDisplay(merged)}`
      : 'Wunschlieferdatum offen',
    merged.leasingEndDate ? `Leasingende ${merged.leasingEndDate}` : null,
    merged.vehicleChangeIntent ? 'Fahrzeugwechsel' : null,
    merged.immediateAvailability || merged.stockStatus === 'lager' ? 'Sofort verfügbar' : null,
  ].filter(Boolean);

  return {
    who: vehicle || 'Fahrzeug offen',
    what: vehicle || 'Fahrzeug offen',
    when: timingParts.join(' · ') || 'offen',
    conditions: conditionParts.join(' · ') || 'offen',
    timing: timingParts,
    conditionsList: conditionParts,
  };
}

export function buildRecommendationChecks(variant, fields = {}) {
  const checks = [];
  if (fields.desiredRate && variant.monthlyRate != null) {
    checks.push({
      ok: variant.monthlyRate <= fields.desiredRate,
      label: fields.desiredRate
        ? `Budget ${variant.monthlyRate <= fields.desiredRate ? 'erfüllt' : 'knapp'}`
        : 'Budget offen',
    });
  }
  if (fields.mileagePerYear) {
    checks.push({
      ok: variant.mileagePerYear === fields.mileagePerYear,
      label: `${variant.mileagePerYear.toLocaleString('de-DE')} km`,
    });
  }
  checks.push({
    ok: (variant.downPayment ?? 0) === (fields.downPayment ?? 0),
    label: variant.downPayment
      ? `${variant.downPayment.toLocaleString('de-DE')} € Anzahlung`
      : 'ohne Anzahlung',
  });
  return checks;
}

export function fieldsFromConfigureDraft(draft, fields = {}) {
  const trimFromOptions = draft.options?.trims?.find((t) => t.id === draft.trimId);
  const engineFromOptions = draft.options?.engines?.find((e) => e.id === draft.engineId);
  const customer = draft.customer ?? {};
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    || customer.name
    || fields.customerName;

  return {
    ...fields,
    brand: draft.brand ?? fields.brand,
    model: draft.model ?? fields.model,
    modelId: draft.modelKey ?? fields.modelId,
    trimId: draft.trimId ?? fields.trimId,
    trimLabel: draft.trimLabel ?? trimFromOptions?.label ?? fields.trimLabel,
    engineId: draft.engineId ?? fields.engineId,
    batteryLabel: draft.batteryLabel ?? engineFromOptions?.label ?? fields.batteryLabel,
    motorLabel: draft.motorLabel ?? fields.motorLabel,
    colorId: draft.colorId ?? fields.colorId,
    colorLabel: draft.colorLabel ?? fields.colorLabel,
    paymentType: draft.paymentType ?? fields.paymentType,
    termMonths: draft.termMonths ?? fields.termMonths,
    mileagePerYear: draft.mileagePerYear ?? fields.mileagePerYear,
    downPayment: draft.downPayment ?? fields.downPayment ?? 0,
    customerGroup: draft.customerGroup ?? fields.customerGroup ?? 'standard',
    customDiscountPercent: draft.customDiscountPercent ?? fields.customDiscountPercent ?? null,
    desiredRate: draft.desiredRate ?? fields.desiredRate,
    desiredPrice: draft.desiredPrice ?? fields.desiredPrice,
    desiredDeliveryDate: draft.desiredDeliveryDate ?? fields.desiredDeliveryDate,
    leasingEndDate: draft.leasingEndDate ?? fields.leasingEndDate,
    vehicleChangeIntent: draft.vehicleChangeIntent ?? fields.vehicleChangeIntent,
    immediateAvailability: draft.immediateAvailability ?? fields.immediateAvailability,
    customerName: fullName ?? fields.customerName,
    customerFirstName: customer.firstName ?? fields.customerFirstName,
    customerLastName: customer.lastName ?? fields.customerLastName,
    customerSalutation: customer.salutation ?? fields.customerSalutation,
    customerPhone: customer.phone ?? fields.customerPhone,
    customerEmail: customer.email ?? fields.customerEmail,
    customerMailNote: draft.customer?.mailNote ?? fields.customerMailNote,
    interestedPartyName: draft.customer?.interestedPartyName ?? fields.interestedPartyName,
    packageIds: draft.packageIds ?? fields.packageIds ?? [],
    specialEquipment: draft.specialEquipment ?? fields.specialEquipment ?? [],
  };
}

export function computeVehicleListPrice(draft, _conditions) {
  return computeUvpPricing(draft)?.uvpConfigurationPrice ?? null;
}

export function buildConfigureVehicleSummary(draft, _conditions) {
  const uvp = computeUvpPricing(draft);
  const vehicleTitle = [draft.model, draft.trimLabel, draft.batteryLabel || draft.motorLabel]
    .filter(Boolean)
    .join(' ');
  return {
    vehicleTitle,
    colorLabel: draft.colorLabel ?? null,
    listPrice: uvp?.uvpConfigurationPrice ?? null,
    uvpBasePrice: uvp?.uvpBasePrice ?? null,
    uvpConfigurationPrice: uvp?.uvpConfigurationPrice ?? null,
    uvpLineItems: uvp?.lineItems ?? [],
  };
}

export function computeLiveRateForDraft(draft, conditions) {
  const paymentMode = normalizePaymentMode(draft.paymentType);
  const pricing = priceConfiguration({
    brand: draft.brand,
    model: draft.model,
    modelKey: draft.modelKey,
    trimId: draft.trimId,
    engineId: draft.engineId,
    packageIds: draft.packageIds ?? [],
    accessoryIds: draft.accessoryIds ?? [],
    dealerConditions: conditions,
    termMonths: draft.termMonths ?? 48,
    mileagePerYear: draft.mileagePerYear ?? 15000,
    paymentType: paymentMode === 'finance' ? 'finance' : paymentMode === 'cash' ? 'cash' : 'leasing',
  });

  if (!pricing) return null;

  return computeDetailPricing({
    payment: paymentMode,
    termMonths: draft.termMonths ?? 48,
    mileagePerYear: draft.mileagePerYear ?? 15000,
    downPayment: draft.downPayment ?? 0,
    basePricing: pricing,
  });
}

/**
 * Parsed-Objekt direkt aus der Modell-Kachel (ohne Freitext-Parser).
 * Zuverlässig für kurze Modellnamen wie EV2, EV3, K4.
 */
export function buildParsedFromAssistantModel(model = {}) {
  const modelId = model.id ?? model.modelKey;
  const name = model.name ?? String(modelId ?? '').toUpperCase();
  if (!modelId || !name) {
    return { ok: false, error: 'Modell konnte nicht geladen werden.' };
  }

  return {
    ok: true,
    fields: {
      brand: 'Kia',
      model: name,
      modelId,
      rawText: `Kia ${name}`,
      paymentType: 'unknown',
      termMonths: 48,
      mileagePerYear: 15000,
      packageIds: [],
      packageLabels: [],
      quantity: 1,
    },
    action: 'create_offer',
    actionLabel: 'Angebot erstellen',
    actionDescription: '',
    displayFields: [],
    customerWishSummary: '',
    shortForm: '',
    suggestedModels: [{
      id: modelId,
      modelKey: modelId,
      name: `Kia ${name}`,
    }],
    confidence: 'high',
  };
}

export function buildSelectedModelFieldPatch(model = {}, fields = {}) {
  const safeModel = model ?? {};
  const vehicle = safeModel.primaryMatch?.vehicle;
  return {
    model: vehicle?.model
      ?? safeModel.name?.replace(/^Kia\s+/i, '')
      ?? fields.model,
    brand: vehicle?.brand ?? fields.brand ?? 'Kia',
    modelId: safeModel.modelKey ?? safeModel.id ?? fields.modelId,
    trimLabel: vehicle?.trim ?? safeModel.trimLabel ?? fields.trimLabel,
    trimId: vehicle?.trimId ?? fields.trimId,
  };
}

export function resolvePhaseAfterAnalysis(parsed) {
  return hasRecognizedModelKey(parsed) ? 'configure' : 'review';
}
