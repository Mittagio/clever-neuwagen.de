import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { DELIVERY_STATUS, formatMoney } from '../../data/billingConfig.js';
import { getDealerById } from '../../logic/billingEngine.js';
import DeliveryFlowSteps from '../../components/delivery/DeliveryFlowSteps.jsx';
import {
  AdminBillingNav,
  BillingPageHeader,
} from '../../components/billing/BillingShared.jsx';
import '../../components/billing/BillingShared.css';

function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminDeliveriesPage() {
  const { deliveries, invoices } = useBilling();
  const { leads, resendDeliveryConfirmation, resendVoucherEmail } = useLeads();
  const [busyId, setBusyId] = useState(null);

  usePageSeo({
    title: 'Auslieferungen',
    description: 'Auslieferungsbestätigungen und Provisionsfreigabe verwalten.',
    path: '/admin/deliveries',
  });

  const sorted = [...deliveries].sort(
    (a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate),
  );

  function getLeadDelivery(leadId) {
    const lead = leads.find((l) => l.id === leadId);
    return lead?.deliveryConfirmation ?? null;
  }

  function invoiceLinked(delivery) {
    return invoices.some((inv) => inv.deliveryIds?.includes(delivery.id));
  }

  async function handleRetryDelivery(leadId) {
    setBusyId(leadId);
    await resendDeliveryConfirmation(leadId);
    setBusyId(null);
  }

  async function handleRetryVoucher(leadId) {
    setBusyId(leadId);
    await resendVoucherEmail(leadId);
    setBusyId(null);
  }

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <BillingPageHeader
          title="Auslieferungsbestätigungen"
          subtitle="Kunde → Bestätigung → Gutschein → Provision – ohne Medienbruch."
        />
        <AdminBillingNav />

        <div className="bill-list">
          {sorted.map((item) => {
            const dealer = getDealerById(item.dealerId);
            const statusLabel = DELIVERY_STATUS[item.status]?.label ?? item.status;
            const dc = item.leadId ? getLeadDelivery(item.leadId) : null;
            const canRetryDelivery = dc && (dc.emailError || dc.status === 'error');
            const canRetryVoucher = dc?.rewards?.selectedPartnerId && dc?.voucher?.status !== 'sent';

            return (
              <article key={item.id} className="bill-delivery-card">
                <div className="bill-delivery-card__head">
                  <div>
                    <p className="bill-delivery-card__name">{item.customerName}</p>
                    <p className="bill-delivery-card__vehicle">{item.vehicle}</p>
                  </div>
                  {item.status === 'provisionReleased' ? (
                    <span className="bill-status bill-status--success">🟢 {statusLabel}</span>
                  ) : item.status === 'voucherPending' ? (
                    <span className="bill-status bill-status--warning">🟡 Gutschein ausstehend</span>
                  ) : item.status === 'error' ? (
                    <span className="bill-status bill-status--danger">🔴 Fehler</span>
                  ) : item.status === 'pending' || item.status === 'sent' ? (
                    <span className="bill-status bill-status--warning">🟡 {statusLabel}</span>
                  ) : (
                    <span className="bill-status">{statusLabel}</span>
                  )}
                </div>
                <p className="bill-delivery-card__meta">{dealer?.name ?? item.dealerId}</p>
                <p className="bill-delivery-card__meta">
                  Auslieferung: {formatDate(item.deliveryDate)}
                  {item.confirmedAt && ` · Bestätigt: ${formatDate(item.confirmedAt)}`}
                </p>
                {item.voucherCode && (
                  <p className="bill-delivery-card__meta">
                    Gutschein: {item.voucherPartner} · {item.voucherCode}
                  </p>
                )}
                {(item.billingStatus === 'billable' || item.status === 'provisionReleased') && (
                  <p className="bill-delivery-card__meta bill-delivery-card__billable">
                    ✓ Provision {formatMoney(item.provisionAmount)} – abrechenbar
                  </p>
                )}

                {dc && (
                  <div style={{ marginTop: 12 }}>
                    <DeliveryFlowSteps
                      deliveryConfirmation={dc}
                      invoiceLinked={invoiceLinked(item)}
                      compact
                    />
                  </div>
                )}

                <div className="bill-delivery-card__actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {canRetryDelivery && item.leadId && (
                    <button
                      type="button"
                      className="bill-btn bill-btn--secondary"
                      disabled={busyId === item.leadId}
                      onClick={() => handleRetryDelivery(item.leadId)}
                    >
                      Bestätigungs-E-Mail erneut
                    </button>
                  )}
                  {canRetryVoucher && item.leadId && (
                    <button
                      type="button"
                      className="bill-btn bill-btn--secondary"
                      disabled={busyId === item.leadId}
                      onClick={() => handleRetryVoucher(item.leadId)}
                    >
                      Gutschein erneut senden
                    </button>
                  )}
                  {item.leadId && (
                    <Link to="/communication" className="bill-header__link" style={{ fontSize: '0.8125rem', alignSelf: 'center' }}>
                      Verkaufschance öffnen →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="bill-future-note">
          E-Mail-Versand via Mock-Adapter (Dev) oder Resend (VITE_EMAIL_PROVIDER=resend).
          Mock-Logs: localStorage „clever-neuwagen-email-log“.
        </aside>
      </div>
    </PageShell>
  );
}
