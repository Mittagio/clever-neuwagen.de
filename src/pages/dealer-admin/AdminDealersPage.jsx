import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { formatMoney } from '../../data/billingConfig.js';
import {
  AdminOperatorNav,
  OperatorPageHeader,
  DealerStatusBadge,
} from '../../components/dealer-admin/DealerAdminShared.jsx';
import '../../components/dealer-admin/DealerAdminShared.css';

export default function AdminDealersPage() {
  const { dealers, countModelsForDealer, getBrandLabels } = useDealerAdmin();

  usePageSeo({
    title: 'Händlerverwaltung',
    description: 'Zentrale Händlerübersicht für Clever-Neuwagen Betreiber.',
    path: '/admin/dealers',
  });

  const sorted = [...dealers].sort((a, b) => {
    const order = { active: 0, review: 1, draft: 2, blocked: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <PageShell className="admin-shell">
      <div className="dop-page">
        <OperatorPageHeader
          title="Händlerverwaltung"
          subtitle="Welche Händler aktiv sind, welche Marken sie nutzen und wie sie performen."
        />
        <AdminOperatorNav />

        <div className="dop-dealer-grid">
          {sorted.map((dealer) => (
            <Link key={dealer.id} to={`/admin/dealers/${dealer.id}`} className="dop-dealer-card">
              <p className="dop-dealer-card__name">{dealer.companyName}</p>
              <DealerStatusBadge status={dealer.status} />
              <dl className="dop-dealer-card__stats">
                <div className="dop-dealer-card__stat">
                  <dt>Marken</dt>
                  <dd>{getBrandLabels(dealer)}</dd>
                </div>
                <div className="dop-dealer-card__stat">
                  <dt>Modelle</dt>
                  <dd>{countModelsForDealer(dealer)}</dd>
                </div>
                <div className="dop-dealer-card__stat">
                  <dt>Verkaufschancen</dt>
                  <dd>{dealer.stats.leads}</dd>
                </div>
                <div className="dop-dealer-card__stat">
                  <dt>Angebote</dt>
                  <dd>{dealer.stats.offers}</dd>
                </div>
                <div className="dop-dealer-card__stat">
                  <dt>Verkäufe</dt>
                  <dd>{dealer.stats.sales}</dd>
                </div>
                <div className="dop-dealer-card__stat">
                  <dt>Monatsumsatz</dt>
                  <dd>{formatMoney(dealer.stats.monthlyRevenue)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
