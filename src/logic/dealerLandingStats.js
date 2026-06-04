/**
 * Clever-Moment Kennzahlen für Händler-Landing (aus Marktplatz + Lager).
 */
export function computeDealerLandingStats({
  vehicles = [],
  dealerId,
  city = '',
  inventory = [],
  activeModelCount = 6,
}) {
  const dealerPool = vehicles.filter(
    (v) => (v.dealerSlug ?? dealerId) === dealerId,
  );

  const immediateMarket = dealerPool.filter(
    (v) => v.availability === 'sofort' || v.stockStatus === 'lager',
  );

  const immediateInventory = inventory.filter(
    (item) => ['lager', 'vorlauf'].includes(item.type) && item.visibleOnLanding !== false,
  );

  const discounts = dealerPool.map((v) => v.discountPercent).filter((n) => n > 0);
  const avgDiscount = discounts.length
    ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
    : 18;

  const distanceKm = dealerPool.find((v) => v.distanceKm != null)?.distanceKm ?? 12;

  const matchingCount = Math.max(
    dealerPool.length + immediateInventory.length + activeModelCount * 8,
    dealerPool.length + 1,
  );

  const immediateCount = Math.max(
    immediateMarket.length + immediateInventory.length,
    immediateInventory.length,
  );

  return {
    matchingCount,
    immediateCount,
    avgPriceAdvantagePercent: avgDiscount,
    distanceKm,
    city,
  };
}
