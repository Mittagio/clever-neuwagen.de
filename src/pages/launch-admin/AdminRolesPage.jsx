import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { ROLES, getPermissionsForRole, SECURITY_PREP } from '../../data/rolesConfig.js';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
  UserStatusChip,
  RoleBadge,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

function formatLogin(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE');
}

export default function AdminRolesPage() {
  const { users, setUserStatus } = useLaunchAdmin();

  usePageSeo({
    title: 'Rollen & Rechte',
    description: 'Benutzerrollen und Rechteverwaltung Clever-Neuwagen.',
    path: '/admin/roles',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader
          title="Benutzerrollen & Rechte"
          subtitle="Super Admin, Händler Admin, Verkäufer, Kunde."
        />
        <LaunchAdminNav />

        <h2 className="launch-checklist-section__title">Rollenmodell</h2>
        {Object.values(ROLES).map((role) => (
          <LaunchCard key={role.id}>
            <p className="launch-card__title">{role.label}</p>
            <p className="launch-card__sub">{role.description}</p>
            <p className="launch-kpi__hint">
              {getPermissionsForRole(role.id).length} Berechtigungen
            </p>
          </LaunchCard>
        ))}

        <h2 className="launch-checklist-section__title" style={{ marginTop: 28 }}>Sicherheit (Vorbereitung)</h2>
        <p className="launch-kpi__hint" style={{ marginBottom: 12 }}>
          Architektur vorbereitet – noch nicht im Livebetrieb aktiviert.
        </p>
        {SECURITY_PREP.map((item) => (
          <LaunchCard key={item.id}>
            <div className="launch-table-card">
              <p className="launch-card__title">{item.label}</p>
              <span className="launch-chip launch-chip--warning">Geplant</span>
            </div>
          </LaunchCard>
        ))}

        <h2 className="launch-checklist-section__title" style={{ marginTop: 28 }}>Benutzer</h2>
        {users.map((user) => (
          <LaunchCard key={user.id}>
            <div className="launch-table-card">
              <div>
                <p className="launch-card__title">{user.name}</p>
                <p className="launch-card__sub">{user.email}</p>
              </div>
              <RoleBadge roleId={user.role} />
              <UserStatusChip status={user.status} />
              <span className="launch-kpi__hint">{formatLogin(user.lastLogin)}</span>
            </div>
            {user.status === 'invited' && (
              <button type="button" className="launch-btn launch-btn--secondary" style={{ marginTop: 10 }} onClick={() => setUserStatus(user.id, 'active')}>
                Aktivieren
              </button>
            )}
          </LaunchCard>
        ))}
      </div>
    </PageShell>
  );
}
