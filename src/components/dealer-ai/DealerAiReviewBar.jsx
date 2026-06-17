export default function DealerAiReviewBar({
  reservedCount = 0,
  onCreateLead,
  onEdit,
  isExecuting,
}) {
  const countLabel = reservedCount === 1
    ? '1 Modell vorgemerkt'
    : reservedCount > 1
      ? `${reservedCount} Modelle vorgemerkt`
      : null;

  return (
    <div className="dai-review-bar" role="toolbar" aria-label="Nächster Schritt">
      {countLabel && (
        <p className="dai-review-bar__reserved">{countLabel}</p>
      )}
      <button
        type="button"
        className="dai-review-bar__cta"
        onClick={onCreateLead}
        disabled={isExecuting}
      >
        {isExecuting ? 'Wird erstellt …' : 'Verkaufschance erstellen'}
      </button>
      <button
        type="button"
        className="dai-review-bar__edit"
        onClick={onEdit}
        disabled={isExecuting}
      >
        Eingabe bearbeiten
      </button>
    </div>
  );
}
