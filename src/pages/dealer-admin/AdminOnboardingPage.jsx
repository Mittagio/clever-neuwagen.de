import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerRegistration } from '../../context/DealerRegistrationContext.jsx';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import {
  REGISTRATION_STATUS,
  REGISTRATION_STATUS_PIPELINE,
} from '../../data/dealerRegistration.js';
import { formatRegistrationSummary, getPackageById } from '../../logic/dealerRegistration.js';
import RegistrationStatusBadge from '../../components/sprint6/RegistrationStatusBadge.jsx';
import {
  AdminOperatorNav,
  OperatorPageHeader,
  KpiCard,
} from '../../components/dealer-admin/DealerAdminShared.jsx';
import '../../components/dealer-admin/DealerAdminShared.css';

export default function AdminOnboardingPage() {
  const {
    applications,
    advanceApplicationStatus,
    rejectApplication,
  } = useDealerRegistration();
  const { getDealer } = useDealerAdmin();

  usePageSeo({
    title: 'Händler-Onboarding',
    description: 'Self-Service-Registrierungen prüfen und freigeben.',
    path: '/admin/onboarding',
  });

  const sorted = [...applications].sort(
    (a, b) => new Date(b.updatedAt ?? b.submittedAt ?? 0) - new Date(a.updatedAt ?? a.submittedAt ?? 0),
  );

  const statusCounts = Object.keys(REGISTRATION_STATUS)
    .filter((k) => k !== 'rejected')
    .reduce((acc, key) => {
      acc[key] = applications.filter((a) => a.status === key).length;
      return acc;
    }, {});

  return (
    <PageShell className="admin-shell">
      <div className="dop-page">
        <OperatorPageHeader
          title="Händler-Onboarding"
          subtitle="Self-Service-Registrierungen von /partner/register – vom Entwurf bis Live."
          actions={(
            <Link to="/partner/register" className="dop-btn dop-btn--ghost" style={{ textDecoration: 'none' }}>
              Registrierung öffnen →
            </Link>
          )}
        />
        <AdminOperatorNav />

        <div className="dop-kpi-grid" style={{ marginBottom: 24 }}>
          {REGISTRATION_STATUS_PIPELINE.map((s) => (
            <KpiCard
              key={s.id}
              label={s.label}
              value={statusCounts[s.id] ?? 0}
            />
          ))}
        </div>

        <div className="dop-section">
          <h2 className="dop-section__title">Registrierungsanträge</h2>
          {sorted.length === 0 && (
            <p className="dop-kpi__hint">
              Noch keine Anträge. Händler können sich unter{' '}
              <Link to="/partner/register">/partner/register</Link> selbst anmelden.
            </p>
          )}
          {sorted.map((app) => {
            const { name, contact } = formatRegistrationSummary(app);
            const pkg = getPackageById(app.packageId);
            const dealer = getDealer(app.slug);
            const canAdvance = app.status !== 'live' && app.status !== 'rejected';

            return (
              <article key={app.id} className="dop-onboarding-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="dop-dealer-card__name" style={{ margin: 0, fontSize: '1.0625rem' }}>
                      {name}
                    </h3>
                    <p className="dop-kpi__hint">
                      {contact} · {app.contact.email}
                      {app.submittedAt && (
                        <> · Eingereicht {new Date(app.submittedAt).toLocaleDateString('de-DE')}</>
                      )}
                    </p>
                    <p className="dop-kpi__hint" style={{ marginTop: 4 }}>
                      Paket: {pkg.name} · Marken: {app.brands?.join(', ') ?? '–'}
                      {app.slug && <> · <code>{app.slug}</code></>}
                    </p>
                  </div>
                  <RegistrationStatusBadge status={app.status} />
                </div>

                <div className="dop-onboarding-steps">
                  {REGISTRATION_STATUS_PIPELINE.map((step) => {
                    const stepOrder = REGISTRATION_STATUS[step.id]?.order ?? 0;
                    const currentOrder = REGISTRATION_STATUS[app.status]?.order ?? -1;
                    const isDone = currentOrder >= stepOrder && app.status !== 'rejected';
                    const isCurrent = app.status === step.id;
                    return (
                      <span
                        key={step.id}
                        className={`dop-onboarding-step${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                      >
                        {step.label}
                      </span>
                    );
                  })}
                </div>

                <div className="dop-approval-actions" style={{ marginTop: 12 }}>
                  {canAdvance && (
                    <button
                      type="button"
                      className="dop-btn dop-btn--approve"
                      onClick={() => advanceApplicationStatus(app.id)}
                    >
                      → Nächster Status
                    </button>
                  )}
                  {app.status !== 'rejected' && app.status !== 'live' && (
                    <button
                      type="button"
                      className="dop-btn dop-btn--reject"
                      onClick={() => rejectApplication(app.id)}
                    >
                      Ablehnen
                    </button>
                  )}
                  {dealer && (
                    <Link
                      to={`/admin/dealers/${dealer.id}`}
                      className="dop-btn dop-btn--ghost"
                      style={{ textDecoration: 'none' }}
                    >
                      Händlerprofil
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
