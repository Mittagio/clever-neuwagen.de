import { Link, useParams } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { formatBillingMonth, formatMoney, BILLING_CONFIG, DELIVERY_STATUS } from '../../data/billingConfig.js';
import {
  AdminBillingNav,
  BillingPageHeader,
  BillingMoney,
  PaymentStatusBadge,
} from '../../components/billing/BillingShared.jsx';
import '../../components/billing/BillingShared.css';

export default function AdminBillingDealerPage() {
  const { id } = useParams();
  const { selectedMonth, getDealerDetail, generateInvoice, getInvoicesForDealer } = useBilling();
  const detail = getDealerDetail(id);
  const invoices = getInvoicesForDealer(id);

  usePageSeo({
    title: detail.dealer?.name ? `Abrechnung ${detail.dealer.name}` : 'Händler-Abrechnung',
    description: 'Händler-Detailabrechnung mit Plattformgebühr und Erfolgsprovisionen.',
    path: `/admin/billing/dealer/${id}`,
  });

  if (!detail.dealer) {
    return (
      <PageShell>
        <div className="bill-page">
          <p>Händler nicht gefunden.</p>
          <Link to="/admin/billing">← Zurück</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <BillingPageHeader
          title={detail.dealer.name}
          subtitle={`${formatBillingMonth(selectedMonth)} · ${detail.dealer.city}`}
          backTo="/admin/billing"
          actions={(
            <button type="button" className="bill-btn bill-btn--secondary" onClick={() => generateInvoice(id)}>
              Rechnung erzeugen
            </button>
          )}
        />
        <AdminBillingNav />

        <div className="bill-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Plattformgebühr</p>
            <p className="bill-kpi-card__value">{formatMoney(detail.platformFee)}</p>
          </article>
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Verkäufe</p>
            <p className="bill-kpi-card__value">{detail.salesCount}</p>
          </article>
        </div>

        <h2 className="bill-section-title">Verkäufe & Provisionen</h2>
        <div className="bill-sale-list">
          {detail.sales.length === 0 && (
            <p className="bill-delivery-card__meta">Keine bestätigten Verkäufe in diesem Monat.</p>
          )}
          {detail.sales.map((sale, index) => (
            <article key={sale.id} className="bill-sale-card">
              <div className="bill-sale-card__head">
                <div>
                  <p className="bill-sale-card__meta">{index + 1}.</p>
                  <p className="bill-sale-card__vehicle">{sale.vehicle}</p>
                  <p className="bill-sale-card__meta">{sale.customerName}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="bill-sale-card__meta">Provision</p>
                  <p className="bill-sale-card__vehicle"><BillingMoney amount={sale.provisionAmount} compact /></p>
                  <p className="bill-sale-card__meta">
                    {DELIVERY_STATUS[sale.status]?.label ?? sale.status}
                  </p>
                </div>
              </div>
              {sale.leadId && (
                <Link to="/communication" className="bill-header__link" style={{ fontSize: '0.8125rem' }}>
                  Verkaufschance nachvollziehen →
                </Link>
              )}
            </article>
          ))}
        </div>

        <article className="bill-total-card">
          <p className="bill-total-card__label">Gesamt {formatBillingMonth(selectedMonth)}</p>
          <p className="bill-total-card__value">{formatMoney(detail.total)}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', opacity: 0.75 }}>
            zzgl. {Math.round(BILLING_CONFIG.vatRate * 100)}% MwSt.
          </p>
          <div style={{ marginTop: 12 }}>
            <PaymentStatusBadge status={detail.status} />
          </div>
        </article>

        {invoices.length > 0 && (
          <>
            <h2 className="bill-section-title" style={{ marginTop: 28 }}>Rechnungen</h2>
            <div className="bill-list">
              {invoices.map((inv) => (
                <article key={inv.id} className="bill-invoice-card">
                  <p className="bill-invoice-card__number">{inv.invoiceNumber}</p>
                  <p className="bill-invoice-card__dealer">{formatBillingMonth(inv.month)}</p>
                  <div className="bill-invoice-card__rows">
                    <div className="bill-invoice-card__row">
                      <span>Plattformgebühr</span>
                      <BillingMoney amount={inv.platformFee} />
                    </div>
                    <div className="bill-invoice-card__row">
                      <span>Erfolgsprovision</span>
                      <BillingMoney amount={inv.successFees} />
                    </div>
                    <div className="bill-invoice-card__row">
                      <strong>Gesamt</strong>
                      <strong><BillingMoney amount={inv.amount} /></strong>
                    </div>
                  </div>
                  <PaymentStatusBadge status={inv.status} />
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
