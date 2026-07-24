import './CustomerAkte.css';
import { AKTE_TABS } from './customerAkteTabs.js';

const NAV_ITEMS = [
  { id: AKTE_TABS.kunde, label: 'Kunde', icon: '👤' },
  { id: AKTE_TABS.chat, label: 'Chat', icon: '💬' },
  { id: AKTE_TABS.clever, label: 'Clever', icon: '✨', clever: true },
  { id: AKTE_TABS.angebote, label: 'Angebote', icon: '🚗' },
  { id: AKTE_TABS.mehr, label: 'Mehr', icon: '☰' },
];

/**
 * Semantisch identische Navigation: Mobile Bottom Nav / Desktop Side Rail.
 * variant: "bottom" | "rail"
 */
export default function CustomerAkteFileNav({
  activeTab = AKTE_TABS.chat,
  onSelect,
  badges = {},
  variant = 'bottom',
}) {
  const isRail = variant === 'rail';
  const rootClass = isRail ? 'cn-side-rail cust-akte-file-nav--rail' : 'cust-akte-file-nav';

  return (
    <nav className={rootClass} aria-label="Kundenakte">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id
          || (item.id === AKTE_TABS.clever && activeTab === AKTE_TABS.chat && badges.cleverMode);
        const badge = badges[item.id === AKTE_TABS.angebote ? 'angebote' : item.id];
        return (
          <button
            key={item.id}
            type="button"
            className={[
              isRail ? 'cn-side-rail__item' : 'cust-akte-file-nav__item',
              item.clever ? (isRail ? 'cn-side-rail__item--clever' : 'cust-akte-file-nav__item--clever') : '',
              isActive ? (isRail ? 'cn-side-rail__item--active' : 'cust-akte-file-nav__item--active') : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect?.(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={isRail ? 'cn-side-rail__icon' : 'cust-akte-file-nav__icon'} aria-hidden>
              {item.icon}
            </span>
            <span className={isRail ? undefined : 'cust-akte-file-nav__label'}>{item.label}</span>
            {!isRail && badge ? (
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
