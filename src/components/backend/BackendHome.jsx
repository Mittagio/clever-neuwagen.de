import { Link, useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
} from '../../services/crm/customerSearchService.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import BackendCustomerSearch from './BackendCustomerSearch.jsx';
import BackendRecentCustomers from './BackendRecentCustomers.jsx';
import './BackendHome.css';

export default function BackendHome() {
  const navigate = useNavigate();
  const { leads } = useLeads();

  function handleOpenCustomerRecord(leadId) {
    const { action, leadId: resolvedId } = resolveCustomerOpenAction(leadId, leads);
    if (action !== 'open' || !resolvedId) return;
    const lead = leads.find((item) => item.id === resolvedId);
    if (lead) recordRecentCustomerOpen(lead);
    navigate(buildKundenaktePath(resolvedId));
  }

  return (
    <div className="backend-home backend-home--calm">
      <section className="backend-home__advisor-hero" aria-labelledby="advisor-hero-title">
        <div className="backend-home__advisor-hero-inner">
          <h2 id="advisor-hero-title" className="backend-home__advisor-title">
            Was möchten Sie tun?
          </h2>
          <p className="backend-home__advisor-subline">
            Kunde finden oder neuen Verkaufsfall starten.
          </p>

          <BackendCustomerSearch
            leads={leads}
            onOpenCustomerRecord={handleOpenCustomerRecord}
            variant="hero"
          />

          <div className="backend-home__advisor-actions">
            <Link to="/verkaufsassistent" className="backend-home__advisor-btn backend-home__advisor-btn--primary">
              Verkaufsassistent starten
            </Link>
          </div>
        </div>
      </section>

      <BackendRecentCustomers
        leads={leads}
        onOpenCustomerRecord={handleOpenCustomerRecord}
      />
    </div>
  );
}
