import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { APPROVAL_TYPES } from '../../data/dealerRegistry.js';
import {
  AdminOperatorNav,
  OperatorPageHeader,
  ApprovalActions,
} from '../../components/dealer-admin/DealerAdminShared.jsx';
import '../../components/dealer-admin/DealerAdminShared.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminApprovalsPage() {
  const { approvals, approveItem, rejectItem, getPendingApprovals } = useDealerAdmin();
  const pending = getPendingApprovals();
  const resolved = approvals.filter((a) => a.status !== 'pending');

  usePageSeo({
    title: 'Approval Center',
    description: 'Freigaben für Händler, Preislisten, Rabatte und Marken.',
    path: '/admin/approvals',
  });

  return (
    <PageShell className="admin-shell">
      <div className="dop-page">
        <OperatorPageHeader
          title="Approval Center"
          subtitle="Das Herzstück der Plattformsteuerung – alle Freigaben an einem Ort."
        />
        <AdminOperatorNav />

        <h2 className="dop-section__title">Offene Freigaben ({pending.length})</h2>
        <div className="dop-section">
          {pending.length === 0 && (
            <p className="dop-kpi__hint">Keine offenen Freigaben. Alles erledigt.</p>
          )}
          {pending.map((item) => {
            const typeLabel = APPROVAL_TYPES[item.type]?.label ?? item.type;
            return (
              <article key={item.id} className="dop-approval-card">
                <p className="dop-kpi__label">{typeLabel}</p>
                <p className="dop-approval-card__title">{item.title}</p>
                <p className="dop-approval-card__sub">{item.subtitle}</p>
                <p className="dop-kpi__hint">{formatDate(item.createdAt)}</p>

                {item.meta?.warning && (
                  <p className="dop-warning">⚠ Auffällig hoher Rabatt – Admin prüfen</p>
                )}

                <ApprovalActions
                  onApprove={() => approveItem(item.id)}
                  onReject={() => rejectItem(item.id)}
                  extra={
                    item.type === 'pricelist' ? (
                      <Link to="/admin/import" className="dop-btn dop-btn--ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        🔍 Details anzeigen
                      </Link>
                    ) : null
                  }
                />

                {item.type === 'pricelist' && (
                  <p className="dop-kpi__hint" style={{ marginTop: 10 }}>
                    ✓ Übernehmen · ✕ Verwerfen über Preislisten-Import
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {resolved.length > 0 && (
          <>
            <h2 className="dop-section__title">Erledigt</h2>
            <div className="dop-section">
              {resolved.slice(0, 5).map((item) => (
                <article key={item.id} className="dop-detail-card">
                  <p className="dop-approval-card__title">{item.title}</p>
                  <p className="dop-kpi__hint">{item.status === 'approved' ? '✓ Freigegeben' : '✕ Abgelehnt'}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
