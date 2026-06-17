import './CustomerAkte.css';

export default function CustomerAkteToolbar({ onBack, onEdit, onMore }) {
  return (
    <div className="cust-akte-toolbar">
      <button type="button" className="cust-akte-toolbar__back" onClick={onBack} aria-label="Zurück">
        <span aria-hidden>←</span>
      </button>
      <div className="cust-akte-toolbar__actions">
        <button type="button" className="cust-akte-toolbar__action" onClick={onEdit}>
          <span className="cust-akte-toolbar__icon" aria-hidden>✎</span>
          Bearbeiten
        </button>
        <button type="button" className="cust-akte-toolbar__action" onClick={onMore}>
          <span className="cust-akte-toolbar__icon" aria-hidden>⋯</span>
          Mehr
        </button>
      </div>
    </div>
  );
}
