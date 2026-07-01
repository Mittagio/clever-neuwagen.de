import './CustomerAkte.css';

const ACTIONS = [
  { id: 'call', label: 'Anrufen', icon: '📞' },
  { id: 'nachrichten', label: 'Clever Nachrichten', shortLabel: 'Nachrichten', icon: '✦' },
  { id: 'unterlagen', label: 'Unterlagen', icon: '📁' },
  { id: 'history', label: 'Verlauf', icon: '🕘' },
];

export default function CustomerAkteActionBar({
  telHref,
  onCleverNachrichten,
  onUnterlagen,
  onHistory,
  unterlagenBadge = 0,
  inboxOpenCount = 0,
  historyBadge = 0,
}) {
  function renderAction(action) {
    const isHistory = action.id === 'history';
    const historyLabel = inboxOpenCount > 0 ? 'Eingang' : action.label;
    const badge = action.id === 'unterlagen'
      ? unterlagenBadge
      : (isHistory && inboxOpenCount > 0 ? inboxOpenCount : (isHistory ? historyBadge : 0));

    if (action.id === 'call') {
      if (!telHref) {
        return (
          <span
            key={action.id}
            className="cust-akte-actions__item cust-akte-actions__item--disabled"
            title="Telefonnummer fehlt"
            aria-label={`${action.label} (Telefonnummer fehlt)`}
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
        >
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          <span className="cust-akte-actions__label">{action.label}</span>
        </a>
      );
    }

    const handlers = {
      nachrichten: onCleverNachrichten,
      unterlagen: onUnterlagen,
      history: onHistory,
    };
    const handler = handlers[action.id];
    const isNachrichten = action.id === 'nachrichten';

    return (
      <button
        key={action.id}
        type="button"
        className={`cust-akte-actions__item${isNachrichten ? ' cust-akte-actions__item--primary' : ''}${isHistory && inboxOpenCount > 0 ? ' cust-akte-actions__item--inbox' : ''}`}
        onClick={handler}
        title={isNachrichten ? 'Nachricht aus Kundenakte erstellen' : undefined}
        aria-label={isNachrichten ? 'Clever Nachrichten – Nachricht aus Kundenakte erstellen' : historyLabel}
        disabled={!handler}
      >
        <span className="cust-akte-actions__icon-wrap">
          <span className="cust-akte-actions__icon" aria-hidden>{action.icon}</span>
          {badge > 0 && (
            <span className="cust-akte-actions__badge" aria-label={`${badge} offen`}>
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        {isNachrichten ? (
          <>
            <span className="cust-akte-actions__label cust-akte-actions__label--full">{action.label}</span>
            <span className="cust-akte-actions__label cust-akte-actions__label--short">{action.shortLabel}</span>
          </>
        ) : (
          <span className="cust-akte-actions__label">{historyLabel}</span>
        )}
      </button>
    );
  }

  return (
    <nav className="cust-akte-actions" aria-label="Kommunikation">
      {ACTIONS.map(renderAction)}
    </nav>
  );
}
