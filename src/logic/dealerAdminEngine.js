import { DEALER_STATUS, PLATFORM_BRANDS, KIA_MODELS } from '../data/dealerRegistry.js';

export function getDealerStatusMeta(statusId) {
  return DEALER_STATUS[statusId] ?? DEALER_STATUS.draft;
}

export function countModelsForDealer(dealer) {
  if (!dealer?.models) return 0;
  return Object.values(dealer.models).reduce((sum, arr) => sum + arr.length, 0);
}

export function getBrandLabels(dealer) {
  if (!dealer?.brands?.length) return '–';
  return dealer.brands
    .map((id) => PLATFORM_BRANDS.find((b) => b.id === id)?.name ?? id)
    .join(', ');
}

export function computeOperatorKpis(dealers, approvals, importMetrics, invoices) {
  const activeDealers = dealers.filter((d) => d.status === 'active').length;
  const newDealers = dealers.filter((d) => {
    const created = new Date(d.createdAt);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return created.getTime() > thirtyDaysAgo;
  }).length;

  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length;
  const pendingPriceLists = importMetrics?.pending ?? 0;
  const openInvoices = invoices.filter((i) => i.status === 'open' || i.status === 'reminder').length;

  const activeBrandIds = new Set();
  const activeModelCount = { total: 0 };
  for (const dealer of dealers) {
    if (dealer.status !== 'active') continue;
    dealer.brands?.forEach((b) => activeBrandIds.add(b));
    activeModelCount.total += countModelsForDealer(dealer);
  }

  return {
    activeDealers,
    newDealers,
    pendingApprovals,
    pendingPriceLists,
    openInvoices,
    activeBrands: activeBrandIds.size,
    activeModels: activeModelCount.total,
    totalDealers: dealers.length,
  };
}

export function buildReadonlyConditions(dealerId) {
  if (dealerId === 'autohaus-trinkle') {
    return {
      discounts: { standard: 12, corporateBenefits: 15, gewerbe: 13 },
      leasingFactors: { '48/15000': 0.64, '36/10000': 0.68 },
      finance: { effectiveRate: 4.49, finalPaymentPercent: 55 },
      delivery: { default: '4–6 Wochen', sportage: '2–4 Wochen (Lager)' },
    };
  }
  return {
    discounts: { standard: 10, corporateBenefits: 12 },
    leasingFactors: { '48/15000': 0.66 },
    finance: { effectiveRate: 4.79 },
    delivery: { default: '6–8 Wochen' },
  };
}

export function mergeDealerWithBilling(dealer, billingSummary) {
  if (!billingSummary) return dealer;
  return {
    ...dealer,
    stats: {
      ...dealer.stats,
      sales: billingSummary.salesCount ?? dealer.stats.sales,
      monthlyRevenue: billingSummary.total ?? dealer.stats.monthlyRevenue,
    },
  };
}

export { PLATFORM_BRANDS, KIA_MODELS };
