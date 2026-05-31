import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
  RoleBadge,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

function formatDate(iso) {
  return new Date(iso).toLocaleString('de-DE');
}

export default function AdminAuditPage() {
  const { auditLog } = useLaunchAdmin();

  usePageSeo({
    title: 'Audit Log',
    description: 'Änderungsprotokoll Clever-Neuwagen.',
    path: '/admin/audit',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="Audit Log" subtitle="Wer · Wann · Was geändert hat." />
        <LaunchAdminNav />

        <ul className="launch-checklist" style={{ listStyle: 'none', padding: 0 }}>
          {auditLog.map((entry) => (
            <li key={entry.id}>
              <LaunchCard>
                <div className="launch-table-card">
                  <div>
                    <p className="launch-card__title">{entry.actor}</p>
                    <p className="launch-card__sub">{entry.action}</p>
                  </div>
                  <RoleBadge roleId={entry.actorRole} />
                  <span className="launch-kpi__hint">{formatDate(entry.createdAt)}</span>
                </div>
              </LaunchCard>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
