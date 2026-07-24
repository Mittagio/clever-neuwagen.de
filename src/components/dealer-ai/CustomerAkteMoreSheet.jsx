import './CustomerAkte.css';

/**
 * „Mehr“-Bottom-Sheet: seltene Funktionen, Statuszahlen sichtbar.
 */
export default function CustomerAkteMoreSheet({
  open = false,
  onClose,
  unterlagenLabel = '0/0',
  unterlagenOpen = 0,
  selfDisclosureLabel = 'offen',
  activitiesCount = 0,
  onUnterlagen,
  onSelfDisclosure,
  onHistory,
  onTermine,
  onCustomerData,
  onPortal,
  onLexikon,
}) {
  if (!open) return null;

  const rows = [
    {
      id: 'unterlagen',
      label: 'Unterlagen',
      meta: unterlagenLabel,
      hint: unterlagenOpen > 0 ? `${unterlagenOpen} offen` : null,
      onClick: onUnterlagen,
    },
    {
      id: 'sa',
      label: 'Selbstauskunft',
      meta: selfDisclosureLabel,
      onClick: onSelfDisclosure,
    },
    {
      id: 'history',
      label: 'Verlauf',
      meta: activitiesCount ? `${activitiesCount} neu` : null,
      onClick: onHistory,
    },
    {
      id: 'termine',
      label: 'Termine',
      onClick: onTermine,
    },
    {
      id: 'kunde',
      label: 'Kundendaten',
      onClick: onCustomerData,
    },
    {
      id: 'portal',
      label: 'Kundenportal',
      onClick: onPortal,
    },
    {
      id: 'lexikon',
      label: 'Clever-Lexikon',
      onClick: onLexikon,
    },
  ].filter((row) => typeof row.onClick === 'function');

  return (
    <div className="cust-akte-more-sheet" role="dialog" aria-label="Mehr">
      <button
        type="button"
        className="cust-akte-more-sheet__backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="cust-akte-more-sheet__panel">
        <header className="cust-akte-more-sheet__header">
          <h2 className="cust-akte-more-sheet__title">Mehr</h2>
          <button type="button" className="cust-akte-more-sheet__close" onClick={onClose}>
            Schließen
          </button>
        </header>
        <ul className="cust-akte-more-sheet__list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="cust-akte-more-sheet__row"
                onClick={() => {
                  row.onClick?.();
                  onClose?.();
                }}
              >
                <span className="cust-akte-more-sheet__row-label">{row.label}</span>
                <span className="cust-akte-more-sheet__row-meta">
                  {row.hint || row.meta || ''}
                  <span aria-hidden> ›</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
