import { useMemo } from 'react';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { formatMoney } from '../../data/billingConfig.js';
import {
  AlPageHeader,
  AlDealerCard,
} from '../../components/admin/leitstand/AdminLeitstandShell.jsx';
import '../../components/admin/leitstand/adminLeitstand.css';

function formatLastLogin(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'heute';
  return d.toLocaleDateString('de-DE');
}

function computeConversion(dealer) {
  const leads = dealer.stats?.leads ?? 0;
  const sales = dealer.stats?.sales ?? 0;
  if (!leads) return '–';
  return `${((sales / leads) * 100).toFixed(1).replace('.', ',')} %`;
}

export default function AdminHaendlerPage() {
  const { dealers, getBrandLabels } = useDealerAdmin();
  const { users } = useLaunchAdmin();

  usePageSeo({
    title: 'Admin · Händler',
    description: 'Händler-KPIs im Clever Leitstand.',
    path: '/admin/haendler',
  });

  const sorted = useMemo(() => [...dealers].sort((a, b) => {
    const order = { active: 0, review: 1, draft: 2, blocked: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  }), [dealers]);

  function lastLoginForDealer(dealerId) {
    const dealerUsers = users.filter((u) => u.dealerId === dealerId);
    const latest = dealerUsers
      .map((u) => u.lastLogin)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    return formatLastLogin(latest);
  }

  return (
    <>
      <AlPageHeader
        title="Händler"
        subtitle={`${sorted.filter((d) => d.status === 'active').length} aktiv · ${sorted.length} gesamt`}
      />

      {sorted.map((dealer) => (
        <AlDealerCard
          key={dealer.id}
          dealer={dealer}
          brands={getBrandLabels(dealer)}
          conversion={computeConversion(dealer)}
          provision={formatMoney(dealer.stats?.monthlyRevenue ?? 0)}
          lastLogin={lastLoginForDealer(dealer.id)}
          to={`/admin/dealers/${dealer.id}`}
        />
      ))}
    </>
  );
}
