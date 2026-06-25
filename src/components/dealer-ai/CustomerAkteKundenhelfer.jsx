import {
  getProfileKundenhelferChips,
  parseKundenhelferNotes,
} from '../../services/cleverKundenhelfer.js';
import { countConversationNotes } from '../../services/kundenhelferConversationNotes.js';
import { getKundenhelferChipIcon } from '../../services/customerAkte.js';
import './CustomerAkte.css';

/**
 * Clever-Kundenhelfer-Chips im Profilkopf (kompakt, max. 6 + „+ X mehr“).
 */
export default function CustomerAkteKundenhelfer({
  notes = '',
  conversationNotes = [],
  onOpenSheet,
  variant = 'profile',
}) {
  const chips = parseKundenhelferNotes(notes);
  const { visible, moreCount } = getProfileKundenhelferChips(notes);
  const noteCount = countConversationNotes(conversationNotes);

  if (variant !== 'profile') {
    return null;
  }

  if (!chips.length) {
    return (
      <div className="cust-akte-kh cust-akte-kh--profile cust-akte-kh--profile-empty" aria-label="Clever Kundenhelfer">
        <button type="button" className="cust-akte-kh__add-link cust-akte-kh__add-link--profile" onClick={onOpenSheet}>
          + Kundeninfo hinzufügen
        </button>
        {noteCount > 0 && (
          <p className="cust-akte-kh__notes-hint">
            {noteCount} Gesprächsnotiz{noteCount > 1 ? 'en' : ''}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="cust-akte-kh cust-akte-kh--profile" aria-label="Clever Kundenhelfer">
      <div className="cust-akte-kh__grid cust-akte-kh__grid--profile">
        {visible.map((chip) => (
          <button
            key={chip}
            type="button"
            className="cust-akte-kh__chip cust-akte-kh__chip--profile"
            onClick={onOpenSheet}
          >
            <span className="cust-akte-kh__chip-icon" aria-hidden>{getKundenhelferChipIcon(chip)}</span>
            <span className="cust-akte-kh__chip-label">{chip}</span>
          </button>
        ))}
        {moreCount > 0 && (
          <button
            type="button"
            className="cust-akte-kh__chip cust-akte-kh__chip--profile cust-akte-kh__chip--more"
            onClick={onOpenSheet}
          >
            + {moreCount} mehr
          </button>
        )}
      </div>
      <button type="button" className="cust-akte-kh__add-link cust-akte-kh__add-link--profile" onClick={onOpenSheet}>
        + Info hinzufügen
      </button>
      {noteCount > 0 && (
        <p className="cust-akte-kh__notes-hint">
          {noteCount} Gesprächsnotiz{noteCount > 1 ? 'en' : ''}
        </p>
      )}
    </div>
  );
}
