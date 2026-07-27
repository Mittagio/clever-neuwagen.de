import './CustomerAkte.css';

/**
 * Messenger-artige Kontaktinfos – strukturierte Übersichten, kein zweiter Arbeitsraum.
 * Alltag = Feed; Details = hier.
 */
export default function CustomerAkteContactInfoSheet({
  open = false,
  onClose,
  customerName = '',
  phone = '',
  email = '',
  addressLine = '',
  offersCount = 0,
  unterlagenLabel = '0/0',
  unterlagenOpen = 0,
  selfDisclosureLabel = '',
  appointmentSummary = '',
  onOffers,
  onUnterlagen,
  onSelfDisclosure,
  onTermine,
  onCustomerData,
  onNotepad,
  onPortal,
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
      id: 'docs',
      label: 'Dokumente',
      meta: unterlagenLabel,
      hint: unterlagenOpen > 0 ? `${unterlagenOpen} offen` : null,
      onClick: onUnterlagen,
    },
    {
      id: 'sa',
      label: 'Selbstauskunft',
      meta: selfDisclosureLabel || null,
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
      id: 'kunde',
      section: 'Kundendaten',
      label: 'Telefon / E-Mail / Adresse',
      onClick: onCustomerData,
    },
    {
      id: 'notepad',
      label: 'Notizzettel',
      meta: 'vollständig',
      onClick: onNotepad,
    },
    {
      id: 'portal',
      section: 'Teilen',
      label: 'Kundenportal',
      onClick: onPortal,
    },
  ].filter((row) => typeof row.onClick === 'function');

  let lastSection = null;

  return (
    <div className="cust-akte-contact-sheet" role="dialog" aria-label="Kundeninfos">
      <button
        type="button"
        className="cust-akte-contact-sheet__backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="cust-akte-contact-sheet__panel">
        <header className="cust-akte-contact-sheet__header">
          <div>
            <h2 className="cust-akte-contact-sheet__title">{customerName || 'Kunde'}</h2>
            <p className="cust-akte-contact-sheet__facts">
              {[phone?.trim() || null, email?.trim() || null, addressLine || null]
                .filter(Boolean)
                .join(' · ') || 'Kontaktdaten ergänzen'}
            </p>
          </div>
          <button type="button" className="cust-akte-contact-sheet__close" onClick={onClose}>
            Schließen
          </button>
        </header>
        <ul className="cust-akte-contact-sheet__list">
          {rows.map((row) => {
            const showSection = row.section && row.section !== lastSection;
            if (row.section) lastSection = row.section;
            return (
              <li key={row.id}>
                {showSection ? (
                  <p className="cust-akte-contact-sheet__section">{row.section}</p>
                ) : null}
                <button
                  type="button"
                  className="cust-akte-contact-sheet__row"
                  onClick={() => {
                    row.onClick?.();
                    onClose?.();
                  }}
                >
                  <span className="cust-akte-contact-sheet__row-label">{row.label}</span>
                  <span className="cust-akte-contact-sheet__row-meta">
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
