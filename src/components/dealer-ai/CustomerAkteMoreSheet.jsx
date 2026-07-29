import './CustomerAkte.css';

/**
 * „Mehr“-Bottom-Sheet: seltene Funktionen, Statuszahlen sichtbar.
 * Alltag = Feed + schlanke Kundendaten am Namen; Rest hier.
 */
export default function CustomerAkteMoreSheet({
  open = false,
  onClose,
  unterlagenLabel = '0/0',
  unterlagenOpen = 0,
  selfDisclosureLabel = 'offen',
  activitiesCount = 0,
  offersCount = 0,
  appointmentSummary = '',
  onOffers,
  onUnterlagen,
  onSelfDisclosure,
  onHistory,
  onTermine,
  onCustomerData,
  onNotepad,
  onPortal,
  onLexikon,
}) {
  if (!open) return null;

  const rows = [
    {
      id: 'offers',
      section: 'Medien & Dokumente',
      label: 'Angebote',
      meta: offersCount ? String(offersCount) : null,
      onClick: onOffers,
    },
    {
      id: 'unterlagen',
      label: 'Dokumente',
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
      id: 'termine',
      section: 'Termine',
      label: 'Termine',
      meta: appointmentSummary || null,
      onClick: onTermine,
    },
    {
      id: 'history',
      label: 'Aktivitäten',
      meta: activitiesCount ? `${activitiesCount} neu` : null,
      onClick: onHistory,
    },
    {
      id: 'kunde',
      section: 'Kundendaten',
      label: 'Name / Telefon / E-Mail / Adresse',
      onClick: onCustomerData,
    },
    {
      id: 'notepad',
      label: 'Notizzettel',
      onClick: onNotepad,
    },
    {
      id: 'portal',
      section: 'Teilen',
      label: 'Kundenportal',
      onClick: onPortal,
    },
    {
      id: 'lexikon',
      label: 'Clever-Lexikon',
      onClick: onLexikon,
    },
  ].filter((row) => typeof row.onClick === 'function');

  let lastSection = null;

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
          {rows.map((row) => {
            const showSection = row.section && row.section !== lastSection;
            if (row.section) lastSection = row.section;
            return (
              <li key={row.id}>
                {showSection ? (
                  <p className="cust-akte-more-sheet__section">{row.section}</p>
                ) : null}
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
            );
          })}
        </ul>
      </div>
    </div>
  );
}
