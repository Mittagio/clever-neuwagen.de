import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { formatMoney } from '../../data/billingConfig.js';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchKpi,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminAnalyticsPage() {
  const { getAnalytics } = useLaunchAdmin();
  const a = getAnalytics();

  usePageSeo({
    title: 'Analytics',
    description: 'Betreiber-KPI-Dashboard Clever-Neuwagen.',
    path: '/admin/analytics',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="KPI Dashboard" subtitle="Plattform-Kennzahlen für den Betreiber." />
        <LaunchAdminNav />

        <div className="launch-kpi-grid">
          <LaunchKpi label="Aktive Händler" value={a.activeDealers} />
          <LaunchKpi label="Aktive Kunden" value={a.activeCustomers} />
          <LaunchKpi label="Leads" value={a.leadsCount} />
          <LaunchKpi label="Angebote" value={a.offersCount} />
          <LaunchKpi label="Verkäufe" value={a.salesCount} />
          <LaunchKpi label="Conversion Rate" value={`${a.conversionRate} %`} />
          <LaunchKpi label="Provisionen" value={formatMoney(a.totalProvision)} />
          <LaunchKpi label="Offene Rechnungen" value={a.openInvoices} />
        </div>

        <h2 className="launch-checklist-section__title">Top Modelle</h2>
        {a.topModels.map((m) => (
          <div key={m.model} className="launch-card launch-table-card">
            <span className="launch-card__title">{m.model}</span>
            <span>{m.count} Anfragen</span>
          </div>
        ))}

        {a.topSearches.length > 0 && (
          <>
            <h2 className="launch-checklist-section__title" style={{ marginTop: 24 }}>Top Suchanfragen</h2>
            {a.topSearches.map((q) => (
              <div key={q} className="launch-card">{q}</div>
            ))}
          </>
        )}
      </div>
    </PageShell>
  );
}
