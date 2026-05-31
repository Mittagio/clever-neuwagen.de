import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { formatBillingMonth, formatMoney } from '../../data/billingConfig.js';
import {
  AdminBillingNav,
  BillingKpiGrid,
  BillingPageHeader,
  BillingMoney,
  PaymentStatusBadge,
  ProvisionChain,
} from '../../components/billing/BillingShared.jsx';
import '../../components/billing/BillingShared.css';

export default function AdminBillingPage() {
  const {
    selectedMonth,
    getDashboard,
    getDealerSummaries,
    getAnalytics,
    generateAllInvoices,
  } = useBilling();

  const dashboard = getDashboard();
  const dealers = getDealerSummaries();
  const analytics = getAnalytics();

  usePageSeo({
    title: 'Abrechnung',
    description: 'Admin-Abrechnung: Plattformgebühren, Erfolgsprovisionen und Händlerrechnungen.',
    path: '/admin/billing',
  });

  const kpis = [
    { label: 'Aktiver Monat', value: formatBillingMonth(selectedMonth) },
    { label: 'Aktive Händler', value: dashboard.activeDealers },
    { label: 'Verkäufe', value: dashboard.salesCount },
    { label: 'Erfolgsprovisionen', value: formatMoney(dashboard.successFees) },
    { label: 'Plattformgebühren', value: formatMoney(dashboard.platformFees) },
    { label: 'Offene Forderungen', value: formatMoney(dashboard.openAmount) },
    { label: 'Bereits bezahlt', value: formatMoney(dashboard.paidAmount) },
  ];

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <BillingPageHeader
          title="Abrechnung"
          subtitle="Plattformgebühren, Erfolgsprovisionen und Händlerrechnungen auf einen Blick."
          actions={(
            <button type="button" className="bill-btn bill-btn--primary" onClick={() => generateAllInvoices()}>
              Rechnungen generieren
            </button>
          )}
        />
        <AdminBillingNav />
        <ProvisionChain />
        <BillingKpiGrid items={kpis} />

        <h2 className="bill-section-title">Händlerübersicht · {formatBillingMonth(selectedMonth)}</h2>
        <div className="bill-dealer-list">
          {dealers.filter((d) => d.dealer?.status === 'active').map((summary) => (
            <Link
              key={summary.dealerId}
              to={`/admin/billing/dealer/${summary.dealerId}`}
              className="bill-dealer-card"
            >
              <div className="bill-dealer-card__head">
                <div>
                  <p className="bill-dealer-card__name">{summary.dealer?.name}</p>
                  <p className="bill-dealer-card__city">{summary.dealer?.city}</p>
                </div>
                <div>
                  <span className="bill-dealer-active">Aktiv</span>
                  <div style={{ marginTop: 8 }}>
                    <PaymentStatusBadge status={summary.status} />
                  </div>
                </div>
              </div>
              <dl className="bill-dealer-card__stats">
                <div className="bill-dealer-card__stat">
                  <dt>Plattform</dt>
                  <dd><BillingMoney amount={summary.platformFee} compact /></dd>
                </div>
                <div className="bill-dealer-card__stat">
                  <dt>Verkäufe</dt>
                  <dd>{summary.salesCount}</dd>
                </div>
                <div className="bill-dealer-card__stat">
                  <dt>Provision</dt>
                  <dd><BillingMoney amount={summary.successFees} compact /></dd>
                </div>
                <div className="bill-dealer-card__stat">
                  <dt>Gesamt</dt>
                  <dd><BillingMoney amount={summary.total} compact /></dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>

        <h2 className="bill-section-title">Analytics</h2>
        <div className="bill-analytics-grid">
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Provisionen gesamt</p>
            <p className="bill-kpi-card__value">{formatMoney(analytics.totalProvision)}</p>
          </article>
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Ø Provision</p>
            <p className="bill-kpi-card__value">{formatMoney(analytics.avgProvision)}</p>
          </article>
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Bestätigungsquote</p>
            <p className="bill-kpi-card__value">{analytics.confirmRate}%</p>
          </article>
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Ø Bestätigung nach Auslieferung</p>
            <p className="bill-kpi-card__value">{analytics.avgDeliveryConfirmDays} Tage</p>
          </article>
        </div>

        {analytics.topDealers.length > 0 && (
          <>
            <h2 className="bill-section-title" style={{ marginTop: 28 }}>Top Händler</h2>
            <div className="bill-dealer-list">
              {analytics.topDealers.map((row) => (
                <div key={row.dealerId} className="bill-dealer-card" style={{ cursor: 'default' }}>
                  <div className="bill-dealer-card__head">
                    <p className="bill-dealer-card__name">{row.dealer?.name ?? row.dealerId}</p>
                    <BillingMoney amount={row.amount} />
                  </div>
                  <p className="bill-dealer-card__city">{row.sales} bestätigte Verkäufe</p>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="bill-future-note">
          Vorbereitet, noch nicht aktiv: Stripe, SEPA-Lastschrift, PDF-Rechnungen, DATEV-Export, Lexoffice.
        </p>
      </div>
    </PageShell>
  );
}
