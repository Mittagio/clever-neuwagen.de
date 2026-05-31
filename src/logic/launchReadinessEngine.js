import { SYSTEM_SEVERITY } from '../data/rolesConfig.js';

export function computeLaunchChecklist(ctx) {
  const {
    dealers = [],
    invoices = [],
    importMetrics = {},
    systemIssues = [],
  } = ctx;

  const trinkle = dealers.find((d) => d.id === 'autohaus-trinkle');
  const criticalIssues = systemIssues.filter((i) => i.type === 'critical').length;

  const sections = [
    {
      id: 'legal',
      title: 'Rechtliches',
      items: [
        { id: 'impressum', label: 'Impressum', done: true },
        { id: 'datenschutz', label: 'Datenschutz', done: true },
        { id: 'agb', label: 'AGB', done: true },
        { id: 'haendler-agb', label: 'Händler-AGB', done: true },
      ],
    },
    {
      id: 'tech',
      title: 'Technik',
      items: [
        { id: 'ssl', label: 'SSL', done: false, note: 'Vorbereitet – VPS-Deploy' },
        { id: 'routing', label: 'Routing', done: true },
        { id: 'errors', label: 'Fehlerseiten', done: true },
        { id: 'mobile', label: 'Mobile', done: true },
      ],
    },
    {
      id: 'dealer',
      title: 'Händler',
      items: [
        { id: 'account', label: 'Händlerkonto', done: trinkle?.status === 'active' },
        { id: 'leasing', label: 'Leasingfaktoren', done: trinkle?.status === 'active' },
        { id: 'discounts', label: 'Rabatte', done: trinkle?.status === 'active' },
        { id: 'delivery', label: 'Lieferzeiten', done: trinkle?.status === 'active' },
      ],
    },
    {
      id: 'vehicles',
      title: 'Fahrzeuge',
      items: [
        { id: 'sportage', label: 'Sportage', done: true },
        { id: 'ev3', label: 'EV3', done: true },
        { id: 'ev4', label: 'EV4', done: false, note: 'WLTP unvollständig' },
      ],
    },
    {
      id: 'sales',
      title: 'Vertrieb',
      items: [
        { id: 'crm', label: 'CRM', done: true },
        { id: 'offers', label: 'Angebote', done: true },
        { id: 'compare', label: 'Vergleich', done: true },
        { id: 'advisor', label: 'KI-Beratung', done: true },
      ],
    },
  ];

  const allItems = sections.flatMap((s) => s.items);
  const doneCount = allItems.filter((i) => i.done).length;
  const percent = Math.round((doneCount / allItems.length) * 100);
  const launchReady = percent >= 85 && criticalIssues === 0;

  return { sections, percent, launchReady, doneCount, totalCount: allItems.length };
}

export function computePlatformAnalytics(ctx) {
  const {
    dealers = [],
    leads = [],
    offers = [],
    deliveries = [],
    invoices = [],
    intelligenceSearches = [],
  } = ctx;

  const activeDealers = dealers.filter((d) => d.status === 'active').length;
  const activeCustomers = new Set(
    leads.map((l) => l.contact?.email).filter(Boolean),
  ).size;

  const confirmedSales = deliveries.filter((d) => d.confirmed).length;
  const conversionRate = leads.length
    ? Math.round((confirmedSales / leads.length) * 100)
    : 0;

  const totalProvision = deliveries
    .filter((d) => d.confirmed)
    .reduce((s, d) => s + (d.provisionAmount ?? 0), 0);

  const modelCounts = {};
  for (const lead of leads) {
    const model = lead.vehicle?.model ?? 'Unbekannt';
    modelCounts[model] = (modelCounts[model] ?? 0) + 1;
  }
  const topModels = Object.entries(modelCounts)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topSearches = intelligenceSearches.slice(0, 5);

  return {
    activeDealers,
    activeCustomers,
    leadsCount: leads.length,
    offersCount: offers.length,
    salesCount: confirmedSales,
    conversionRate,
    totalProvision,
    openInvoices: invoices.filter((i) => i.status === 'open').length,
    topModels,
    topSearches,
  };
}

import { getVoucherPilotStatus } from '../services/delivery/deliveryFlowStatus.js';

export function computePilotStats(dealerId, ctx) {
  const { leads = [], offers = [], deliveries = [], systemIssues = [] } = ctx;

  const dealerLeads = leads.filter((l) => (l.dealerId ?? 'autohaus-trinkle') === dealerId);
  const dealerOffers = offers.length;
  const dealerSales = deliveries.filter(
    (d) => d.dealerId === dealerId && d.confirmed,
  ).length;
  const dealerIssues = systemIssues.filter(
    (i) => i.dealerId === dealerId && i.type !== 'ok',
  );

  const voucherPilot = getVoucherPilotStatus(dealerLeads, deliveries.filter((d) => d.dealerId === dealerId));
  const anyProvision = deliveries.some((d) => d.dealerId === dealerId && d.status === 'provisionReleased');
  const anyBillable = deliveries.some((d) => d.dealerId === dealerId && (d.billingStatus === 'billable' || d.status === 'provisionReleased'));

  const phases = [
    { label: 'KI-Beratung', done: true },
    { label: 'Vergleich', done: true },
    { label: 'Angebot', done: dealerOffers > 0 },
    { label: 'Lead', done: dealerLeads.length > 0 },
    { label: 'Verkauf', done: dealerSales > 0 },
    { label: 'Auslieferung', done: deliveries.some((d) => d.dealerId === dealerId && d.confirmed) },
    { label: 'Provision', done: anyProvision, note: anyBillable && !anyProvision ? 'Warte auf Gutschein' : null },
    {
      label: 'Gutschein',
      done: voucherPilot.done,
      note: voucherPilot.label,
    },
  ];

  const completedPhases = phases.filter((p) => p.done).length;
  const pilotPercent = Math.round((completedPhases / phases.length) * 100);

  return {
    dealerId,
    leads: dealerLeads.length,
    offers: dealerOffers,
    sales: dealerSales,
    issues: dealerIssues,
    phases,
    pilotPercent,
    status: pilotPercent >= 75 ? 'on-track' : 'needs-attention',
  };
}

export function getSeverityMeta(type) {
  return SYSTEM_SEVERITY[type] ?? SYSTEM_SEVERITY.warning;
}

export function buildBackupPayload(state) {
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    platform: 'clever-neuwagen',
    data: state,
  };
}
