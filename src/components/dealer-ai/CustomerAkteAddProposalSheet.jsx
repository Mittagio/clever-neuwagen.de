import LeadDetailPanel from './LeadDetailPanel.jsx';

const MAIN_OPTIONS = [
  {
    id: 'vehicle',
    title: 'Fahrzeugvorschlag',
    description: 'Ein einzelnes Fahrzeug als Vorschlag vorbereiten.',
  },
  {
    id: 'selection_group',
    title: 'Clever Auswahl',
    description: 'Mehrere Varianten eines Modells vorbereiten, z. B. Vision / Spirit / GT-Line.',
  },
  {
    id: 'cash',
    title: 'Barangebot',
    description: 'Kaufpreis-Angebot ohne Leasingrate vorbereiten.',
  },
  {
    id: 'lease_finance',
    title: 'Leasing / Finanzierung',
    description: 'Rate, Laufzeit, Kilometer und Anzahlung vorbereiten.',
  },
];

const LEASE_FINANCE_OPTIONS = [
  {
    id: 'leasing',
    title: 'Leasingvorschlag',
    description: 'Monatsrate, Laufzeit und Kilometer vorbereiten.',
  },
  {
    id: 'financing',
    title: 'Finanzierungsvorschlag',
    description: 'Finanzierung mit Rate, Laufzeit und Anzahlung vorbereiten.',
  },
];

export default function CustomerAkteAddProposalSheet({
  open,
  onClose,
  onSelect,
}) {
  function handleSelect(optionId) {
    onSelect?.(optionId);
  }

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Vorschlag hinzufügen"
      footer={(
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
          Abbrechen
        </button>
      )}
    >
      <div className="cust-akte-add-proposal">
        <p className="cust-akte-add-proposal__sub">
          Was möchten Sie dem Kunden auf den Tisch legen?
        </p>

        <ul className="cust-akte-add-proposal__list">
          {MAIN_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="cust-akte-add-proposal__option"
                onClick={() => handleSelect(option.id)}
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
      title="Leasing / Finanzierung"
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
          Welche Zahlungsart soll der Vorschlag haben?
        </p>
        <ul className="cust-akte-add-proposal__list">
          {LEASE_FINANCE_OPTIONS.map((option) => (
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
