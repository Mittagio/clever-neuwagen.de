import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { formatBillingMonth, formatMoney, BILLING_CONFIG } from '../../data/billingConfig.js';
import { getDealerById } from '../../logic/billingEngine.js';
import {
  AdminBillingNav,
  BillingPageHeader,
  BillingMoney,
  PaymentStatusBadge,
} from '../../components/billing/BillingShared.jsx';
import { Link } from 'react-router-dom';
import '../../components/billing/BillingShared.css';

const STATUS_ACTIONS = [
  { status: 'paid', label: 'Als bezahlt markieren' },
  { status: 'open', label: 'Als offen markieren' },
  { status: 'reminder', label: 'Erinnerung senden' },
  { status: 'dunning', label: 'Mahnung setzen' },
];

export default function AdminInvoicesPage() {
  const { invoices, updateInvoiceStatus, generateAllInvoices } = useBilling();

  usePageSeo({
    title: 'Rechnungen',
    description: 'Händlerrechnungen mit Plattformgebühr und Erfolgsprovisionen.',
    path: '/admin/invoices',
  });

  const sorted = [...invoices].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <BillingPageHeader
          title="Rechnungen"
          subtitle="Automatisch erzeugte Rechnungen – transparent für Admin und Händler."
          actions={(
            <button type="button" className="bill-btn bill-btn--primary" onClick={() => generateAllInvoices()}>
              Fehlende Rechnungen erzeugen
            </button>
          )}
        />
        <AdminBillingNav />

        <div className="bill-list">
          {sorted.length === 0 && (
            <p className="bill-delivery-card__meta">Noch keine Rechnungen. „Rechnungen generieren“ im Dashboard.</p>
          )}
          {sorted.map((inv) => {
            const dealer = getDealerById(inv.dealerId);
            return (
              <article key={inv.id} className="bill-invoice-card">
                <p className="bill-invoice-card__number">{inv.invoiceNumber}</p>
                <p className="bill-invoice-card__dealer">{dealer?.name ?? inv.dealerId}</p>
                <p className="bill-delivery-card__meta">{formatBillingMonth(inv.month)}</p>

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
                  <div className="bill-invoice-card__row">
                    <span>MwSt. ({Math.round(BILLING_CONFIG.vatRate * 100)}%)</span>
                    <span>{formatMoney(inv.vat)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <PaymentStatusBadge status={inv.status} />
                  {inv.paidAt && (
                    <span className="bill-delivery-card__meta">
                      Bezahlt: {new Date(inv.paidAt).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STATUS_ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      className="bill-btn bill-btn--secondary"
                      style={{ minHeight: 36, fontSize: '0.75rem', padding: '0 12px' }}
                      onClick={() => updateInvoiceStatus(inv.id, action.status)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <Link
                  to={`/admin/billing/dealer/${inv.dealerId}`}
                  className="bill-header__link"
                  style={{ display: 'inline-block', marginTop: 12, fontSize: '0.8125rem' }}
                >
                  Händler-Detail →
                </Link>
              </article>
            );
          })}
        </div>

        <p className="bill-future-note">
          PDF-Rechnung, Stripe, SEPA und DATEV-Export sind vorbereitet und werden in einem späteren Sprint aktiviert.
        </p>
      </div>
    </PageShell>
  );
}
