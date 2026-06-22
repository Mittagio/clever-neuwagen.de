import { Link, useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { computeBackendTodayStats } from '../../logic/backendTodayStats.js';
import {
  computeDailyCoachFromLeads,
  getDailyGoalProgress,
  getDailyMotivation,
  getFollowUpCoachCard,
} from '../../services/cleverSalesCoach.js';
import {
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
} from '../../services/crm/customerSearchService.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import CleverLexikon from './CleverLexikon.jsx';
import DealerAppLegalMenu from '../dealer/DealerAppLegalMenu.jsx';
import BackendCustomerSearch from './BackendCustomerSearch.jsx';
import BackendRecentCustomers from './BackendRecentCustomers.jsx';
import { KPI_TILES } from '../../logic/backendKpiNavigation.js';
import './BackendHome.css';

export default function BackendHome() {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { getDueToday } = useCommunication();

  const today = computeBackendTodayStats(leads, offers);
  const dueToday = getDueToday();
  const dailyCoach = computeDailyCoachFromLeads(leads, dueToday);
  const dailyMotivation = getDailyMotivation({
    dueTodayCount: dueToday.length,
    hotOffers: today.openOffers,
    newLeads: today.newLeadsToday,
  });
  const dailyGoal = getDailyGoalProgress({
    callbacksDone: dailyCoach.callbacksDone,
    callbacksGoal: dailyCoach.callbacksGoal,
    offersSentToday: today.openOffersToday,
  });
  const hotFollowUp = dueToday[0]
    ? getFollowUpCoachCard({
      nextStepId: 'call_today',
      pipelineStatusId: 'nachfassen',
      offers: [],
      followUpAt: dueToday[0].dueAt,
    })
    : null;

  const counts = {
    newLeads: today.newLeads,
    needsOffer: today.needsOffer,
    followUp: dueToday.length,
    openedOffers: today.openedOffers,
  };

  function handleOpenCustomerRecord(leadId) {
    const { action, leadId: resolvedId } = resolveCustomerOpenAction(leadId, leads);
    if (action !== 'open' || !resolvedId) return;
    const lead = leads.find((item) => item.id === resolvedId);
    if (lead) recordRecentCustomerOpen(lead);
    navigate(buildKundenaktePath(resolvedId));
  }

  return (
    <div className="backend-home">
      <section className="backend-home__advisor-hero" aria-labelledby="advisor-hero-title">
        <div className="backend-home__advisor-hero-inner">
          <h2 id="advisor-hero-title" className="backend-home__advisor-title">
            Unser digitaler Verkaufsberater
          </h2>
          <p className="backend-home__advisor-subline">
            Kundenwünsche erfassen, Kundenakten finden und Chancen weiterbearbeiten.
          </p>

          <div className="backend-home__advisor-actions">
            <Link to="/verkaufsassistent" className="backend-home__advisor-btn backend-home__advisor-btn--primary">
              Verkaufsassistent öffnen
            </Link>
          </div>

          <BackendCustomerSearch
            leads={leads}
            onOpenCustomerRecord={handleOpenCustomerRecord}
            variant="hero"
          />
        </div>
        <span className="backend-home__advisor-visual" aria-hidden="true">✨</span>
      </section>

      <BackendRecentCustomers
        leads={leads}
        onOpenCustomerRecord={handleOpenCustomerRecord}
      />

      <section className="backend-home__section" aria-labelledby="today-heading">
        <div className="backend-home__today-head">
          <h3 id="today-heading" className="backend-home__section-title">
            Heute im Autohaus
          </h3>
          <p className="backend-home__today-motivation">{dailyMotivation.headline}</p>
          <p className="backend-home__today-greeting">{dailyMotivation.subline}</p>
        </div>

        <div className="backend-home__daily-goal" aria-label="Tagesziel">
          <div className="backend-home__daily-goal-head">
            <span className="backend-home__daily-goal-label">Tagesziel</span>
            <span className="backend-home__daily-goal-pct">{dailyGoal.pct} %</span>
          </div>
          <div
            className="backend-home__daily-goal-bar"
            role="progressbar"
            aria-valuenow={dailyGoal.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${dailyGoal.pct}%` }} />
          </div>
          <p className="backend-home__daily-goal-text">{dailyGoal.label}</p>
          <p className="backend-home__daily-goal-sub">{dailyGoal.progress}</p>
        </div>

        {hotFollowUp && dueToday.length > 0 && (
          <article className="backend-home__coach-card">
            <h4 className="backend-home__coach-title">{hotFollowUp.title}</h4>
            <p className="backend-home__coach-text">{hotFollowUp.text}</p>
            <Link to="/backend/verkaufschancen?filter=followup" className="backend-home__coach-cta">
              {hotFollowUp.cta}
            </Link>
          </article>
        )}
        <div className="backend-home__today-grid">
          {KPI_TILES.map((tile) => (
            <Link
              key={tile.key}
              to={tile.to}
              aria-label={tile.ariaLabel}
              className="backend-home__today-tile"
              style={{ '--tile-accent': tile.accent }}
            >
              <span className="backend-home__today-chevron" aria-hidden>›</span>
              <span className="backend-home__today-value">{counts[tile.key]}</span>
              <span className="backend-home__today-label">{tile.dashboardLabel ?? tile.label}</span>
              <span className="backend-home__today-hint">{tile.hint}</span>
            </Link>
          ))}
        </div>
        {dueToday.length > 0 && (
          <p className="backend-home__reminder">
            🔥 {dueToday.length} Chance{dueToday.length !== 1 ? 'n' : ''} heute heiß –{' '}
            <Link to="/backend/verkaufschancen?filter=followup">Nachfassen</Link>
          </p>
        )}
      </section>

      <CleverLexikon />

      <DealerAppLegalMenu compact className="backend-home__legal" />
    </div>
  );
}
