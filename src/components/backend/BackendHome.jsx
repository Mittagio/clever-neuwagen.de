import { Link } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { computeBackendTodayStats } from '../../logic/backendTodayStats.js';
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

const QUICK_ACTIONS = [
  { label: 'Verkaufsassistent', icon: '✨', href: '/verkaufsassistent', desc: 'Kundenwunsch erfassen & auswerten' },
  { label: 'Neue Verkaufschance', icon: '👤', href: '/sales', desc: 'Kia-Katalog & Kunde erfassen' },
  { label: 'Neues Angebot', icon: '📄', href: '/backend/angebote', state: { openCreate: true }, desc: 'Angebot erstellen' },
  { label: 'Fahrzeug veröffentlichen', icon: '📢', href: '/backend/publishing', desc: 'Marketing & Inserate' },
  { label: 'Gesprächsmodus', icon: '🎤', href: '/gespraech', desc: 'Live mit Kundenwünschen' },
];

export default function BackendHome({ conditions }) {
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { getDueToday } = useCommunication();

  const today = computeBackendTodayStats(leads, offers);
  const dueToday = getDueToday();

  const counts = {
    newLeads: today.newLeads,
    openOffers: today.openOffers,
    testDrives: today.testDrives,
    deliveries: today.deliveries,
  };

  return (
    <div className="backend-home">
      <header className="backend-home__hero backend-home__hero--compact">
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

      <section className="backend-home__section backend-home__section--muted" aria-labelledby="quick-heading">
        <h3 id="quick-heading" className="backend-home__section-title backend-home__section-title--muted">
          Schnellaktionen
        </h3>
        <div className="backend-home__quick-grid backend-home__quick-grid--compact">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              state={action.state}
              className="backend-home__quick"
            >
              <span className="backend-home__quick-icon" aria-hidden="true">{action.icon}</span>
              <span className="backend-home__quick-label">{action.label}</span>
              <span className="backend-home__quick-desc">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
