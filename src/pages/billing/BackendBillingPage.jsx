import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { formatBillingMonth, formatMoney, BILLING_CONFIG } from '../../data/billingConfig.js';
import {
  BillingMoney,
  PaymentStatusBadge,
} from '../../components/billing/BillingShared.jsx';
import '../../components/billing/BillingShared.css';

const CURRENT_DEALER_ID = 'autohaus-trinkle';

export default function BackendBillingPage() {
  const {
    selectedMonth,
    getDealerDetail,
    getInvoicesForDealer,
  } = useBilling();

  const detail = getDealerDetail(CURRENT_DEALER_ID);
  const invoices = getInvoicesForDealer(CURRENT_DEALER_ID);
  const currentInvoice = invoices.find((inv) => inv.month === selectedMonth);

  usePageSeo({
    title: 'Meine Abrechnung',
    description: 'Händler-Abrechnungsübersicht: Rechnungen, Provisionen und Plattformgebühr.',
    path: '/backend/billing',
  });

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <header className="bill-header">
          <div className="bill-header__top">
            <Link to="/backend" className="bill-header__back">← Backend</Link>
          </div>
          <p className="bill-header__kicker">Händlerportal</p>
          <h1 className="bill-header__title">Abrechnung</h1>
          <p className="bill-header__sub">
            {detail.dealer?.name} · {formatBillingMonth(selectedMonth)}
          </p>
        </header>

        <h2 className="bill-section-title">Aktuelle Rechnung</h2>
        {currentInvoice ? (
          <article className="bill-invoice-card">
            <p className="bill-invoice-card__number">{currentInvoice.invoiceNumber}</p>
            <div className="bill-invoice-card__rows">
              <div className="bill-invoice-card__row">
                <span>Plattformgebühr</span>
                <BillingMoney amount={currentInvoice.platformFee} />
              </div>
              <div className="bill-invoice-card__row">
                <span>Erfolgsprovision ({detail.salesCount} Verkäufe)</span>
                <BillingMoney amount={currentInvoice.successFees} />
              </div>
              <div className="bill-invoice-card__row">
                <strong>Gesamt</strong>
                <strong><BillingMoney amount={currentInvoice.amount} /></strong>
              </div>
              <div className="bill-invoice-card__row">
                <span>zzgl. MwSt.</span>
                <span>{formatMoney(currentInvoice.vat)}</span>
              </div>
            </div>
            <PaymentStatusBadge status={currentInvoice.status} />
          </article>
        ) : (
          <article className="bill-kpi-card">
            <p className="bill-kpi-card__label">Offener Betrag (Vorschau)</p>
            <p className="bill-kpi-card__value">{formatMoney(detail.total)}</p>
            <p className="bill-kpi-card__hint">Rechnung wird vom Admin erzeugt.</p>
          </article>
        )}

        <h2 className="bill-section-title" style={{ marginTop: 28 }}>Verkaufsprovisionen</h2>
        <div className="bill-sale-list">
          {detail.sales.map((sale, i) => (
            <article key={sale.id} className="bill-sale-card">
              <p className="bill-sale-card__vehicle">{i + 1}. {sale.vehicle}</p>
              <p className="bill-sale-card__meta">
                {sale.customerName} · Provision <BillingMoney amount={sale.provisionAmount} compact />
              </p>
            </article>
          ))}
        </div>

        <article className="bill-total-card" style={{ marginTop: 24 }}>
          <p className="bill-total-card__label">Plattformgebühr monatlich</p>
          <p className="bill-total-card__value">{formatMoney(BILLING_CONFIG.platformFeeMonthly)}</p>
        </article>

        <h2 className="bill-section-title" style={{ marginTop: 28 }}>Rechnungsarchiv</h2>
        <div className="bill-list">
          {invoices.length === 0 && (
            <p className="bill-delivery-card__meta">Noch keine Rechnungen im Archiv.</p>
          )}
          {invoices.map((inv) => (
            <article key={inv.id} className="bill-delivery-card">
              <p className="bill-delivery-card__name">{inv.invoiceNumber}</p>
              <p className="bill-delivery-card__meta">{formatBillingMonth(inv.month)}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <BillingMoney amount={inv.amount} />
                <PaymentStatusBadge status={inv.status} />
              </div>
            </article>
          ))}
        </div>

        <p className="bill-future-note">
          Volle Transparenz: Jede Provision ist einem bestätigten Kundenverkauf zugeordnet.
          Bei Fragen wenden Sie sich an info@clever-neuwagen.de
        </p>
      </div>
    </PageShell>
  );
}
