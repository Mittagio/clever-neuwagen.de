import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { DOMAIN_STRUCTURE } from '../../data/rolesConfig.js';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchProgress,
  LaunchCard,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminLaunchPage() {
  const { getLaunchChecklist } = useLaunchAdmin();
  const checklist = getLaunchChecklist();

  usePageSeo({
    title: 'Launch-Checkliste',
    description: 'Produktivstatus und Launch-Bereitschaft Clever-Neuwagen.',
    path: '/admin/launch',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader
          title="Produktivstatus"
          subtitle="Nach Sprint 4 wird nicht mehr entwickelt – es wird getestet."
        />
        <LaunchAdminNav />

        <LaunchProgress percent={checklist.percent} label={`${checklist.percent} % Launchbereit`} />
        <p style={{ marginBottom: 24 }}>
          {checklist.launchReady ? (
            <span className="launch-ready-badge">✓ Launchbereit</span>
          ) : (
            <span className="launch-ready-badge is-pending">
              {checklist.doneCount}/{checklist.totalCount} Punkte erfüllt
            </span>
          )}
        </p>

        {checklist.sections.map((section) => (
          <section key={section.id} className="launch-checklist-section">
            <h2 className="launch-checklist-section__title">{section.title}</h2>
            <ul className="launch-checklist">
              {section.items.map((item) => (
                <li key={item.id} className={`launch-checklist__item${item.done ? ' is-done' : ''}`}>
                  <span>{item.done ? '✓' : '○'}</span>
                  <span>{item.label}</span>
                  {item.note && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#86868b' }}>{item.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <LaunchCard>
          <p className="launch-card__title">Domain-Struktur (Vorbereitung)</p>
          <ul className="launch-checklist">
            {Object.values(DOMAIN_STRUCTURE).map((d) => (
              <li key={d.host} className="launch-checklist__item is-done">
                <span>{d.label}</span>
                <code style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{d.url}</code>
              </li>
            ))}
            <li className="launch-checklist__item">
              <span>Händler-Subdomains</span>
              <code style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>*.clever-neuwagen.de</code>
            </li>
          </ul>
        </LaunchCard>

        <p className="launch-future">
          Ziel: Autohaus Trinkle führt den ersten echten Verkaufsprozess vollständig über Clever-Neuwagen durch – ohne Medienbruch.
        </p>
      </div>
    </PageShell>
  );
}
