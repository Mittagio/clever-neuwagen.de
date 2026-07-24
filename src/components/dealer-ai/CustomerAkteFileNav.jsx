import './CustomerAkte.css';
import { AKTE_TABS } from './customerAkteTabs.js';

/**
 * Feste Bottom-Navigation der Mobile-Kundenakte.
 * Clever ist zentral hervorgehoben – öffnet denselben Composer im Clever-Modus.
 */
export default function CustomerAkteFileNav({
  activeTab = AKTE_TABS.chat,
  onSelect,
  badges = {},
}) {
  const items = [
    { id: AKTE_TABS.kunde, label: 'Kunde', icon: '👤' },
    { id: AKTE_TABS.chat, label: 'Chat', icon: '💬', badge: badges.chat },
    { id: AKTE_TABS.clever, label: 'Clever', icon: '✨', clever: true },
    { id: AKTE_TABS.angebote, label: 'Angebote', icon: '🚗', badge: badges.angebote },
    { id: AKTE_TABS.mehr, label: 'Mehr', icon: '☰', badge: badges.mehr },
  ];

  return (
    <nav className="cust-akte-file-nav" aria-label="Kundenakte">
      {items.map((item) => {
        const isActive = activeTab === item.id
          || (item.id === AKTE_TABS.clever && activeTab === AKTE_TABS.chat && badges.cleverMode);
        const badge = item.badge;
        return (
          <button
            key={item.id}
            type="button"
            className={[
              'cust-akte-file-nav__item',
              item.clever ? 'cust-akte-file-nav__item--clever' : '',
              isActive ? 'cust-akte-file-nav__item--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect?.(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="cust-akte-file-nav__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="cust-akte-file-nav__label">{item.label}</span>
            {badge ? (
              <span className="cust-akte-file-nav__badge" aria-label={`${badge} offen`}>
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
