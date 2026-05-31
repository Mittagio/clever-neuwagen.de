import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { BACKUP_PREP } from '../../data/rolesConfig.js';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminBackupPage() {
  const { backups, createBackup, downloadBackup } = useLaunchAdmin();

  usePageSeo({
    title: 'Backup',
    description: 'Backup & Wiederherstellung Clever-Neuwagen.',
    path: '/admin/backup',
  });

  function handleCreate() {
    createBackup();
  }

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="Backup & Wiederherstellung" subtitle="Lokale Backups – Cloud vorbereitet." />
        <LaunchAdminNav />

        <div className="launch-header__actions">
          <button type="button" className="launch-btn launch-btn--primary" onClick={handleCreate}>
            Backup erstellen
          </button>
        </div>

        <h2 className="launch-checklist-section__title">Backups</h2>
        {backups.map((bak) => (
          <LaunchCard key={bak.id}>
            <div className="launch-table-card">
              <div>
                <p className="launch-card__title">{bak.label}</p>
                <p className="launch-kpi__hint">{bak.size} · {bak.type}</p>
              </div>
              <button type="button" className="launch-btn launch-btn--secondary" onClick={() => downloadBackup(bak.id)}>
                Herunterladen
              </button>
            </div>
          </LaunchCard>
        ))}

        <p className="launch-future">
          Vorbereitet: {BACKUP_PREP.map((b) => b.label).join(', ')}. Wiederherstellung importiert JSON-Backup in localStorage (Demo).
        </p>
      </div>
    </PageShell>
  );
}
