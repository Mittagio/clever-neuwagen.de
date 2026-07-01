import { useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
} from '../../services/crm/customerSearchService.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import BackendAdvisorHero from './BackendAdvisorHero.jsx';
import BackendCustomerSearch from './BackendCustomerSearch.jsx';
import BackendMainTiles from './BackendMainTiles.jsx';
import './BackendHome.css';

export default function BackendHome({ onNavigateArea }) {
  const navigate = useNavigate();
  const { leads } = useLeads();

  function handleOpenCustomerRecord(leadId) {
    const { action, leadId: resolvedId } = resolveCustomerOpenAction(leadId, leads);
    if (action !== 'open' || !resolvedId) return;
    const lead = leads.find((item) => item.id === resolvedId);
    if (lead) recordRecentCustomerOpen(lead);
    navigate(buildKundenaktePath(resolvedId));
  }

  function handleNavigateArea(areaId, sectionId) {
    if (onNavigateArea) {
      onNavigateArea(areaId, sectionId);
      return;
    }
    if (areaId === 'fahrzeuge') {
      navigate('/backend/fahrzeuge');
    }
  }

  return (
    <div className="backend-home backend-home--calm">
      <BackendMainTiles onNavigateArea={handleNavigateArea} />

      <BackendAdvisorHero />

      <BackendCustomerSearch
        leads={leads}
        onOpenCustomerRecord={handleOpenCustomerRecord}
        variant="standalone"
      />
    </div>
  );
}
