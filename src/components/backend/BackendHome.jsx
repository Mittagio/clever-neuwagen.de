import { Link } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { computeBackendTodayStats } from '../../logic/backendTodayStats.js';
import {
  countMissingLeasingFactors,
  formatPublishedAt,
} from '../../data/dealerConditionsSchema.js';
import './BackendHome.css';

const TODAY_TILES = [
  {
    key: 'newLeads',
    label: 'Neue Verkaufschancen',
    hint: 'Noch nicht bearbeitet',
    href: '/communication',
    filter: 'neu',
    accent: '#2563eb',
  },
  {
    key: 'openOffers',
    label: 'Offene Angebote',
    hint: 'Entwurf & versendet',
    href: '/offers',
    accent: '#7c3aed',
  },
  {
    key: 'testDrives',
    label: 'Probefahrten',
    hint: 'Termine & Anfragen',
    href: '/communication',
    filter: 'probefahrt',
    accent: '#0d9488',
  },
  {
    key: 'deliveries',
    label: 'Auslieferungen',
    hint: 'Bestellung & Übergabe',
    href: '/communication',
    filter: 'bestellung',
    accent: '#16a34a',
  },
];

const QUICK_ACTIONS = [
  { label: 'Neue Verkaufschance', icon: '👤', href: '/sales', desc: 'Kunde erfassen' },
  { label: 'Neues Angebot', icon: '📄', href: '/offers', state: { openCreate: true }, desc: 'Angebot erstellen' },
  { label: 'Fahrzeug veröffentlichen', icon: '📢', href: '/backend/publishing', desc: 'Marketing & Inserate' },
  { label: 'Dealer AI', icon: '🤖', href: '/dealer-ai', desc: 'KI-Verkaufsassistent', primary: true },
];

export default function BackendHome({ conditions, onNavigate }) {
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { getKpis, getDueToday } = useCommunication();

  const today = computeBackendTodayStats(leads, offers);
  const kpis = getKpis();
  const dueToday = getDueToday();

  const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
  const missingLf = activeModels.reduce(
    (sum, m) => sum + countMissingLeasingFactors(conditions, m.id),
    0,
  );

  const counts = {
    newLeads: today.newLeads,
    openOffers: today.openOffers,
    testDrives: today.testDrives,
    deliveries: today.deliveries,
  };

  return (
    <div className="backend-home">
      <header className="backend-home__hero">
        <p className="backend-home__eyebrow">Guten Tag</p>
        <h2 className="backend-home__title">{conditions.dealerName}</h2>
        <p className="backend-home__subtitle">
          Hier sehen Sie auf einen Blick, was heute ansteht.
        </p>
      </header>

      <section className="backend-home__section" aria-labelledby="today-heading">
        <h3 id="today-heading" className="backend-home__section-title">
          Heute im Autohaus
        </h3>
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
            ⏰ {dueToday.length} Wiedervorlage{dueToday.length !== 1 ? 'n' : ''} heute –{' '}
            <Link to="/communication">öffnen</Link>
          </p>
        )}
      </section>

      <section className="backend-home__section" aria-labelledby="quick-heading">
        <h3 id="quick-heading" className="backend-home__section-title">
          Schnellaktionen
        </h3>
        <div className="backend-home__quick-grid">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              state={action.state}
              className={`backend-home__quick${action.primary ? ' backend-home__quick--primary' : ''}`}
            >
              <span className="backend-home__quick-icon" aria-hidden="true">{action.icon}</span>
              <span className="backend-home__quick-label">{action.label}</span>
              <span className="backend-home__quick-desc">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="backend-home__ai" aria-labelledby="ai-heading">
        <div className="backend-home__ai-card">
          <div className="backend-home__ai-copy">
            <p id="ai-heading" className="backend-home__ai-eyebrow">Dealer AI</p>
            <h3 className="backend-home__ai-title">
              Angebot, Text & nächster Schritt – in Sekunden
            </h3>
            <p className="backend-home__ai-desc">
              Die KI kennt Ihre Konditionen, Verkaufschancen und Fahrzeuge. Ideal für Erstkontakt,
              Angebotsmail und Nachfassen.
            </p>
            <div className="backend-home__ai-actions">
              <Link to="/dealer-ai" className="backend-home__ai-cta">
                Dealer AI öffnen
              </Link>
              <Link to="/communication" className="backend-home__ai-secondary">
                Kommunikation
              </Link>
            </div>
          </div>
          <span className="backend-home__ai-visual" aria-hidden="true">🤖</span>
        </div>
      </section>

      <section className="backend-home__section backend-home__kpis" aria-labelledby="kpi-heading">
        <h3 id="kpi-heading" className="backend-home__section-title backend-home__section-title--muted">
          Kennzahlen
        </h3>
        <div className="backend-home__kpi-grid">
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{today.inProgress}</span>
            <span className="backend-home__kpi-label">Verkaufschancen in Bearbeitung</span>
          </div>
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{kpis.emailsSent}</span>
            <span className="backend-home__kpi-label">E-Mails (Session)</span>
          </div>
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{kpis.offersSent}</span>
            <span className="backend-home__kpi-label">Angebote versendet</span>
          </div>
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{activeModels.length}</span>
            <span className="backend-home__kpi-label">Aktive Modelle</span>
          </div>
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{missingLf}</span>
            <span className="backend-home__kpi-label">Fehlende LF-Zellen</span>
          </div>
          <div className="backend-home__kpi">
            <span className="backend-home__kpi-value">{kpis.conversionRate}%</span>
            <span className="backend-home__kpi-label">Conversion</span>
          </div>
        </div>
        <p className="backend-home__kpi-meta">
          Zuletzt veröffentlicht: {formatPublishedAt(conditions.lastPublishedAt)}
          {' · '}
          <button type="button" className="backend-home__kpi-link" onClick={() => onNavigate?.('fahrzeuge', 'publish')}>
            Konditionen online schalten
          </button>
        </p>
      </section>
    </div>
  );
}
