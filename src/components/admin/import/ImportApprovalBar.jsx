import './ImportApprovalBar.css';

export default function ImportApprovalBar({ onApprove, onReject, disabled }) {
  return (
    <section className="import-approval" aria-label="Freigabe">
      <p className="import-approval__hint">
        Fahrzeugdaten werden erst nach Ihrer Freigabe zentral aktualisiert.
      </p>
      <div className="import-approval__actions">
        <button
          type="button"
          className="import-approval__btn import-approval__btn--approve"
          onClick={onApprove}
          disabled={disabled}
        >
          ✓ Übernehmen
        </button>
        <button
          type="button"
          className="import-approval__btn import-approval__btn--reject"
          onClick={onReject}
          disabled={disabled}
        >
          ✕ Ablehnen
        </button>
      </div>
    </section>
  );
}
