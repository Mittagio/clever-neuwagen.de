import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { IconCar, IconInbox, IconMegaphone } from '../dealer-ai/AkteIcons.jsx';
import { buildCleverEingangDashboardCounts } from '../../services/crm/cleverEingangItems.js';
import './BackendHome.css';

const MAIN_TILES = [
  {
    id: 'inbox',
    kind: 'link',
    to: '/backend/clever-eingang',
    title: 'Clever Eingang',
    subtitle: 'Neue Aktivitäten',
    Icon: IconInbox,
  },
  {
    id: 'vehicles',
    kind: 'area',
    area: 'fahrzeuge',
    title: 'Fahrzeugverwaltung',
    subtitle: 'Modelle, Bestand und Konditionen',
    Icon: IconCar,
  },
  {
    id: 'ads',
    kind: 'area',
    area: 'marketing',
    title: 'Inseratsgenerator',
    subtitle: 'Anzeigen und Texte erstellen',
    Icon: IconMegaphone,
  },
];

export function formatCleverEingangTileMeta({ unreadCount = 0, openCount = 0 } = {}) {
  return `${unreadCount} ungelesen · ${openCount} offene Vorgänge`;
}

export default function BackendMainTiles({ onNavigateArea, leads = [] }) {
  const eingangCounts = useMemo(
    () => buildCleverEingangDashboardCounts(leads),
    [leads],
  );
  const inboxMeta = formatCleverEingangTileMeta(eingangCounts);

  function handleTileClick(tile) {
    if (tile.section) {
      onNavigateArea?.(tile.area, tile.section);
      return;
    }
    onNavigateArea?.(tile.area);
  }

  function renderTile(tile) {
    const isInbox = tile.id === 'inbox';
    const Icon = tile.Icon;
    const classes = [
      'backend-home__main-tile',
      isInbox && eingangCounts.unreadCount > 0 ? ' backend-home__main-tile--alert' : '',
    ].join('');

    const content = (
      <>
        <span className="backend-home__main-tile-icon" aria-hidden>
          {Icon ? <Icon /> : null}
        </span>
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
