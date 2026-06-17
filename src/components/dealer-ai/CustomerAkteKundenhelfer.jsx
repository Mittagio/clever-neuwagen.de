import { parseKundenhelferNotes } from '../../services/cleverKundenhelfer.js';
import { getKundenhelferChipIcon } from '../../services/customerAkte.js';
import './CustomerAkte.css';

export default function CustomerAkteKundenhelfer({
  notes = '',
  onOpenSheet,
}) {
  const chips = parseKundenhelferNotes(notes);

  return (
    <section className="cust-akte-section cust-akte-kh" aria-labelledby="cust-akte-kh-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-kh-title" className="cust-akte-section__title">Clever Kundenhelfer</h2>
        <button type="button" className="cust-akte-section__link" onClick={onOpenSheet}>
          + Info hinzufügen
        </button>
      </div>

      {chips.length > 0 ? (
        <div className="cust-akte-kh__grid">
          {chips.slice(0, 11).map((chip) => (
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
          {chips.length > 11 && (
            <button type="button" className="cust-akte-kh__chip cust-akte-kh__chip--more" onClick={onOpenSheet}>
              …
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="cust-akte-kh__empty" onClick={onOpenSheet}>
          <p className="cust-akte-kh__empty-title">Noch keine Kundeninfos</p>
          <p className="cust-akte-kh__empty-sub">Kleine Details helfen beim nächsten Gespräch.</p>
        </button>
      )}
    </section>
  );
}
