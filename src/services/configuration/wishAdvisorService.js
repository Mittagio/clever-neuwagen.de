import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getMarketplaceVehiclePool } from '../../data/marketplacePool.js';

const MARKETPLACE_VEHICLES = getMarketplaceVehiclePool();
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import { trimIdFromVehicle } from '../configurator/wishMagicService.js';
import { findBestTrimForWish } from '../configurator/wishPackageResolver.js';
import { priceConfiguration } from '../pricing/pricingEngine.js';
import { getDisplayPrice, normalizePaymentModeInput } from '../pricing/pricingResolver.js';
import { getVehicleOfferPath } from '../../logic/oneSearchService.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';

/**
 * Erfüllungsgrad je Wunsch für die Clever-Analyse-Box.
 */
export function buildWishFulfillment(selection, recommendationResult) {
  const wishIds = selection.selectedFeatures ?? [];
  if (!wishIds.length) {
    return { matched: 0, total: 0, scoreLabel: null, items: [] };
  }

  const includedMap = new Map(
    (recommendationResult?.includedFeatures ?? []).map((f) => [f.id, f]),
  );
  const requestedMap = new Map(
    (recommendationResult?.requestedFeatures ?? []).map((f) => [f.id, f]),
  );
  const packageIds = new Set(selection.selectedPackages ?? []);

  const items = wishIds.map((id) => {
    const label = getFeatureLabel(id);
    if (includedMap.has(id)) {
      return { id, label, status: 'standard', statusLabel: 'Serienmäßig' };
    }
    const req = requestedMap.get(id);
    if (req?.status === 'package' && req.packageId && packageIds.has(req.packageId)) {
      return { id, label, status: 'fulfilled', statusLabel: 'Über Paket' };
    }
    if (req?.status === 'package') {
      return { id, label, status: 'package', statusLabel: 'Paket nötig' };
    }
    if (req?.status === 'unavailable') {
      return { id, label, status: 'unavailable', statusLabel: 'Nicht verfügbar' };
    }
    return { id, label, status: 'pending', statusLabel: 'In Prüfung' };
  });

  const matched = items.filter((i) =>
    i.status === 'standard' || i.status === 'fulfilled',
  ).length;

  const total = wishIds.length;
  const scoreLabel = total > 0 ? `${matched} von ${total} Wünschen` : null;

  return { matched, total, scoreLabel, items };
}

/**
 * Alternative Fahrzeuge – Vergleich basiert auf Wünschen, nicht Modellnamen.
 */
export function buildWishBasedAlternatives({
  currentVehicle,
  wishFeatureIds = [],
  paymentMode = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  maxResults = 3,
}) {
  if (!wishFeatureIds.length || !currentVehicle) return [];

  const payment = normalizePaymentModeInput(paymentMode);
  const candidates = [];

  for (const v of MARKETPLACE_VEHICLES) {
    if (v.slug === currentVehicle.slug) continue;

    const mfg = getManufacturerModel(v.brand, v.model);
    if (!mfg) continue;

    const best = findBestTrimForWish({
      brand: v.brand,
      model: v.model,
      wishFeatureIds,
    });
    const trimId = best?.trimId ?? trimIdFromVehicle(v) ?? mfg.defaultTrimId;
    const resolution = resolveWishConfiguration({
      brand: v.brand,
      model: v.model,
      trimId,
      wishFeatureIds,
    });
    if (!resolution) continue;

    const missing = resolution.missingFeatures?.length ?? wishFeatureIds.length;
    const matched = wishFeatureIds.length - missing;
    if (matched === 0) continue;

    const pricing = priceConfiguration({
      brand: v.brand,
      model: v.model,
      trimId,
      wishFeatureIds,
      packageIds: resolution.packageIds ?? [],
      accessoryIds: resolution.accessoryIds ?? [],
      paymentType: payment,
      termMonths,
      mileagePerYear,
    });

    const display = getDisplayPrice(
      { paymentMode: payment, termMonths, mileagePerYear },
      { monthlyRate: v.monthlyRate, financeRate: Math.round(v.monthlyRate * 1.08), cashPrice: v.cashPrice },
      { basePricing: pricing, vehicle: v },
    );

    const trim = mfg.data.trims?.find((t) => t.id === trimId);

    candidates.push({
      vehicle: v,
      slug: v.slug,
      title: `${v.brand} ${v.model}${trim?.name ? ` ${trim.name}` : ''}`,
      priceLabel: display.label,
      priceValue: display.value,
      matched,
      total: wishFeatureIds.length,
      fulfillmentLabel: `${matched} von ${wishFeatureIds.length} Wünschen`,
      path: getVehicleOfferPath(v),
    });
  }

  return candidates
    .sort((a, b) => {
      const scoreA = a.matched / a.total;
      const scoreB = b.matched / b.total;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.priceValue ?? 0) - (b.priceValue ?? 0);
    })
    .slice(0, maxResults);
}

export function shouldShowWishAlternatives(wishFeatureIds, fulfillment) {
  if (!wishFeatureIds.length) return false;
  const familyWishes = ['towbar', 'seats_7', 'family_suv'];
  const hasFamilyWish = wishFeatureIds.some((id) => familyWishes.includes(id));
  const partialMatch = fulfillment.total > 0 && fulfillment.matched < fulfillment.total;
  return hasFamilyWish || partialMatch;
}
