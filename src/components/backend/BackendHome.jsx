import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import {
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
} from '../../services/crm/customerSearchService.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import { buildDashboardTodayRecommendations } from '../../services/journey/buildDashboardTodayRecommendations.js';
import CleverEmpfiehltToday from './CleverEmpfiehltToday.jsx';
import BackendCustomerSearch from './BackendCustomerSearch.jsx';
import BackendMainTiles from './BackendMainTiles.jsx';
import './BackendHome.css';

export default function BackendHome({ onNavigateArea }) {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const composerCtx = useCleverComposerOptional();
  const composerSlotRef = useRef(null);

  const cleverTodayItems = useMemo(
    () => buildDashboardTodayRecommendations(leads, { maxItems: 10 }),
    [leads],
  );

  useEffect(() => {
    const register = composerCtx?.registerComposerHeroSlot;
    if (typeof register !== 'function') return undefined;
    register(composerSlotRef.current);
    return () => register(null);
  }, [composerCtx?.registerComposerHeroSlot]);

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
      <header className="backend-home__greeting" aria-label="Begrüßung">
        <h1 className="backend-home__greeting-title">Guten Tag.</h1>
        <p className="backend-home__greeting-sub">Was soll Clever heute für dich erledigen?</p>
      </header>

      <div
        ref={composerSlotRef}
        className="backend-home__composer-slot"
        data-testid="composer-hero-slot"
      />

      <BackendMainTiles onNavigateArea={handleNavigateArea} leads={leads} />

      <CleverEmpfiehltToday items={cleverTodayItems} />

      <BackendCustomerSearch
        leads={leads}
        onOpenCustomerRecord={handleOpenCustomerRecord}
        variant="standalone"
      />
    </div>
  );
}
