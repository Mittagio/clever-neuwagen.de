import { Link } from 'react-router-dom';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { KPI_TILES, getDueTodayLeadIds } from '../../logic/backendKpiNavigation.js';
import { computeBackendTodayStats } from '../../logic/backendTodayStats.js';

function resolveKpiValue(tile, stats, leads, dueTodayLeadIds) {
  switch (tile.key) {
    case 'needsOffer':
      return stats.needsOffer;
    case 'followUp':
      return leads.filter((lead) => dueTodayLeadIds.has(lead.id)).length
        || leads.filter((l) => l.status === 'angebotVersendet' || l.status === 'rueckfrageOffen').length;
    case 'openedOffers':
      return stats.openedOffers;
    case 'newLeads':
      return stats.newLeads;
    default:
      return 0;
  }
}

export default function BackendHomeToday({ leads = [] }) {
  const { offers } = useOffers();
  const { getDueToday } = useCommunication();
  const dueToday = getDueToday?.() ?? [];
  const dueTodayLeadIds = getDueTodayLeadIds(dueToday);
  const stats = computeBackendTodayStats(leads, offers);

  return (
    <section className="backend-home__today" aria-labelledby="backend-home-today-title">
      <h2 id="backend-home-today-title" className="backend-home__section-title">
        Heute im Autohaus
      </h2>

      <div className="backend-home__kpi-grid">
        {KPI_TILES.map((tile) => {
          const value = resolveKpiValue(tile, stats, leads, dueTodayLeadIds);
          return (
            <Link
              key={tile.key}
              to={tile.to}
              className="backend-home__kpi"
              aria-label={tile.ariaLabel}
            >
              <span className="backend-home__kpi-value">{value}</span>
              <span className="backend-home__kpi-label">{tile.dashboardLabel ?? tile.label}</span>
            </Link>
          );
        })}
      </div>
      <p className="backend-home__kpi-meta">Kurzüberblick für den Verkaufstag.</p>
    </section>
  );
}
