import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { ONBOARDING_PIPELINE } from '../../data/dealerRegistry.js';
import {
  AdminOperatorNav,
  OperatorPageHeader,
  DealerStatusBadge,
} from '../../components/dealer-admin/DealerAdminShared.jsx';
import '../../components/dealer-admin/DealerAdminShared.css';

export default function AdminOnboardingPage() {
  const { getOnboardingDealers, advanceOnboarding } = useDealerAdmin();
  const dealers = getOnboardingDealers();

  usePageSeo({
    title: 'Händler-Onboarding',
    description: 'Onboarding-Pipeline für neue Händlerpartner.',
    path: '/admin/onboarding',
  });

  return (
    <PageShell className="admin-shell">
      <div className="dop-page">
        <OperatorPageHeader
          title="Händler-Onboarding"
          subtitle="Vom Registrierungseingang bis zur Live-Schaltung."
        />
        <AdminOperatorNav />

        <div className="dop-section">
          {dealers.length === 0 && (
            <p className="dop-kpi__hint">Alle Händler sind live. Keine laufenden Onboardings.</p>
          )}
          {dealers.map((dealer) => (
            <article key={dealer.id} className="dop-onboarding-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Link to={`/admin/dealers/${dealer.id}`} className="dop-dealer-card__name" style={{ textDecoration: 'none', color: 'inherit' }}>
                    {dealer.companyName}
                  </Link>
                  <p className="dop-kpi__hint">{dealer.contactPerson} · {dealer.email}</p>
                </div>
                <DealerStatusBadge status={dealer.status} />
              </div>

              <div className="dop-onboarding-steps">
                {ONBOARDING_PIPELINE.map((step) => {
                  const isDone = dealer.onboardingStep >= step.id;
                  const isCurrent = dealer.onboardingStep + 1 === step.id
                    || (dealer.onboardingStep === step.id && step.id < 5);
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

              {dealer.onboardingStep < 5 && (
                <button
                  type="button"
                  className="dop-btn dop-btn--ghost"
                  onClick={() => advanceOnboarding(dealer.id)}
                >
                  Nächster Schritt →
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
