/**
 * Schnellaufnahme – kompakte Mini-Karte mit klickbaren Chips.
 */
import './CustomerAkte.css';

export default function CustomerAkteWishConditions({
  chips = [],
  onEdit,
  onChipClick,
}) {
  if (!chips.length && !onEdit) return null;

  function handleChipClick(field) {
    if (onChipClick) {
      onChipClick(field);
      return;
    }
    onEdit?.();
  }

  return (
    <section className="cust-akte-schnell" aria-labelledby="cust-akte-schnell-title">
      <div className="cust-akte-schnell__head">
        <p id="cust-akte-schnell-title" className="cust-akte-schnell__label">Schnellaufnahme</p>
        {onEdit && (
          <button type="button" className="cust-akte-schnell__edit" onClick={onEdit}>
            Ändern
          </button>
        )}
      </div>
      <div className="cust-akte-schnell__card">
        <div className="cust-akte-schnell__chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="cust-akte-schnell__chip"
              onClick={() => handleChipClick(chip.field)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
