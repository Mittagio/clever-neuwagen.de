import { Link } from 'react-router-dom';
import { useCleverInboxOptional } from '../../context/CleverInboxContext.jsx';
import { buildInboxDashboardSummary } from '../../services/crm/cleverInboxService.js';
import './BackendHome.css';

const MAIN_TILES = [
  {
    id: 'inbox',
    kind: 'link',
    to: '/backend/clever-eingang',
    title: 'Clever Eingang',
    subtitle: 'Neue Aktivitäten',
    icon: '📥',
  },
  {
    id: 'vehicles',
    kind: 'area',
    area: 'fahrzeuge',
    title: 'Fahrzeugverwaltung',
    subtitle: 'Modelle, Bestand und Konditionen',
    icon: '🚗',
  },
  {
    id: 'sell',
    kind: 'area',
    area: 'verkaufen',
    section: 'sell',
    title: 'Verkaufen',
    subtitle: 'Beratung, Showroom und Modellauswahl',
    icon: '🚀',
  },
  {
    id: 'ads',
    kind: 'area',
    area: 'marketing',
    title: 'Inseratsgenerator',
    subtitle: 'Anzeigen und Texte erstellen',
    icon: '📝',
  },
];

function resolveInboxMeta(openCount) {
  if (!openCount) return 'Keine neuen Aktivitäten';
  return `${openCount} neue Aktivität${openCount === 1 ? '' : 'en'}`;
}

export default function BackendMainTiles({ onNavigateArea }) {
  const inbox = useCleverInboxOptional();
  const summary = inbox
    ? { openCount: inbox.openCount }
    : buildInboxDashboardSummary();
  const inboxMeta = resolveInboxMeta(summary.openCount);

  function handleTileClick(tile) {
    if (tile.section) {
      onNavigateArea?.(tile.area, tile.section);
      return;
    }
    onNavigateArea?.(tile.area);
  }

  function renderTile(tile) {
    const isInbox = tile.id === 'inbox';
    const classes = [
      'backend-home__main-tile',
      isInbox && summary.openCount > 0 ? ' backend-home__main-tile--alert' : '',
    ].join('');

    const content = (
      <>
        <span className="backend-home__main-tile-icon" aria-hidden>{tile.icon}</span>
        <span className="backend-home__main-tile-title">{tile.title}</span>
        <span className="backend-home__main-tile-sub">{tile.subtitle}</span>
        {isInbox && (
          <span className="backend-home__main-tile-meta">{inboxMeta}</span>
        )}
      </>
    );

    if (tile.kind === 'link') {
      return (
        <Link
          key={tile.id}
          to={tile.to}
          className={classes}
          aria-label={`${tile.title}: ${inboxMeta}`}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={tile.id}
        type="button"
        className={classes}
        onClick={() => handleTileClick(tile)}
        aria-label={tile.title}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="backend-home__main-tiles" aria-label="Hauptbereiche">
      <div className="backend-home__main-tiles-grid">
        {MAIN_TILES.map(renderTile)}
      </div>
    </section>
  );
}
