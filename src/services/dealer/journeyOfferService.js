/**
 * Phase 5 – Angebot aus Journey-Konfiguration (Sorento-Pilot).
 */
import sorentoVerbrenner from '../../data/kia/pricelist-imports/sorento.json' with { type: 'json' };
import sorentoHybrid from '../../data/kia/pricelist-imports/sorento-hybrid.json' with { type: 'json' };
import sorentoPhev from '../../data/kia/pricelist-imports/sorento-phev.json' with { type: 'json' };
import ev4Pricelist from '../../data/kia/pricelist-imports/ev4.json' with { type: 'json' };
import ev4FastbackPricelist from '../../data/kia/pricelist-imports/ev4-fastback.json' with { type: 'json' };
import { sorentoConfigurator } from '../../data/models/kia/sorentoConfigurator.js';
import { resolveModelConditions } from '../../data/dealerConditionsSchema.js';
import { shouldShowAllPaymentVariants } from './purchaseTypeOptions.js';

const PRICELISTS = {
  sorento: sorentoVerbrenner,
  'sorento-hybrid': sorentoHybrid,
  'sorento-phev': sorentoPhev,
  ev4: ev4Pricelist,
  'ev4-fastback': ev4FastbackPricelist,
};

const SORENTO_CATALOG_IDS = new Set(['sorento', 'sorento-hybrid', 'sorento-phev']);

const DEFAULT_LEASING_TERM = 48;
const DEFAULT_LEASING_KM = 15000;
const DEFAULT_FINANCE_TERM = 36;

const DISCOUNT_KEY_ALIASES = {
  beamter: 'oeffentlicherDienst',
  freiberufler: 'gewerbe',
};

/**
 * @param {string} modelKey
 * @param {string} trimId
 */
export function resolveTrimListPrice(modelKey, trimId) {
  const list = PRICELISTS[modelKey];
  const matches = list?.variants?.filter((v) => v.trimId === trimId) ?? [];
  if (!matches.length) return list?.priceFromGross ?? 0;

  const twoWd = matches.find((v) => v.drive === '2WD');
  const awd = matches.find((v) => v.drive === 'AWD');
  if (trimId === 'platinum') return (awd ?? matches[matches.length - 1]).priceGross;
  return (twoWd ?? matches[0]).priceGross;
}

/**
 * @param {object} configuration
 */
export function resolveConfigurationModelKey(configuration) {
  const catalogId = configuration?.catalogId ?? configuration?.modelKey;
  if (catalogId && !SORENTO_CATALOG_IDS.has(catalogId) && PRICELISTS[catalogId]) {
    return catalogId;
  }
  const pt = sorentoConfigurator.powertrains.find((p) => p.id === configuration?.powertrainId);
  return pt?.modelKey ?? sorentoConfigurator.modelKey;
}

function isJourneyOfferSupported(configuration) {
  if (!configuration) return false;
  const modelKey = configuration.modelKey ?? resolveConfigurationModelKey(configuration);
  if (SORENTO_CATALOG_IDS.has(configuration.catalogId) || String(modelKey).startsWith('sorento')) {
    return configuration.catalogId === 'sorento' || SORENTO_CATALOG_IDS.has(modelKey);
  }
  return Boolean(PRICELISTS[modelKey]);
}

function resolvePackagesPrice(packageIds = []) {
  return packageIds.reduce((sum, id) => {
    const pkg = sorentoConfigurator.packages.find((p) => p.id === id);
    return sum + (pkg?.priceGross ?? 0);
  }, 0);
}

function resolveColorSurcharge(colorId) {
  return sorentoConfigurator.colorSurcharges?.[colorId] ?? 0;
}

function resolveDiscountPercent(discountGroup, conditions) {
  const rawKey = DISCOUNT_KEY_ALIASES[discountGroup] ?? discountGroup;
  const pct = conditions.discounts?.[rawKey];
  if (pct != null) return Number(pct);
  return Number(conditions.discounts?.standard ?? 0);
}

function resolveLeasingFactor(termMonths, mileagePerYear, conditions) {
  const { leasingFactors } = conditions;
  if (!leasingFactors || typeof leasingFactors !== 'object') {
    return { factor: null, termMonths, mileagePerYear };
  }

  const terms = Object.keys(leasingFactors).map(Number).sort((a, b) => a - b);
  if (!terms.length) return { factor: null, termMonths, mileagePerYear };

  const term = leasingFactors[termMonths] ? termMonths : terms.reduce((best, t) => (
    Math.abs(t - termMonths) < Math.abs(best - termMonths) ? t : best
  ));
  const kmSteps = Object.keys(leasingFactors[term] ?? {}).map(Number);
  if (!kmSteps.length) return { factor: null, termMonths: term, mileagePerYear };

  const km = leasingFactors[term][mileagePerYear] != null
    ? mileagePerYear
    : kmSteps.reduce((best, k) => (
      Math.abs(k - mileagePerYear) < Math.abs(best - mileagePerYear) ? k : best
    ));

  return {
    factor: leasingFactors[term]?.[km] ?? null,
    termMonths: term,
    mileagePerYear: km,
  };
}

function calcLeasingRate(configurationPrice, leasingFactor, termMonths) {
  if (leasingFactor == null) return null;
  return Math.max(0, Math.round(configurationPrice * (leasingFactor / 100)));
}

function resolveFinalPaymentPercent(termMonths, conditions) {
  const rates = conditions.financeRates?.finalPaymentPercent;
  if (rates?.[String(termMonths)] != null) return rates[String(termMonths)];
  if (conditions.financing?.balloonPercent != null) return conditions.financing.balloonPercent;
  return 35;
}

function calcFinanceRate(housePrice, termMonths, conditions) {
  const interestRate = conditions.financeRates?.interestRate
    ?? conditions.financing?.effectiveRate
    ?? null;
  const finalPaymentPercent = resolveFinalPaymentPercent(termMonths, conditions);

  if (interestRate == null || finalPaymentPercent == null) {
    return { financeRate: null, finalPayment: null };
  }

  const finalPayment = Math.round(housePrice * (finalPaymentPercent / 100));
  const financedAmount = Math.max(0, housePrice - finalPayment);
  const monthlyPrincipal = financedAmount / termMonths;
  const monthlyInterest = (housePrice * interestRate) / 100 / 12;
  const financeRate = Math.max(0, Math.round(monthlyPrincipal + monthlyInterest));

  return { financeRate, finalPayment };
}

/**
 * @param {'cash'|'finance'|'leasing'} paymentType
 * @param {object} pricing
 */
function buildOfferCard(paymentType, pricing) {
  if (paymentType === 'cash') {
    return {
      id: 'cash',
      label: 'Kauf',
      headline: `${pricing.cashPrice.toLocaleString('de-DE')} €`,
      lines: [
        { label: 'Hauspreis inkl. Bereitstellung', value: `${pricing.cashPrice.toLocaleString('de-DE')} €` },
      ],
      disclaimer: 'Unverbindliches Beispielangebot inkl. Händlerrabatt.',
    };
  }

  if (paymentType === 'finance') {
    return {
      id: 'finance',
      label: 'Finanzierung',
      headline: pricing.financeRate != null
        ? `${pricing.financeRate.toLocaleString('de-DE')} €`
        : 'auf Anfrage',
      lines: [
        { label: 'Laufzeit', value: `${pricing.financeTermMonths} Monate` },
        ...(pricing.financeRate != null
          ? [{ label: 'Monatliche Rate', value: `${pricing.financeRate.toLocaleString('de-DE')} €` }]
          : []),
        ...(pricing.finalPayment != null
          ? [{ label: 'Schlussrate', value: `${pricing.finalPayment.toLocaleString('de-DE')} €` }]
          : []),
      ],
      disclaimer: 'Finanzierungsbeispiel – Bonität vorausgesetzt.',
    };
  }

  return {
    id: 'leasing',
    label: 'Leasing',
    headline: pricing.leasingRate != null
      ? `${pricing.leasingRate.toLocaleString('de-DE')} €`
      : 'auf Anfrage',
    lines: [
      { label: 'Laufzeit', value: `${pricing.leasingTermMonths} Monate` },
      ...(pricing.leasingRate != null
        ? [{ label: 'Monatliche Rate', value: `${pricing.leasingRate.toLocaleString('de-DE')} €` }]
        : []),
      { label: 'Laufleistung', value: `${pricing.leasingMileagePerYear.toLocaleString('de-DE')} km` },
    ],
    disclaimer: 'Leasingbeispiel – nicht als Angebot im Rechtssinne.',
  };
}

/**
 * @param {import('./purchaseTypeOptions.js').PurchaseTypeId|null} purchaseType
 */
export function resolveOfferPaymentModes(purchaseType) {
  if (shouldShowAllPaymentVariants(purchaseType)) {
    return ['cash', 'finance', 'leasing'];
  }
  if (purchaseType === 'cash') return ['cash'];
  if (purchaseType === 'finance') return ['finance'];
  if (purchaseType === 'leasing') return ['leasing'];
  return ['cash', 'finance', 'leasing'];
}

/**
 * @param {object} snapshot – buildDealerJourneySnapshot()
 * @param {object} dealerConditions
 */
export function buildJourneyOffers(snapshot, dealerConditions) {
  const configuration = snapshot?.configuration;
  if (!isJourneyOfferSupported(configuration)) return null;

  const modelKey = resolveConfigurationModelKey(configuration);
  const isSorento = configuration.catalogId === 'sorento' || SORENTO_CATALOG_IDS.has(modelKey);
  let conditions = resolveModelConditions(dealerConditions, modelKey);

  if (!Object.keys(conditions.leasingFactors ?? {}).length) {
    const sportageConditions = resolveModelConditions(dealerConditions, 'sportage');
    conditions = {
      ...conditions,
      leasingFactors: sportageConditions.leasingFactors,
    };
  }

  const listPrice = resolveTrimListPrice(modelKey, configuration.trimId);
  const packagesPrice = isSorento ? resolvePackagesPrice(configuration.packageIds) : 0;
  const colorSurcharge = isSorento ? resolveColorSurcharge(configuration.colorId) : 0;
  const preparationFee = Number(conditions.preparationFee ?? 0);
  const configurationPrice = listPrice + packagesPrice + colorSurcharge + preparationFee;

  const discountPercent = resolveDiscountPercent(snapshot.discountGroup, conditions);
  const discountAmount = Math.round(configurationPrice * (discountPercent / 100));
  const housePrice = Math.max(0, configurationPrice - discountAmount);

  const leasingResolved = resolveLeasingFactor(
    DEFAULT_LEASING_TERM,
    DEFAULT_LEASING_KM,
    conditions,
  );
  const leasingRate = calcLeasingRate(
    configurationPrice,
    leasingResolved.factor,
    leasingResolved.termMonths,
  );

  const financeResolved = calcFinanceRate(housePrice, DEFAULT_FINANCE_TERM, conditions);

  const pricing = {
    listPrice,
    packagesPrice,
    colorSurcharge,
    preparationFee,
    configurationPrice,
    discountPercent,
    discountAmount,
    housePrice,
    cashPrice: housePrice,
    leasingRate,
    leasingTermMonths: leasingResolved.termMonths,
    leasingMileagePerYear: leasingResolved.mileagePerYear,
    financeRate: financeResolved.financeRate,
    finalPayment: financeResolved.finalPayment,
    financeTermMonths: DEFAULT_FINANCE_TERM,
    deliveryTime: conditions.deliveryTime ?? '4–6 Wochen',
  };

  const modes = resolveOfferPaymentModes(snapshot.purchaseType);
  const offers = modes.map((mode) => buildOfferCard(mode, pricing));

  return {
    catalogId: isSorento ? 'sorento' : modelKey,
    modelKey,
    vehicleTitle: `${snapshot.vehicle?.modelLabel ?? 'Sorento'} ${snapshot.vehicle?.trimLabel ?? ''}`.trim(),
    discountPercent,
    pricing,
    offers,
    showAllPaymentVariants: shouldShowAllPaymentVariants(snapshot.purchaseType),
  };
}
