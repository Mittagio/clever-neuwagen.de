import { Link } from 'react-router-dom';
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
import CleverLexikon from './CleverLexikon.jsx';
import './BackendHome.css';

const TODAY_TILES = [
  {
    key: 'newLeads',
    label: 'Neue Verkaufschancen',
    hint: 'Noch nicht bearbeitet',
    href: '/backend/verkaufschancen',
    filter: 'neu',
    accent: '#2563eb',
  },
  {
    key: 'openOffers',
    label: 'Offene Angebote',
    hint: 'Entwurf & versendet',
    href: '/backend/angebote',
    accent: '#7c3aed',
  },
  {
    key: 'testDrives',
    label: 'Probefahrten',
    hint: 'Termine & Anfragen',
    href: '/backend/verkaufschancen',
    filter: 'probefahrt',
    accent: '#0d9488',
  },
  {
    key: 'deliveries',
    label: 'Auslieferungen',
    hint: 'Bestellung & Übergabe',
    href: '/backend/verkaufschancen',
    filter: 'bestellung',
    accent: '#16a34a',
  },
];

export default function BackendHome({ conditions }) {
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
    openOffers: today.openOffers,
    testDrives: today.testDrives,
    deliveries: today.deliveries,
  };

  return (
    <div className="backend-home">
      <section className="backend-home__advisor-hero" aria-labelledby="advisor-hero-title">
        <div className="backend-home__advisor-hero-inner">
          <p className="backend-home__advisor-badge">NEU · DIGITALER VERKAUFSBERATER</p>
          <h2 id="advisor-hero-title" className="backend-home__advisor-title">
            Unser digitaler Verkaufsberater
          </h2>
          <p className="backend-home__advisor-subline">
            Kundenwünsche per Sprache, Text oder Klick erfassen –
            und in Sekunden zur Verkaufschance machen.
          </p>
          <div className="backend-home__advisor-actions">
            <Link to="/verkaufsassistent" className="backend-home__advisor-btn backend-home__advisor-btn--primary">
              Verkaufsassistent öffnen
            </Link>
            <Link
              to="/verkaufsassistent"
              state={{ focusText: true }}
              className="backend-home__advisor-btn backend-home__advisor-btn--secondary"
            >
              Text / E-Mail einfügen
            </Link>
          </div>
          <p className="backend-home__advisor-trust">
            Ideal für Kundengespräch, E-Mail, WhatsApp, Telefonnotiz und Showroom-Beratung.
          </p>
        </div>
        <span className="backend-home__advisor-visual" aria-hidden="true">✨</span>
      </section>

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
            <Link to="/communication" className="backend-home__coach-cta">
              {hotFollowUp.cta}
            </Link>
          </article>
        )}
        <div className="backend-home__today-grid">
          {TODAY_TILES.map((tile) => (
            <Link
              key={tile.key}
              to={tile.href}
              state={tile.filter ? { filter: tile.filter } : undefined}
              className="backend-home__today-tile"
              style={{ '--tile-accent': tile.accent }}
            >
              <span className="backend-home__today-value">{counts[tile.key]}</span>
              <span className="backend-home__today-label">{tile.label}</span>
              <span className="backend-home__today-hint">{tile.hint}</span>
            </Link>
          ))}
        </div>
        {dueToday.length > 0 && (
          <p className="backend-home__reminder">
            🔥 {dueToday.length} Chance{dueToday.length !== 1 ? 'n' : ''} heute heiß –{' '}
            <Link to="/communication">Nachfassen</Link>
          </p>
        )}
      </section>

      <CleverLexikon />
    </div>
  );
}
