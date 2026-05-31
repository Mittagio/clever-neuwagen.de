import { kiaSportage } from '../data/models/kia/sportage.js';
import {
  resolveEngineId,
  resolveTrimId,
  resolveColorId,
  resolvePackageId,
  getVariant,
  getVariantById,
  getPackageAvailability,
  getAccessoryAvailability,
} from '../data/models/kia/sportageAdapter.js';
import { resolveModelConditions } from '../data/dealerConditionsSchema.js';
import { dealerConditionsTrinkle } from '../data/kiaSportage.js';
import { resolveAvailability } from './inventoryService.js';
import { RATE_DISCLAIMER } from '../constants/legal.js';

const DEFAULT_VARIANT_ID = 'sportage-hybrid-2wd-vision';
const DEFAULT_COLOR_ID = 'carraraweiss';
const DEFAULT_TERM_MONTHS = 48;
const DEFAULT_MILEAGE = 10000;
const DEFAULT_CUSTOMER_GROUP = 'standard';
const DEFAULT_PAYMENT_TYPE = 'leasing';

function findCheapestColorForTrim(trimId) {
  const colors = kiaSportage.colors.filter(
    (c) => c.availableTrims.includes(trimId) || c.availableTrims.includes('all'),
  );
  if (!colors.length) return kiaSportage.colors[0];
  return colors.reduce((best, c) => (c.priceGross < best.priceGross ? c : best));
}

function resolveVariant(input) {
  if (input.variantId) {
    const byId = getVariantById(input.variantId);
    if (byId) return byId;
  }
  if (input.trimId && input.engineId) {
    const byCombo = getVariant(resolveTrimId(input.trimId), resolveEngineId(input.engineId));
    if (byCombo) return byCombo;
  }
  return (
    getVariantById(DEFAULT_VARIANT_ID)
    ?? kiaSportage.variants.find((v) => v.available)
    ?? null
  );
}

function resolveColor(colorId, trimId) {
  const id = resolveColorId(colorId);
  const color = kiaSportage.colors.find((c) => c.id === id);
  if (
    color
    && (color.availableTrims.includes(trimId) || color.availableTrims.includes('all'))
  ) {
    return color;
  }
  return findCheapestColorForTrim(trimId);
}

function resolvePackages(selectedIds, trimId, engineId) {
  const warnings = [];
  const selectedPackages = [];
  let packagesPrice = 0;

  for (const rawId of selectedIds ?? []) {
    const id = resolvePackageId(rawId);
    const pkg = kiaSportage.packages.find((p) => p.id === id);
    if (!pkg) continue;

    const allowedIds = selectedPackages.map((p) => p.id);
    const availability = getPackageAvailability(pkg, trimId, engineId, allowedIds);

    if (!availability.allowed) {
      warnings.push({
        type: 'package-unavailable',
        message: `${pkg.name}: ${availability.reason}`,
        packageId: id,
      });
      continue;
    }

    selectedPackages.push(pkg);
    packagesPrice += pkg.priceGross ?? 0;
  }

  return { selectedPackages, packagesPrice, warnings };
}

function resolveAccessories(selectedIds, trimId, engineId) {
  const warnings = [];
  const selectedAccessories = [];
  let accessoriesPrice = 0;

  for (const id of selectedIds ?? []) {
    const acc = kiaSportage.accessories.find((a) => a.id === id);
    if (!acc) continue;

    const availability = getAccessoryAvailability(acc, trimId, engineId);
    if (!availability.allowed) {
      warnings.push({
        type: 'accessory-unavailable',
        message: `${acc.name}: ${availability.reason}`,
        accessoryId: id,
      });
      continue;
    }

    selectedAccessories.push(acc);
    accessoriesPrice += acc.priceGross ?? 0;
  }

  return { selectedAccessories, accessoriesPrice, warnings };
}

function normalizeModelId(model) {
  if (!model) return 'sportage';
  const raw = String(model).toLowerCase().replace(/^kia\s+/, '').trim();
  if (raw === 'sportage') return 'sportage';
  if (raw === 'ev3') return 'ev3';
  if (raw === 'ev4') return 'ev4';
  if (raw === 'picanto') return 'picanto';
  return raw;
}

function resolveConditions(input, conditionsArg) {
  const raw = input.dealerConditions ?? conditionsArg ?? dealerConditionsTrinkle;
  const modelId = normalizeModelId(input.model ?? kiaSportage.model);
  return resolveModelConditions(raw, modelId);
}

function normalizeInput(input = {}, conditions = dealerConditionsTrinkle) {
  const variant = resolveVariant(input);
  const trimId = variant?.trimId ?? resolveTrimId(input.trimId) ?? 'vision';
  const engineId = variant?.engineId ?? resolveEngineId(input.engineId) ?? 'tgi-hybrid-2wd';
  const color = resolveColor(input.colorId, trimId);

  const customerGroup =
    input.customerGroup && conditions.discounts?.[input.customerGroup] != null
      ? input.customerGroup
      : DEFAULT_CUSTOMER_GROUP;

  const paymentType = ['leasing', 'finance', 'cash'].includes(input.paymentType)
    ? input.paymentType
    : DEFAULT_PAYMENT_TYPE;

  const termMonths = Number(input.termMonths) > 0 ? Number(input.termMonths) : DEFAULT_TERM_MONTHS;
  const mileagePerYear = Number(input.mileagePerYear) > 0
    ? Number(input.mileagePerYear)
    : DEFAULT_MILEAGE;
  const downPayment = Math.max(0, Number(input.downPayment) || 0);

  const packageIds = Array.isArray(input.selectedPackageIds)
    ? input.selectedPackageIds.map(resolvePackageId)
    : [];
  const accessoryIds = Array.isArray(input.selectedAccessoryIds)
    ? input.selectedAccessoryIds
    : [];

  return {
    model: input.model ?? kiaSportage.model,
    variantId: variant?.id ?? null,
    trimId,
    engineId,
    colorId: color.id,
    selectedPackageIds: packageIds,
    selectedAccessoryIds: accessoryIds,
    customerGroup,
    paymentType,
    termMonths,
    mileagePerYear,
    downPayment,
    customerGroupRequested: input.customerGroup,
    variant,
    color,
  };
}

function resolveDiscountPercent(customerGroup, conditions) {
  return conditions.discounts?.[customerGroup] ?? conditions.discounts?.standard ?? 0;
}

/**
 * Leasingfaktor – exakt, dann nächstliegende km-Stufe, dann nächstliegende Laufzeit.
 * @returns {{ factor: number|null, termMonths: number, mileagePerYear: number, exact: boolean }}
 */
function resolveLeasingFactor(termMonths, mileagePerYear, conditions) {
  const { leasingFactors } = conditions;
  if (!leasingFactors || typeof leasingFactors !== 'object') {
    return { factor: null, termMonths, mileagePerYear, exact: false };
  }

  const terms = Object.keys(leasingFactors).map(Number).sort((a, b) => a - b);
  if (!terms.length) {
    return { factor: null, termMonths, mileagePerYear, exact: false };
  }

  if (leasingFactors[termMonths]) {
    const kmSteps = Object.keys(leasingFactors[termMonths]).map(Number);
    if (leasingFactors[termMonths][mileagePerYear] != null) {
      return {
        factor: leasingFactors[termMonths][mileagePerYear],
        termMonths,
        mileagePerYear,
        exact: true,
      };
    }
    const nearestKm = kmSteps.reduce((best, km) =>
      Math.abs(km - mileagePerYear) < Math.abs(best - mileagePerYear) ? km : best,
    );
    return {
      factor: leasingFactors[termMonths][nearestKm],
      termMonths,
      mileagePerYear: nearestKm,
      exact: false,
    };
  }

  const nearestTerm = terms.reduce((best, t) =>
    Math.abs(t - termMonths) < Math.abs(best - termMonths) ? t : best,
  );
  const kmSteps = Object.keys(leasingFactors[nearestTerm] ?? {}).map(Number);
  if (!kmSteps.length) {
    return { factor: null, termMonths, mileagePerYear, exact: false };
  }
  const nearestKm = kmSteps.reduce((best, km) =>
    Math.abs(km - mileagePerYear) < Math.abs(best - mileagePerYear) ? km : best,
  );

  return {
    factor: leasingFactors[nearestTerm][nearestKm],
    termMonths: nearestTerm,
    mileagePerYear: nearestKm,
    exact: false,
  };
}

function calcLeasingRate(configurationPrice, leasingFactor, downPayment, termMonths) {
  if (leasingFactor == null) return null;
  const base = configurationPrice * (leasingFactor / 100);
  const downPaymentShare = downPayment / termMonths;
  return Math.max(0, Math.round(base - downPaymentShare));
}

function resolveFinalPaymentPercent(termMonths, conditions) {
  const rates = conditions.financeRates?.finalPaymentPercent;
  if (rates) {
    const key = String(termMonths);
    if (rates[key] != null) return rates[key];
    const keys = Object.keys(rates).map(Number).sort((a, b) => a - b);
    if (!keys.length) return null;
    const nearest = keys.reduce((best, t) =>
      Math.abs(t - termMonths) < Math.abs(best - termMonths) ? t : best,
    );
    return rates[String(nearest)] ?? null;
  }
  if (conditions.financing?.balloonPercent != null) {
    return conditions.financing.balloonPercent;
  }
  return 35;
}

function calcFinanceRate(housePrice, downPayment, termMonths, conditions) {
  const interestRate =
    conditions.financeRates?.interestRate
    ?? conditions.financing?.effectiveRate
    ?? null;

  const finalPaymentPercent = resolveFinalPaymentPercent(termMonths, conditions);

  if (interestRate == null) {
    return { financeRate: null, finalPayment: null, interestRate: null, finalPaymentPercent: null };
  }

  if (finalPaymentPercent == null) {
    return {
      financeRate: null,
      finalPayment: null,
      interestRate,
      finalPaymentPercent: null,
    };
  }

  const finalPayment = Math.round(housePrice * (finalPaymentPercent / 100));
  const financedAmount = Math.max(0, housePrice - downPayment - finalPayment);
  const monthlyPrincipal = financedAmount / termMonths;
  const monthlyInterest = (housePrice * interestRate) / 100 / 12;
  const financeRate = Math.max(0, Math.round(monthlyPrincipal + monthlyInterest));

  return { financeRate, finalPayment, interestRate, finalPaymentPercent };
}

/**
 * Berechnet alle Preisbestandteile aus dem zentralen Sportage-Datenmodell.
 *
 * @param {Object} input
 * @param {string} [input.model]
 * @param {string} [input.variantId]
 * @param {string} [input.trimId] – Legacy / Fallback
 * @param {string} [input.engineId] – Legacy / Fallback
 * @param {string} [input.colorId]
 * @param {string[]} [input.selectedPackageIds]
 * @param {string[]} [input.selectedAccessoryIds]
 * @param {string} [input.customerGroup]
 * @param {'leasing'|'finance'|'cash'} [input.paymentType]
 * @param {number} [input.termMonths]
 * @param {number} [input.mileagePerYear]
 * @param {number} [input.downPayment]
 * @param {Object} [input.dealerConditions]
 * @param {Object} [conditionsArg] – Händlerkonditionen (2. Parameter, Abwärtskompatibilität)
 */
export function calculatePrice(input = {}, conditionsArg) {
  const conditions = resolveConditions(input, conditionsArg);
  const config = normalizeInput(input, conditions);
  const warnings = [];

  const selectedVariant = config.variant ?? getVariant(config.trimId, config.engineId);
  const variantPrice = selectedVariant?.priceGross ?? 0;
  const selectedColor = config.color;

  const {
    selectedPackages,
    packagesPrice,
    warnings: packageWarnings,
  } = resolvePackages(config.selectedPackageIds, config.trimId, config.engineId);
  warnings.push(...packageWarnings);

  const {
    selectedAccessories,
    accessoriesPrice,
    warnings: accessoryWarnings,
  } = resolveAccessories(config.selectedAccessoryIds, config.trimId, config.engineId);
  warnings.push(...accessoryWarnings);

  const configurationPrice = variantPrice + selectedColor.priceGross + packagesPrice + accessoriesPrice;

  const discountPercent = resolveDiscountPercent(config.customerGroup, conditions);
  const discountAmount = Math.round(configurationPrice * (discountPercent / 100));
  const housePrice = configurationPrice - discountAmount;
  const preparationFee = conditions.preparationFee ?? 0;
  const cashPrice = housePrice + preparationFee;

  if (
    config.customerGroupRequested
    && config.customerGroupRequested !== config.customerGroup
  ) {
    warnings.push({
      type: 'customer-group-fallback',
      message: 'Kundengruppe ohne Sonderrabatt – Standardrabatt angewendet',
    });
  }

  const leasingMeta = resolveLeasingFactor(
    config.termMonths,
    config.mileagePerYear,
    conditions,
  );

  let leasingRate = calcLeasingRate(
    configurationPrice,
    leasingMeta.factor,
    config.downPayment,
    leasingMeta.termMonths,
  );

  if (leasingMeta.factor == null) {
    leasingRate = null;
    warnings.push({
      type: 'leasing-factor-missing',
      message: 'Für diese Kombination ist ein individuelles Angebot erforderlich.',
    });
  } else if (!leasingMeta.exact) {
    warnings.push({
      type: 'leasing-factor-fallback',
      message: `Leasingfaktor für ${leasingMeta.termMonths} Monate / ${leasingMeta.mileagePerYear.toLocaleString('de-DE')} km/Jahr verwendet`,
    });
  }

  const finance = calcFinanceRate(
    housePrice,
    config.downPayment,
    config.termMonths,
    conditions,
  );

  if (config.paymentType === 'finance' && finance.finalPaymentPercent == null) {
    warnings.push({
      type: 'finance-balloon-missing',
      message: 'Finanzierungsschlussrate für diese Laufzeit nicht gepflegt',
    });
  }

  const deliveryTimeDefault =
    selectedVariant?.deliveryTypeDefault === 'lager'
      ? 'Sofort verfügbar'
      : conditions.deliveryTime ?? '4–6 Wochen';

  const availability = resolveAvailability(
    {
      trimId: config.trimId,
      engineId: config.engineId,
      colorId: config.colorId,
    },
    conditions.inventory ?? [],
    deliveryTimeDefault,
  );

  const deliveryTime = availability.deliveryTime ?? deliveryTimeDefault;

  if (availability.type === 'konfigurierbar' || selectedVariant?.deliveryTypeDefault === 'konfigurierbar') {
    warnings.push({
      type: 'availability-confirm',
      message: 'Verfügbarkeit muss vom Händler bestätigt werden',
    });
  }

  let primaryRate;
  let displayPaymentType = config.paymentType;

  if (config.paymentType === 'cash') {
    primaryRate = cashPrice;
  } else if (config.paymentType === 'finance') {
    primaryRate = finance.financeRate ?? cashPrice;
    if (finance.financeRate == null) displayPaymentType = 'cash';
  } else {
    primaryRate = leasingRate ?? cashPrice;
    if (leasingRate == null) displayPaymentType = 'cash';
  }

  return {
    configurationPrice,
    discountPercent,
    discountAmount,
    housePrice,
    hauspreis: housePrice,
    preparationFee,
    cashPrice,
    leasingRate,
    financeRate: finance.financeRate,
    finalPayment: finance.finalPayment,
    deliveryTime,
    warnings,
    selectedVariant,
    selectedColor,
    selectedPackages,
    selectedAccessories,

    paymentType: config.paymentType,
    displayPaymentType,
    primaryRate,
    financeDisclaimer: RATE_DISCLAIMER,
    availability,

    breakdown: {
      variantPrice,
      colorPrice: selectedColor.priceGross,
      packagesPrice,
      accessoriesPrice,
      packages: selectedPackages.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.priceGross,
      })),
      accessories: selectedAccessories.map((a) => ({
        id: a.id,
        name: a.name,
        price: a.priceGross,
      })),
    },

    leasing: {
      factor: leasingMeta.factor,
      termMonths: leasingMeta.termMonths,
      mileagePerYear: leasingMeta.mileagePerYear,
      downPayment: config.downPayment,
      exact: leasingMeta.exact,
      available: leasingMeta.factor != null,
    },

    finance: {
      interestRate: finance.interestRate,
      finalPaymentPercent: finance.finalPaymentPercent,
      finalPayment: finance.finalPayment,
      available: finance.financeRate != null,
    },

    meta: {
      model: config.model,
      variantId: selectedVariant?.id ?? config.variantId,
      engineId: config.engineId,
      trimId: config.trimId,
      colorId: config.colorId,
      customerGroup: config.customerGroup,
    },
  };
}

/**
 * Günstigste Leasingrate über alle verfügbaren Varianten (Landingpage / Händlerkarte).
 */
export function getLowestSportageLeasingRate(conditions = dealerConditionsTrinkle, options = {}) {
  const {
    customerGroup = 'standard',
    termMonths = DEFAULT_TERM_MONTHS,
    mileagePerYear = DEFAULT_MILEAGE,
    downPayment = 0,
    colorId = DEFAULT_COLOR_ID,
  } = options;

  let min = Infinity;

  for (const variant of kiaSportage.variants.filter((v) => v.available)) {
    const result = calculatePrice(
      {
        model: kiaSportage.model,
        variantId: variant.id,
        colorId,
        selectedPackageIds: [],
        selectedAccessoryIds: [],
        customerGroup,
        paymentType: 'leasing',
        termMonths,
        mileagePerYear,
        downPayment,
        dealerConditions: conditions,
      },
      conditions,
    );

    if (result.leasingRate != null) {
      min = Math.min(min, result.leasingRate);
    }
  }

  return min === Infinity ? null : min;
}

export default calculatePrice;
