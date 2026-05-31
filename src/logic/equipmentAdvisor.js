import { sportage, formatPrice, getVariant } from '../data/kiaSportage.js';
import {
  CUSTOMER_WISHES,
  PACKAGE_FRIENDLY_NAMES,
  WISH_AVAILABILITY,
} from '../data/equipmentWishCatalog.js';
import { calculatePrice } from './priceCalculator.js';

const TRIM_ORDER = ['vision', 'spirit', 'black-edition', 'gt-line'];
const DEFAULT_ENGINE = 'tgi-hybrid-2wd';
const DEFAULT_COLOR = 'carraraweiss';

function getWishDef(wishId) {
  return CUSTOMER_WISHES.find((w) => w.id === wishId);
}

function getPackageFriendlyName(packageId) {
  const pkg = sportage.packages.find((p) => p.id === packageId);
  return PACKAGE_FRIENDLY_NAMES[packageId] ?? pkg?.name ?? packageId;
}

function resolveTrimNeeds(trimId, selectedWishIds) {
  const requiredPackages = new Set();
  const coveredByStandard = [];
  const missing = [];

  for (const wishId of selectedWishIds) {
    const rule = WISH_AVAILABILITY[wishId];
    if (!rule) continue;

    if (rule.standardTrims.includes(trimId)) {
      coveredByStandard.push(wishId);
      continue;
    }

    const pkgId = rule.packageByTrim[trimId];
    if (pkgId) {
      requiredPackages.add(pkgId);
    } else {
      missing.push(wishId);
    }
  }

  return {
    trimId,
    canFulfill: missing.length === 0,
    requiredPackages: [...requiredPackages],
    coveredByStandard,
    missing,
  };
}

function calcTrimPrice(trimId, packageIds, conditions) {
  const price = calculatePrice(
    {
      trimId,
      engineId: DEFAULT_ENGINE,
      colorId: DEFAULT_COLOR,
      selectedPackageIds: packageIds,
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 10000,
      downPayment: 0,
      customerGroup: 'standard',
    },
    conditions,
  );

  const listPrice = calculatePrice(
    {
      trimId,
      engineId: DEFAULT_ENGINE,
      colorId: DEFAULT_COLOR,
      selectedPackageIds: packageIds,
      paymentType: 'cash',
      customerGroup: 'standard',
    },
    conditions,
  );

  return {
    leasingRate: price.leasingRate,
    cashPrice: listPrice.cashPrice,
    listPrice: listPrice.configurationPrice,
  };
}

export function analyzeEquipmentWishes(selectedWishIds, conditions) {
  if (!selectedWishIds.length) {
    return { empty: true };
  }

  const trimResults = TRIM_ORDER.map((trimId) => {
    const needs = resolveTrimNeeds(trimId, selectedWishIds);
    const trim = sportage.trims.find((t) => t.id === trimId);
    let pricing = null;

    if (needs.canFulfill) {
      pricing = calcTrimPrice(trimId, needs.requiredPackages, conditions);
    }

    return { ...needs, trim, pricing };
  });

  const possible = trimResults.filter((t) => t.canFulfill);
  const impossible = trimResults.filter((t) => !t.canFulfill);

  possible.sort((a, b) => a.pricing.cashPrice - b.pricing.cashPrice);
  const recommended = possible[0] ?? null;

  const requiredPackages = recommended
    ? recommended.requiredPackages.map((id) => ({
        id,
        label: getPackageFriendlyName(id),
        price: sportage.packages.find((p) => p.id === id)?.price ?? 0,
      }))
    : [];

  const fulfilledWishes = selectedWishIds.map((wishId) => {
    const wish = getWishDef(wishId);
    const viaStandard = recommended?.coveredByStandard.includes(wishId);
    const viaPackage = recommended?.requiredPackages.find((pkgId) => {
      const rule = WISH_AVAILABILITY[wishId];
      return rule?.packageByTrim[recommended.trimId] === pkgId;
    });

    return {
      id: wishId,
      label: wish?.label ?? wishId,
      emoji: wish?.emoji ?? '✓',
      included: Boolean(recommended && (viaStandard || viaPackage)),
      viaPackage: viaPackage ? getPackageFriendlyName(viaPackage) : null,
    };
  });

  const baseline = recommended
    ? calcTrimPrice(recommended.trimId, [], conditions)
    : null;

  const priceDelta = recommended && baseline
    ? recommended.pricing.cashPrice - baseline.cashPrice
    : 0;

  return {
    empty: false,
    recommended: recommended
      ? {
          trimId: recommended.trimId,
          trimName: recommended.trim?.name,
          vehicleLabel: `${sportage.brand} ${sportage.model} ${recommended.trim?.name}`,
          packages: requiredPackages,
          packageIds: recommended.requiredPackages,
          pricing: recommended.pricing,
          priceDelta,
          baselinePrice: baseline?.cashPrice ?? 0,
        }
      : null,
    impossible: impossible.map((t) => ({
      trimId: t.trimId,
      trimName: t.trim?.name,
      missingWishes: t.missing.map((id) => getWishDef(id)?.label ?? id),
    })),
    fulfilledWishes,
    allImpossible: possible.length === 0,
  };
}

export function buildConfigFromEquipmentResult(recommended) {
  if (!recommended) return null;

  const variant = getVariant(recommended.trimId, DEFAULT_ENGINE);

  return {
    model: sportage.model,
    variantId: variant?.id ?? null,
    trimId: recommended.trimId,
    engineId: DEFAULT_ENGINE,
    colorId: DEFAULT_COLOR,
    selectedPackageIds: recommended.packageIds ?? recommended.packages?.map((p) => p.id) ?? [],
    selectedAccessoryIds: [],
    customerGroup: 'standard',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
  };
}

export function buildEquipmentPriceFromResult(recommended, conditions) {
  const config = buildConfigFromEquipmentResult(recommended);
  if (!config) return null;
  return calculatePrice(
    { ...config, model: sportage.model, dealerConditions: conditions },
    conditions,
  );
}

export { CUSTOMER_WISHES, formatPrice };
