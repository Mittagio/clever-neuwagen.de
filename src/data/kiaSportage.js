/**
 * Kia Sportage – Facade für App-weite Nutzung
 * Stammdaten: src/data/models/kia/sportage.js
 * Preislisten-Import aktualisiert künftig das zentrale Modell.
 */

import { kiaSportage } from './models/kia/sportage.js';
import {
  buildLegacySportage,
  getUpe,
  getEquipmentForTrim as getEquipment,
  getWltpForEngine as getWltp,
  getVariant,
  getVariantPrice,
  getAvailableEnginesForTrim,
  getAvailableColorsForTrim,
  getAvailablePackagesForTrim,
  getPackagesWithAvailability,
  getAccessoriesWithAvailability,
  getAvailableAccessoriesForTrim,
  getPackageAvailability,
  getAccessoryAvailability,
  getVariantById,
  resolveConfigIds,
  resolveEngineId,
  resolveTrimId,
  resolveColorId,
  resolvePackageId,
} from './models/kia/sportageAdapter.js';
import { resolveModelConditions } from './dealerConditionsSchema.js';
import { autohausTrinkleSeed } from './dealers/autohausTrinkle.js';

export { kiaSportage };

/** Legacy-kompatibles Objekt (upe, equipment-Map, price-Felder) */
export const sportage = buildLegacySportage();

export {
  getUpe,
  getEquipment,
  getWltp,
  getVariant,
  getVariantPrice,
  getAvailableEnginesForTrim,
  getAvailableColorsForTrim,
  getAvailablePackagesForTrim,
  getPackagesWithAvailability,
  getAccessoriesWithAvailability,
  getAvailableAccessoriesForTrim,
  getPackageAvailability,
  getAccessoryAvailability,
  getVariantById,
  resolveConfigIds,
  resolveEngineId,
  resolveTrimId,
  resolveColorId,
  resolvePackageId,
};

/** Händlerkonditionen – re-export aus dealers/autohausTrinkle.js */
export const dealerConditionsTrinkle = autohausTrinkleSeed;

export const dealers = [
  {
    slug: 'autohaus-trinkle',
    name: 'Autohaus Trinkle',
    city: 'Heilbronn',
    plz: '74072',
    brand: 'Kia',
    models: ['Sportage', 'Ceed', 'EV6'],
    distance: 12,
    offersFrom: 31672,
    rating: 4.8,
    hasConfigurator: true,
  },
  {
    slug: 'autohaus-mueller',
    name: 'Autohaus Müller',
    city: 'Stuttgart',
    plz: '70173',
    brand: 'Kia',
    models: ['Sportage', 'Niro', 'Picanto'],
    distance: 45,
    offersFrom: 34190,
    rating: 4.6,
    hasConfigurator: false,
  },
  {
    slug: 'kia-center-karlsruhe',
    name: 'Kia Center Karlsruhe',
    city: 'Karlsruhe',
    plz: '76133',
    brand: 'Kia',
    models: ['Sportage', 'EV9', 'Stonic'],
    distance: 68,
    offersFrom: 33890,
    rating: 4.7,
    hasConfigurator: false,
  },
];

export function formatPrice(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function calcListPrice(config) {
  const resolved = resolveConfigIds(config);
  const base = getUpe(resolved.trimId, resolved.engineId);
  const color = sportage.colors.find((c) => c.id === resolved.colorId);
  const colorPrice = color?.price ?? 0;
  const packageTotal = (resolved.selectedPackageIds ?? resolved.packageIds ?? []).reduce((sum, id) => {
    const pkg = sportage.packages.find((p) => p.id === id);
    return sum + (pkg?.price || 0);
  }, 0);
  return base + colorPrice + packageTotal;
}

export function calcDiscountedPrice(config, discountKey = 'standard', conditions = dealerConditionsTrinkle) {
  const listPrice = calcListPrice(config);
  const resolved = resolveModelConditions(conditions, 'sportage');
  const discountPercent = resolved.discounts[discountKey] ?? resolved.discounts.standard;
  return Math.round(listPrice * (1 - discountPercent / 100));
}

export function getLeasingFactor(durationMonths, kmPerYear, conditions = dealerConditionsTrinkle) {
  const resolved = resolveModelConditions(conditions, 'sportage');
  return resolved.leasingFactors[durationMonths]?.[kmPerYear] ?? null;
}

export function calcLeasingRate(config, options = {}, conditions = dealerConditionsTrinkle) {
  const {
    durationMonths = 48,
    kmPerYear = 10000,
    discountKey = 'standard',
    downPayment = 0,
  } = options;

  const factor = getLeasingFactor(durationMonths, kmPerYear, conditions);
  if (factor == null) return null;

  const price = calcDiscountedPrice(config, discountKey, conditions) + conditions.preparationFee;
  return Math.round(((price - downPayment) * factor) / durationMonths);
}
