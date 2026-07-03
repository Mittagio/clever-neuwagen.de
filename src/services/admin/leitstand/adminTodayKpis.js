/**
 * KPI-Aggregation für Admin „Heute“.
 */

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= startOfDay();
}

export function computeTodayKpis({
  dealers = [],
  applications = [],
  leads = [],
  offers = [],
  deliveries = [],
  invoices = [],
  tasks = [],
} = {}) {
  const activeDealers = dealers.filter((d) => d.status === 'active').length;
  const onboardedToday = [
    ...dealers.filter((d) => isToday(d.createdAt)),
    ...applications.filter((a) => isToday(a.submittedAt ?? a.updatedAt)),
  ].length;

  const leadsToday = leads.filter((l) => isToday(l.createdAt)).length;
  const offersToday = offers.filter((o) => isToday(o.createdAt)).length;
  const salesToday = deliveries.filter((d) => isToday(d.confirmedAt ?? d.createdAt)).length;

  const provisionToday = invoices
    .filter((i) => isToday(i.paidAt ?? i.createdAt) && i.status === 'paid')
    .reduce((sum, i) => sum + (i.successFees ?? i.amount ?? 0), 0);

  const openProblems = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'today').length;

  return {
    activeDealers,
    onboardedToday,
    leadsToday,
    offersToday,
    salesToday,
    provisionToday,
    openProblems,
    totalDealers: dealers.length,
  };
}

export function formatProvisionEuro(amount) {
  if (amount == null) return '0 €';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

export function formatTimelineTime(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
