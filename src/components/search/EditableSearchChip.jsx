import { isChipEditable, WISH_ADD_CHIP_ID, CHIP_TYPES } from '../../services/search/chipConfig.js';

/**
 * Einzelner Such-Chip – öffnet nur editierbare Chips den passenden Editor.
 */
export default function EditableSearchChip({ chip, onEdit, className = '' }) {
  const isWishAdd = chip.id === WISH_ADD_CHIP_ID || chip.type === CHIP_TYPES.WISH_ADD;
  const editable = isChipEditable(chip);

  return (
    <button
      type="button"
      className={`search-summary-compact__chip${isWishAdd ? ' search-summary-compact__chip--add' : ''}${editable ? '' : ' search-summary-compact__chip--readonly'} ${className}`.trim()}
      onClick={() => onEdit?.(chip)}
      aria-label={`${chip.label}${editable ? ', bearbeiten' : ''}`}
    >
      {chip.emoji && (
        <span className="search-summary-compact__emoji" aria-hidden="true">{chip.emoji}</span>
      )}
      {chip.label}
    </button>
  );
}
