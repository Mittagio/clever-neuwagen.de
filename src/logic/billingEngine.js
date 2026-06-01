import { BILLING_CONFIG, PAYMENT_STATUS } from '../data/billingConfig.js';
import { BILLING_DEALERS } from '../data/demoBilling.js';
import { DELIVERY_REWARDS } from '../data/deliveryRewards.js';

function monthKeyFromDate(iso) {
  if (!iso) return BILLING_CONFIG.defaultMonth;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function vehicleLabel(lead) {
  const v = lead.vehicle;
  if (!v) return 'Fahrzeug';
  return v.label ?? `${v.brand ?? ''} ${v.model ?? ''} ${v.trim ?? ''}`.trim();
}

/** Lead → DeliveryConfirmation (wenn Auslieferungsflow aktiv) */
export function deliveryFromLead(lead, dealerId = 'autohaus-trinkle') {
  const dc = lead.deliveryConfirmation;
  if (!dc?.sentAt) return null;

  const confirmed = dc.response === 'yes' || dc.status === 'confirmed';
  const declined = dc.response === 'no' || dc.status === 'declined';
  const respondedAt = dc.confirmedAt ?? dc.respondedAt ?? null;
  const deliveryDate = respondedAt
    ? respondedAt.slice(0, 10)
    : lead.updatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  let status = 'pending';
  if (declined) status = 'declined';
  else if (dc.provisionReleased || dc.voucher?.status === 'sent') status = 'provisionReleased';
  else if (confirmed && dc.rewards?.selectedPartnerId && !dc.voucher?.sentAt) status = 'voucherPending';
  else if (confirmed) status = 'confirmed';
  else if (dc.sentAt) status = dc.emailError ? 'error' : 'sent';

  return {
    id: `lead-del-${lead.id}`,
    leadId: lead.id,
    dealerId: lead.dealerId ?? dealerId,
    customerId: lead.contact?.email ?? lead.id,
    customerName: lead.contact?.name ?? 'Kunde',
    vehicle: vehicleLabel(lead),
    deliveryDate,
    confirmed,
    confirmedAt: respondedAt,
    provisionAmount: dc.provisionAmount ?? dc.rewards?.provision ?? DELIVERY_REWARDS.provision,
    provisionReleased: !!dc.provisionReleased,
    provisionReleasedAt: dc.provisionReleasedAt ?? null,
    voucherCode: dc.voucher?.code ?? null,
    voucherPartner: dc.voucher?.partnerName ?? null,
    voucherSentAt: dc.voucherSentAt ?? dc.voucher?.sentAt ?? null,
    billingStatus: dc.billingStatus ?? (dc.provisionReleased ? 'billable' : null),
    month: monthKeyFromDate(respondedAt ?? dc.sentAt),
    status,
  };
}

export function mergeDeliveries(storedDeliveries, leads) {
  const byId = new Map(storedDeliveries.map((d) => [d.id, d]));

  for (const lead of leads) {
    const activeDelivery = ['ausgeliefert', 'auslieferung_bestaetigt'].includes(lead.status)
      || lead.deliveryConfirmation?.sentAt;
    if (!activeDelivery) continue;
    const derived = deliveryFromLead(lead);
    if (!derived) continue;
    const existing = byId.get(derived.id);
    if (!existing || (derived.confirmedAt && !existing.confirmedAt)) {
      byId.set(derived.id, { ...existing, ...derived });
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate),
  );
}

export function getDealerById(dealerId) {
  return BILLING_DEALERS.find((d) => d.id === dealerId) ?? null;
}

export function countActiveDealers(dealers = BILLING_DEALERS) {
  return dealers.filter((d) => d.status === 'active').length;
}

export function computeDealerMonthSummary(dealerId, month, deliveries, invoices) {
  const dealer = getDealerById(dealerId);
  const monthDeliveries = deliveries.filter(
    (d) => d.dealerId === dealerId && d.month === month,
  );
  const billableSales = monthDeliveries.filter(
    (d) => d.status === 'provisionReleased' || d.provisionReleased,
  );
  const confirmedSales = monthDeliveries.filter((d) => d.confirmed && d.status !== 'declined');
  const successFees = billableSales.reduce((sum, d) => sum + (d.provisionAmount ?? 0), 0);
  const platformFee = dealer?.status === 'active' ? BILLING_CONFIG.platformFeeMonthly : 0;
  const total = platformFee + successFees;

  const invoice = invoices.find((inv) => inv.dealerId === dealerId && inv.month === month);

  return {
    dealerId,
    dealer,
    month,
    platformFee,
    salesCount: billableSales.length,
    successFees,
    total,
    status: invoice?.status ?? (total > 0 ? 'open' : 'paid'),
    invoiceId: invoice?.id ?? null,
    sales: billableSales,
    pendingConfirmations: confirmedSales.filter((d) => d.status !== 'provisionReleased' && !d.provisionReleased),
  };
}

export function computeAllDealerSummaries(month, deliveries, invoices) {
  return BILLING_DEALERS.map((dealer) =>
    computeDealerMonthSummary(dealer.id, month, deliveries, invoices),
  ).sort((a, b) => b.total - a.total);
}

export function computeDashboardKpis(month, deliveries, invoices, dealers = BILLING_DEALERS) {
  const activeDealers = countActiveDealers(dealers);
  const monthDeliveries = deliveries.filter((d) => d.month === month);
  const confirmedSales = monthDeliveries.filter((d) => d.confirmed && d.status !== 'declined');
  const successFees = confirmedSales.reduce((sum, d) => sum + (d.provisionAmount ?? 0), 0);
  const platformFees = activeDealers * BILLING_CONFIG.platformFeeMonthly;

  const monthInvoices = invoices.filter((inv) => inv.month === month);
  const openAmount = monthInvoices
    .filter((inv) => inv.status === 'open' || inv.status === 'reminder')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = monthInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return {
    month,
    activeDealers,
    salesCount: confirmedSales.length,
    successFees,
    platformFees,
    openAmount,
    paidAmount,
    totalBilled: openAmount + paidAmount,
  };
}

export function generateInvoiceNumber(counter, year = new Date().getFullYear()) {
  const next = counter + 1;
  return `${BILLING_CONFIG.invoicePrefix}-${year}-${String(next).padStart(5, '0')}`;
}

export function buildInvoiceForDealer(dealerId, month, deliveries, counter) {
  const summary = computeDealerMonthSummary(dealerId, month, deliveries, []);
  if (summary.total <= 0) return null;

  const invoiceNumber = generateInvoiceNumber(counter);
  const vat = Math.round(summary.total * BILLING_CONFIG.vatRate * 100) / 100;

  return {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    dealerId,
    month,
    platformFee: summary.platformFee,
    successFees: summary.successFees,
    amount: summary.total,
    vat,
    status: 'open',
    createdAt: new Date().toISOString(),
    deliveryIds: summary.sales.map((s) => s.id),
  };
}

export function computeBillingAnalytics(deliveries, invoices, month) {
  const monthDeliveries = deliveries.filter((d) => d.month === month && d.confirmed);
  const totalProvision = monthDeliveries.reduce((s, d) => s + (d.provisionAmount ?? 0), 0);

  const byDealer = {};
  for (const d of monthDeliveries) {
    byDealer[d.dealerId] = (byDealer[d.dealerId] ?? 0) + (d.provisionAmount ?? 0);
  }

  const dealerRanking = Object.entries(byDealer)
    .map(([dealerId, amount]) => ({
      dealerId,
      dealer: getDealerById(dealerId),
      amount,
      sales: monthDeliveries.filter((d) => d.dealerId === dealerId).length,
    }))
    .sort((a, b) => b.amount - a.amount);

  const confirmed = deliveries.filter((d) => d.confirmed);
  const pending = deliveries.filter((d) => d.status === 'pending');
  const confirmRate = deliveries.length
    ? Math.round((confirmed.length / deliveries.filter((d) => d.status !== 'declined').length) * 100)
    : 0;

  const deliveryDays = confirmed
    .filter((d) => d.confirmedAt && d.deliveryDate)
    .map((d) => {
      const diff = new Date(d.confirmedAt) - new Date(d.deliveryDate);
      return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
    });
  const avgDeliveryConfirmDays = deliveryDays.length
    ? Math.round(deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length)
    : 0;

  const avgProvision = monthDeliveries.length
    ? Math.round(totalProvision / monthDeliveries.length)
    : 0;

  return {
    totalProvision,
    avgProvision,
    topDealers: dealerRanking.slice(0, 5),
    confirmRate,
    avgDeliveryConfirmDays,
    openInvoices: invoices.filter((i) => i.status === 'open').length,
    paidInvoices: invoices.filter((i) => i.status === 'paid').length,
  };
}

export function getPaymentStatusMeta(statusId) {
  return PAYMENT_STATUS[statusId] ?? PAYMENT_STATUS.open;
}

export function provisionChainSteps() {
  return [
    { step: 1, label: 'Verkaufschance' },
    { step: 2, label: 'Angebot' },
    { step: 3, label: 'Bestellung' },
    { step: 4, label: 'Auslieferung' },
    { step: 5, label: 'Bestätigung' },
    { step: 6, label: 'Provision aktiv' },
  ];
}
