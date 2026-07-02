import LeadDetailPanel from './LeadDetailPanel.jsx';

const MAIN_OPTIONS = [
  {
    id: 'leasing',
    title: 'Leasing',
    description: 'Fahrzeug wählen, Rate berechnen und Angebot speichern.',
  },
  {
    id: 'financing',
    title: 'Finanzierung',
    description: 'Laufzeit, Anzahlung und Monatsrate im Angebotsrechner festlegen.',
  },
  {
    id: 'cash',
    title: 'Bar / Kauf',
    description: 'UPE, Rabatt und Kaufpreis berechnen.',
  },
  {
    id: 'selection_group',
    title: 'Clever Auswahl',
    description: 'Mehrere Varianten eines Modells vorbereiten (z. B. Air / Earth / GT-Line).',
  },
];

export default function CustomerAkteAddProposalSheet({
  open,
  onClose,
  onSelect,
}) {
  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Angebot erstellen"
      footer={(
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
          Abbrechen
        </button>
      )}
    >
      <div className="cust-akte-add-proposal">
        <p className="cust-akte-add-proposal__sub">
          Angebotsrechner öffnen – Fahrzeug konfigurieren, Konditionen berechnen und auf dem Tisch speichern.
        </p>

        <ul className="cust-akte-add-proposal__list">
          {MAIN_OPTIONS.map((option) => (
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
          {MAIN_OPTIONS.filter((option) => option.id === 'leasing' || option.id === 'financing').map((option) => (
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
