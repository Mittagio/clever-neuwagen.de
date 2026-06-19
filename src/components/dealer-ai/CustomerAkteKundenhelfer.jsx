import { parseKundenhelferNotes } from '../../services/cleverKundenhelfer.js';
import { getKundenhelferChipIcon } from '../../services/customerAkte.js';
import './CustomerAkte.css';

export default function CustomerAkteKundenhelfer({
  notes = '',
  onOpenSheet,
}) {
  const chips = parseKundenhelferNotes(notes);

  if (!chips.length) {
    return (
      <section className="cust-akte-kh cust-akte-kh--empty" aria-label="Clever Kundenhelfer">
        <button type="button" className="cust-akte-kh__add-link" onClick={onOpenSheet}>
          + Kundeninfo hinzufügen
        </button>
      </section>
    );
  }

  return (
    <section className="cust-akte-kh" aria-label="Clever Kundenhelfer">
      <div className="cust-akte-kh__grid">
        {chips.slice(0, 12).map((chip) => (
          <button
            key={chip}
            type="button"
            className="cust-akte-kh__chip"
            onClick={onOpenSheet}
          >
            <span className="cust-akte-kh__chip-icon" aria-hidden>{getKundenhelferChipIcon(chip)}</span>
            {chip}
          </button>
        ))}
        {chips.length > 12 && (
          <button type="button" className="cust-akte-kh__chip cust-akte-kh__chip--more" onClick={onOpenSheet}>
            …
          </button>
        )}
      </div>
      <button type="button" className="cust-akte-kh__add-link" onClick={onOpenSheet}>
        Bearbeiten
      </button>
    </section>
  );
}
