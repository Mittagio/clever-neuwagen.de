import { MARKETPLACE_VEHICLES } from '../../data/marketplaceVehicles.js';
import { listDealerRegistry } from '../../data/dealers/index.js';
import { priceConfiguration } from '../pricing/pricingEngine.js';
import { rankDealerOffers } from '../dealer/dealerScoreService.js';

function estimateDistance(city) {
  const map = {
    Heilbronn: 12,
    Stuttgart: 18,
    Esslingen: 26,
    Ulm: 65,
  };
  return map[city] ?? 30;
}

/**
 * Baut Händlerangebote für eine Konfiguration – sortiert nach Händler-Score, nicht Preis.
 */
export function getDealerOffersForConfiguration({
  brand,
  model,
  trimId,
  wishFeatureIds = [],
  packageIds = [],
  accessoryIds = [],
  colorId = null,
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  maxRadiusKm = null,
  preferredDealerSlug = null,
}) {
  const offers = [];
  const seen = new Set();

  for (const entry of listDealerRegistry()) {
    const seed = entry.seed;
    const pricing = priceConfiguration({
      brand,
      model,
      trimId,
      wishFeatureIds,
      packageIds,
      accessoryIds,
      colorId,
      dealerId: entry.id,
      dealerConditions: seed,
      paymentType,
      termMonths,
      mileagePerYear,
    });

    if (!pricing) continue;

    const marketplaceMatch = MARKETPLACE_VEHICLES.find(
      (v) => v.dealerSlug === entry.slug && v.brand === brand
        && v.model.toLowerCase().includes(model.toLowerCase().split(' ')[0]),
    );

    const distanceKm = marketplaceMatch?.distanceKm ?? estimateDistance(seed.city);
    if (maxRadiusKm != null && distanceKm > maxRadiusKm) continue;

    const stockCount = (seed.inventory ?? []).filter(
      (inv) => inv.model?.toLowerCase().includes(model.toLowerCase().split(' ')[0]),
    ).length;

    const availability = marketplaceMatch?.availability ?? (stockCount > 0 ? 'sofort' : 'bestell');
    const deliveryTime = stockCount > 0 && availability === 'sofort'
      ? 'Sofort verfügbar'
      : pricing.deliveryTime;

    seen.add(entry.slug);
    offers.push({
      dealerId: entry.id,
      dealerName: seed.dealerName ?? entry.slug,
      dealerSlug: entry.slug,
      city: seed.city,
      plz: seed.plz,
      distanceKm,
      monthlyRate: pricing.leasingRate ?? pricing.primaryRate,
      financeRate: pricing.financeRate,
      cashPrice: pricing.cashPrice,
      discountPercent: pricing.discountPercent,
      deliveryTime,
      availability,
      stockCount,
      pricing,
      source: 'engine',
    });
  }

  const modelNorm = model.toLowerCase().split(' ')[0];
  for (const v of MARKETPLACE_VEHICLES) {
    if (seen.has(v.dealerSlug)) continue;
    if (v.brand !== brand) continue;
    if (!v.model.toLowerCase().includes(modelNorm)) continue;
    if (maxRadiusKm != null && v.distanceKm > maxRadiusKm) continue;

    seen.add(v.dealerSlug);
    offers.push({
      dealerId: v.dealerSlug,
      dealerName: v.dealerName,
      dealerSlug: v.dealerSlug,
      city: v.city,
      plz: v.plz,
      distanceKm: v.distanceKm,
      monthlyRate: v.monthlyRate,
      financeRate: Math.round(v.monthlyRate * 1.08),
      cashPrice: v.cashPrice,
      discountPercent: v.discountPercent,
      deliveryTime: v.deliveryTime,
      availability: v.availability,
      stockCount: v.availability === 'sofort' ? 1 : 0,
      marketplaceSlug: v.slug,
      source: 'marketplace',
    });
  }

  let ranked = rankDealerOffers(offers);

  if (preferredDealerSlug) {
    const preferred = ranked.find((o) => o.dealerSlug === preferredDealerSlug);
    if (preferred && ranked[0]?.dealerSlug !== preferredDealerSlug) {
      ranked = [preferred, ...ranked.filter((o) => o.dealerSlug !== preferredDealerSlug)];
    }
  }

  return ranked;
}

export function getDealerInventory(dealerSlug, excludeSlug = null) {
  return MARKETPLACE_VEHICLES.filter(
    (v) => v.dealerSlug === dealerSlug && v.slug !== excludeSlug,
  );
}

export function getSimilarVehiclesNearby(currentVehicle, limit = 4) {
  return MARKETPLACE_VEHICLES.filter(
    (v) => v.slug !== currentVehicle.slug
      && v.bodyType === currentVehicle.bodyType,
  )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
