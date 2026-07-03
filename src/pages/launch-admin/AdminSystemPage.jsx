import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
  SystemSeverityChip,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import { SECURITY_BASELINE, SECURITY_STATUS_LABELS } from '../../data/securityConfig.js';
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
    path: '/admin/launch/system',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="Fehlercenter" subtitle="Fehler, Warnungen und Systemstatus." />
        <LaunchAdminNav />

        <LaunchCard>
          <p className="launch-card__title">Sicherheits-Grundlagen (Sprint 5)</p>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
            {SECURITY_BASELINE.map((item) => (
              <li key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <strong>{item.label}</strong>
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#64748b' }}>
                  {SECURITY_STATUS_LABELS[item.status]}
                </span>
                <p className="launch-card__sub" style={{ marginTop: 4 }}>{item.detail}</p>
              </li>
            ))}
          </ul>
        </LaunchCard>

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
