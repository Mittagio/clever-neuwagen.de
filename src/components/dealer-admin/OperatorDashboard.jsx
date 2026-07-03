import { Link } from 'react-router-dom';
import { useOperatorKpis } from '../../context/DealerAdminContext.jsx';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { usePriceListImport } from '../../context/PriceListImportContext.jsx';
import { KpiCard } from '../dealer-admin/DealerAdminShared.jsx';

export default function OperatorDashboard() {
  const { getMetrics } = usePriceListImport();
  const importMetrics = getMetrics();
  const kpis = useOperatorKpis(importMetrics);
  const { getPendingApprovals } = useDealerAdmin();
  const pendingCount = getPendingApprovals().length;

  const cards = [
    { label: 'Aktive Händler', value: kpis.activeDealers, hint: `${kpis.totalDealers} gesamt` },
    { label: 'Neue Händler', value: kpis.newDealers, hint: 'Letzte 30 Tage' },
    { label: 'Offene Freigaben', value: kpis.pendingApprovals, hint: pendingCount ? 'Handeln erforderlich' : 'Alles erledigt' },
    { label: 'Offene Preislisten', value: kpis.pendingPriceLists, hint: 'Import-Center' },
    { label: 'Offene Rechnungen', value: kpis.openInvoices, hint: 'Abrechnung' },
    { label: 'Aktive Marken', value: kpis.activeBrands },
    { label: 'Aktive Modelle', value: kpis.activeModels },
  ];

  return (
    <section className="dop-operator-dash">
      <header className="dop-operator-dash__head">
        <div>
          <h2 className="admin-section-title">Betreiber-Cockpit</h2>
          <p className="admin-section-desc">
            In 30 Sekunden: Was läuft, wo fehlen Freigaben, wo muss eingegriffen werden?
          </p>
        </div>
        <Link to="/admin/haendler" className="admin-header-link">Händlerverwaltung →</Link>
      </header>

      <div className="dop-kpi-grid">
        {cards.map((c) => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>

      <div className="dop-operator-dash__links">
        <Link to="/admin/approvals" className="dop-operator-dash__link">
          🔔 Approval Center
          {pendingCount > 0 && <span className="dop-operator-dash__badge">{pendingCount}</span>}
        </Link>
        <Link to="/admin/onboarding" className="dop-operator-dash__link">🚀 Onboarding</Link>
        <Link to="/admin/billing" className="dop-operator-dash__link">💶 Abrechnung</Link>
        <Link to="/admin/datenpruefung" className="dop-operator-dash__link">🔍 Datenprüfung</Link>
        <Link to="/admin/import" className="dop-operator-dash__link">📋 Preislisten</Link>
        <Link to="/admin/launch" className="dop-operator-dash__link">🚀 Launch Readiness</Link>
        <Link to="/admin/pilot" className="dop-operator-dash__link">🏁 Pilot Trinkle</Link>
      </div>
    </section>
  );
}
