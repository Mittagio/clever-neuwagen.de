import LeadDetailPanel from './LeadDetailPanel.jsx';

/**
 * Flow-Freeze: + Neues Angebot bleibt in der Akte.
 * Angebot prüfen / Kalkulator ist das Ergebnis – nicht der Einstieg.
 */
export const NEW_OFFER_OPTIONS = [
  {
    id: 'other_vehicle',
    title: 'Anderes Fahrzeug',
    description: 'Zweite Fahrzeugoption für denselben Kunden – bestehendes Angebot bleibt erhalten.',
  },
  {
    id: 'vary_offer',
    title: 'Angebot variieren',
    description: 'Laufzeit, Kilometer, Anzahlung oder Ausstattung am bestehenden Fahrzeug ändern.',
  },
  {
    id: 'pdf_import',
    title: 'PDF einlesen',
    description: 'Fertige Kalkulation (Händler/Bank/DMS) übernehmen und prüfen.',
  },
];

export default function CustomerAkteAddProposalSheet({
  open,
  onClose,
  onSelect,
  customerName = '',
}) {
  const name = String(customerName || '').trim();
  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Neues Angebot"
      footer={(
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
          Abbrechen
        </button>
      )}
    >
      <div className="cust-akte-add-proposal">
        <p className="cust-akte-add-proposal__sub">
          {name
            ? `Was möchtest du für ${name} vorbereiten?`
            : 'Was möchtest du vorbereiten?'}
        </p>
        <p className="cust-akte-add-proposal__hint">
          Clever bleibt beim Kunden. Du kannst auch unten einfach tippen:
          {' '}
          „EV2 Air in Rot“
        </p>

        <ul className="cust-akte-add-proposal__list">
          {NEW_OFFER_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="cust-akte-add-proposal__option"
                onClick={() => onSelect?.(option.id)}
              >
                <span className="cust-akte-add-proposal__option-title">{option.title}</span>
                <span className="cust-akte-add-proposal__option-desc">{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </LeadDetailPanel>
  );
}

/** @deprecated LeaseFinanceSheet bleibt für Abwärtskompatibilität erhalten. */
const LEGACY_LEASE_FINANCE_OPTIONS = [
  {
    id: 'leasing',
    title: 'Leasing',
    description: 'Laufzeit und Rate festlegen.',
  },
  {
    id: 'financing',
    title: 'Finanzierung',
    description: 'Laufzeit, Anzahlung und Rate.',
  },
];

export function CustomerAkteLeaseFinanceSheet({
  open,
  onClose,
  onSelect,
  onBack,
}) {
  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Angebotsrechner"
      footer={(
        <>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onBack}>
            Zurück
          </button>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
        </>
      )}
    >
      <div className="cust-akte-add-proposal">
        <p className="cust-akte-add-proposal__sub">
          Welche Zahlungsart soll berechnet werden?
        </p>
        <ul className="cust-akte-add-proposal__list">
          {LEGACY_LEASE_FINANCE_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="cust-akte-add-proposal__option"
                onClick={() => onSelect?.(option.id)}
              >
                <span className="cust-akte-add-proposal__option-title">{option.title}</span>
                <span className="cust-akte-add-proposal__option-desc">{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </LeadDetailPanel>
  );
}
