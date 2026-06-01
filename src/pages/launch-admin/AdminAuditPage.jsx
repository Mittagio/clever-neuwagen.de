import { useMemo, useState } from 'react';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { SPRINT5_AUDIT_TYPES } from '../../services/sprint5Audit.js';
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

const FILTER_OPTIONS = [
  { id: 'all', label: 'Alle' },
  { id: SPRINT5_AUDIT_TYPES.document_uploaded, label: 'Dokument hochgeladen' },
  { id: SPRINT5_AUDIT_TYPES.document_deleted, label: 'Dokument gelöscht' },
  { id: SPRINT5_AUDIT_TYPES.selbstauskunft_created, label: 'Selbstauskunft' },
  { id: SPRINT5_AUDIT_TYPES.compliance_error, label: 'Compliance' },
  { id: SPRINT5_AUDIT_TYPES.vehicle_published, label: 'Veröffentlicht' },
];

export default function AdminAuditPage() {
  const { auditLog } = useLaunchAdmin();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return auditLog;
    return auditLog.filter((e) => e.type === filter);
  }, [auditLog, filter]);

  usePageSeo({
    title: 'Audit Log',
    description: 'Änderungsprotokoll Clever-Neuwagen.',
    path: '/admin/audit',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader
          title="Audit Log"
          subtitle="Dokumente, Selbstauskunft, Compliance, Veröffentlichungen."
        />
        <LaunchAdminNav />

        <div className="launch-nav" style={{ marginBottom: 16 }}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`launch-nav__link${filter === opt.id ? ' is-active' : ''}`}
              style={{ border: 'none', cursor: 'pointer', background: filter === opt.id ? '#eef2ff' : 'transparent' }}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <ul className="launch-checklist" style={{ listStyle: 'none', padding: 0 }}>
          {filtered.map((entry) => (
            <li key={entry.id}>
              <LaunchCard>
                <div className="launch-table-card">
                  <div>
                    <p className="launch-card__title">{entry.actor}</p>
                    <p className="launch-card__sub">{entry.action}</p>
                    {entry.type && (
                      <p className="launch-kpi__hint" style={{ marginTop: 4 }}>{entry.type}</p>
                    )}
                  </div>
                  <RoleBadge roleId={entry.actorRole} />
                  <span className="launch-kpi__hint">{formatDate(entry.createdAt)}</span>
                </div>
              </LaunchCard>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="launch-kpi__hint">Keine Einträge für diesen Filter.</p>
        )}
      </div>
    </PageShell>
  );
}
