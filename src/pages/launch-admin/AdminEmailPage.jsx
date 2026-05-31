import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchCard,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminEmailPage() {
  const { emailTemplates } = useLaunchAdmin();

  usePageSeo({
    title: 'E-Mail System',
    description: 'Systemmail-Vorlagen Clever-Neuwagen.',
    path: '/admin/email',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader
          title="E-Mail System"
          subtitle="Systemmails verwalten – Vorbereitung für produktiven Versand."
        />
        <LaunchAdminNav />

        {emailTemplates.map((tpl) => (
          <LaunchCard key={tpl.id}>
            <p className="launch-card__title">{tpl.name}</p>
            <p className="launch-card__sub">Betreff: {tpl.subject}</p>
            <div className="launch-email-preview">{tpl.preview}</div>
            <div className="launch-vars">
              {tpl.variables.map((v) => (
                <span key={v} className="launch-var">{v}</span>
              ))}
            </div>
          </LaunchCard>
        ))}

        <p className="launch-future">
          Produktiver E-Mail-Versand (SMTP/Resend) wird beim VPS-Deploy aktiviert. Variablen: {'{{kunde}}'}, {'{{fahrzeug}}'}, {'{{haendler}}'}, {'{{angebot}}'}, {'{{rate}}'}.
        </p>
      </div>
    </PageShell>
  );
}
