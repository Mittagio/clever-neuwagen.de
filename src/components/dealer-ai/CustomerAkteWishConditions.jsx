/**
 * Wunschkonditionen – eine Zeile, Bearbeitung nur im Bottom-Sheet.
 */
export default function CustomerAkteWishConditions({
  chips = [],
  onEdit,
}) {
  if (!chips.length && !onEdit) return null;

  const summary = chips.length > 0 ? chips.join(' · ') : 'Noch offen';

  return (
    <section className="cust-akte-wish cust-akte-wish--quiet" aria-label="Wunschkonditionen">
      <div className="cust-akte-wish__quiet-row">
        <p className="cust-akte-wish__summary">{summary}</p>
        {onEdit && (
          <button type="button" className="cust-akte-wish__change" onClick={onEdit}>
            Ändern
          </button>
        )}
      </div>
    </section>
  );
}
