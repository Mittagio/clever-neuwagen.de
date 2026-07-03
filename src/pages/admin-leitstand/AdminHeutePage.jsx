import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { useDealerRegistration } from '../../context/DealerRegistrationContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { useBilling } from '../../context/BillingContext.jsx';
import { usePriceListImport } from '../../context/PriceListImportContext.jsx';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { listLearningRequests } from '../../services/admin/cleverLearningRequestService.js';
import {
  AlPageHeader,
  AlKpiTile,
  AlSection,
  AlTimeline,
} from '../../components/admin/leitstand/AdminLeitstandShell.jsx';
import '../../components/admin/leitstand/adminLeitstand.css';
import { computeTodayKpis, formatProvisionEuro } from '../../services/admin/leitstand/adminTodayKpis.js';
import { buildAdminTaskQueue } from '../../services/admin/leitstand/adminTaskQueue.js';
import { buildAdminTimeline } from '../../services/admin/leitstand/adminActivityFeed.js';
import { getAdminLeitstandState, subscribeAdminLeitstand } from '../../services/admin/leitstand/adminLeitstandStore.js';

export default function AdminHeutePage() {
  const { dealers, approvals, activities } = useDealerAdmin();
  const { applications } = useDealerRegistration();
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { deliveries, invoices } = useBilling();
  const { getMetrics } = usePriceListImport();
  const { auditLog } = useLaunchAdmin();
  const importMetrics = getMetrics();
  const [leitstand, setLeitstand] = useState(getAdminLeitstandState);

  useEffect(() => subscribeAdminLeitstand(setLeitstand), []);

  usePageSeo({
    title: 'Admin · Heute',
    description: 'Clever-Neuwagen Leitstand – Was heute passiert.',
    path: '/admin',
  });

  const tasks = useMemo(() => buildAdminTaskQueue({
    approvals,
    importMetrics,
    applications,
    systemIssues: [],
    learningRequests: listLearningRequests({ status: 'open' }),
  }), [approvals, importMetrics, applications]);

  const kpis = useMemo(() => computeTodayKpis({
    dealers,
    applications,
    leads,
    offers,
    deliveries,
    invoices,
    tasks,
  }), [dealers, applications, leads, offers, deliveries, invoices, tasks]);

  const timeline = useMemo(() => buildAdminTimeline({
    activityFeed: leitstand.activityFeed,
    dealerActivities: activities,
    auditLog,
    limit: 12,
  }), [leitstand.activityFeed, activities, auditLog]);

  return (
    <>
      <AlPageHeader
        title="Heute"
        subtitle={new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        action={(
          <Link to="/admin/aufgaben" className="al-btn al-btn--ghost">
            {kpis.openProblems > 0 ? `⚠ ${kpis.openProblems} Probleme` : 'Aufgaben →'}
          </Link>
        )}
      />

      <div className="al-kpi-grid">
        <AlKpiTile emoji="🟢" value={kpis.activeDealers} label="Aktive Händler" hint={`${kpis.totalDealers} gesamt`} to="/admin/haendler" />
        <AlKpiTile emoji="🆕" value={kpis.onboardedToday} label="Heute onboardet" to="/admin/onboarding" />
        <AlKpiTile emoji="👥" value={kpis.leadsToday} label="Neue Leads" />
        <AlKpiTile emoji="📄" value={kpis.offersToday} label="Angebote heute" />
        <AlKpiTile emoji="🚗" value={kpis.salesToday} label="Verkäufe" to="/admin/deliveries" />
        <AlKpiTile emoji="💰" value={formatProvisionEuro(kpis.provisionToday)} label="Heutige Provision" to="/admin/billing" />
        <AlKpiTile
          emoji="⚠"
          value={kpis.openProblems}
          label="Offene Probleme"
          tone={kpis.openProblems > 0 ? 'warn' : 'default'}
          to="/admin/aufgaben"
        />
      </div>

      <AlSection title="Live-Timeline">
        <AlTimeline items={timeline} />
      </AlSection>
    </>
  );
}
