import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { DOMAIN_STRUCTURE } from '../../data/rolesConfig.js';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
  UserStatusChip,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminDomainsPage() {
  const { domains, toggleDomainStatus } = useLaunchAdmin();

  usePageSeo({
    title: 'Subdomain Manager',
    description: 'Händler-Domains und SSL-Status.',
    path: '/admin/domains',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader title="Subdomain Manager" subtitle="Händler-Domains für Produktivbetrieb." />
        <LaunchAdminNav />

        <LaunchCard>
          <p className="launch-card__title">Plattform-Domains</p>
          {Object.values(DOMAIN_STRUCTURE).map((d) => (
            <p key={d.host} className="launch-card__sub">{d.label}: <code>{d.url}</code></p>
          ))}
        </LaunchCard>

        <h2 className="launch-checklist-section__title">Händler-Subdomains</h2>
        {domains.map((dom) => (
          <LaunchCard key={dom.id}>
            <div className="launch-table-card">
              <div>
                <p className="launch-card__title">{dom.dealerName}</p>
                <p className="launch-card__sub">https://{dom.host}</p>
              </div>
              <UserStatusChip status={dom.ssl ? 'active' : 'invited'} />
              <UserStatusChip status={dom.status === 'active' ? 'active' : 'disabled'} />
            </div>
            <div className="launch-header__actions">
              <button type="button" className="launch-btn launch-btn--secondary" onClick={() => toggleDomainStatus(dom.id)}>
                {dom.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
              </button>
              <button type="button" className="launch-btn launch-btn--secondary" disabled>
                Domain erstellen (VPS)
              </button>
            </div>
          </LaunchCard>
        ))}

        <p className="launch-future">
          SSL via Let&apos;s Encrypt beim VPS-Deploy. Wildcard-Zertifikat für *.clever-neuwagen.de erforderlich.
        </p>
      </div>
    </PageShell>
  );
}
