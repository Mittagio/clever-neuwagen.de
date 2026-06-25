import './CustomerAkte.css';

const ACTIONS = [
  { id: 'call', label: 'Anrufen', icon: '📞' },
  { id: 'antworten', label: 'Clever Antwort', icon: '✦' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'email', label: 'E-Mail', icon: '✉' },
  { id: 'unterlagen', label: 'Unterlagen', icon: '📁' },
  { id: 'activities', label: 'Aktivitäten', icon: '🕘' },
];

export default function CustomerAkteActionBar({
  telHref,
  whatsappHref,
  mailHref,
  email = '',
  onCleverAntwort,
  onUnterlagen,
  onActivities,
  unterlagenBadge = 0,
  activitiesBadge = 0,
  activitiesBadgeDetail = null,
  onCall,
}) {
  function renderAction(action) {
    const badge = action.id === 'unterlagen' ? unterlagenBadge
      : action.id === 'activities' ? activitiesBadge
        : 0;

    if (action.id === 'call') {
      if (!telHref) {
        return (
          <span
            key={action.id}
            className="cust-akte-actions__item cust-akte-actions__item--disabled"
            aria-label={`${action.label} (nicht verfügbar)`}
          >
            <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
            <span className="cust-akte-actions__label">{action.label}</span>
          </span>
        );
      }
      return (
        <a
          key={action.id}
          href={telHref}
          className="cust-akte-actions__item"
          aria-label={action.label}
          onClick={onCall}
        >
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          <span className="cust-akte-actions__label">{action.label}</span>
        </a>
      );
    }

    if (action.id === 'whatsapp') {
      if (!whatsappHref) {
        return (
          <span
            key={action.id}
            className="cust-akte-actions__item cust-akte-actions__item--disabled"
            aria-label={`${action.label} (nicht verfügbar)`}
          >
            <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
            <span className="cust-akte-actions__label">{action.label}</span>
          </span>
        );
      }
      return (
        <a
          key={action.id}
          href={whatsappHref}
          className="cust-akte-actions__item"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={action.label}
        >
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          <span className="cust-akte-actions__label">{action.label}</span>
        </a>
      );
    }

    if (action.id === 'email') {
      const href = email?.trim()
        ? (mailHref ?? `mailto:${email}`)
        : null;
      if (!href) {
        return (
          <span
            key={action.id}
            className="cust-akte-actions__item cust-akte-actions__item--disabled"
            aria-label={`${action.label} (nicht verfügbar)`}
          >
            <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
            <span className="cust-akte-actions__label">{action.label}</span>
          </span>
        );
      }
      return (
        <a key={action.id} href={href} className="cust-akte-actions__item" aria-label={action.label}>
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          <span className="cust-akte-actions__label">{action.label}</span>
        </a>
      );
    }

    const handlers = {
      antworten: onCleverAntwort,
      unterlagen: onUnterlagen,
      activities: onActivities,
    };
    const handler = handlers[action.id];
    const activitiesAria = action.id === 'activities' && activitiesBadgeDetail?.total
      ? `${action.label}: ${activitiesBadgeDetail.total} Aktivitäten`
      : action.label;

    return (
      <button
        key={action.id}
        type="button"
        className={`cust-akte-actions__item${action.id === 'activities' ? ' cust-akte-actions__item--activities' : ''}`}
        onClick={handler}
        aria-label={activitiesAria}
        disabled={!handler}
      >
        <span className="cust-akte-actions__icon-wrap">
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          {badge > 0 && (
            <span className="cust-akte-actions__badge" aria-label={`${badge} neu`}>
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className="cust-akte-actions__label">{action.label}</span>
      </button>
    );
  }

  return (
    <nav className="cust-akte-actions" aria-label="Schnellaktionen">
      {ACTIONS.map(renderAction)}
    </nav>
  );
}
