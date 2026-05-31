import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
  SystemSeverityChip,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminSystemPage() {
  const { systemIssues, resolveSystemIssue } = useLaunchAdmin();

  const sorted = [...systemIssues].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });

  usePageSeo({
    title: 'Fehlercenter',
    description: 'Systemfehler, Warnungen und Logs.',
    path: '/admin/system',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="Fehlercenter" subtitle="Fehler, Warnungen und Systemstatus." />
        <LaunchAdminNav />

        {sorted.map((issue) => (
          <LaunchCard key={issue.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p className="launch-card__title">{issue.title}</p>
                <p className="launch-card__sub">{issue.detail}</p>
              </div>
              <SystemSeverityChip type={issue.type} />
            </div>
            {issue.type !== 'ok' && (
              <button type="button" className="launch-btn launch-btn--secondary" style={{ marginTop: 10 }} onClick={() => resolveSystemIssue(issue.id)}>
                Als behoben markieren
              </button>
            )}
          </LaunchCard>
        ))}
      </div>
    </PageShell>
  );
}
