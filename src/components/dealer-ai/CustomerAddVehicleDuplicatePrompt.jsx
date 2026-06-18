export default function CustomerAddVehicleDuplicatePrompt({
  duplicate,
  onAddAnyway,
  onEditExisting,
  onCancel,
  isExecuting = false,
}) {
  const label = duplicate?.model
    ? `${duplicate.brand ?? 'Kia'} ${duplicate.model}${duplicate.trimLabel ? ` ${duplicate.trimLabel}` : ''}`
    : 'Dieses Fahrzeug';

  return (
    <div className="dai-add-vehicle-dup" role="dialog" aria-labelledby="dai-add-vehicle-dup-title">
      <div className="dai-add-vehicle-dup__panel">
        <h2 id="dai-add-vehicle-dup-title" className="dai-add-vehicle-dup__title">
          Bereits hinterlegt
        </h2>
        <p className="dai-add-vehicle-dup__text">
          Dieses Fahrzeug ist bereits als Wunsch hinterlegt
          {label ? `: ${label}` : '.'}
        </p>
        <div className="dai-add-vehicle-dup__actions">
          <button
            type="button"
            className="dai-add-vehicle-dup__primary"
            onClick={onAddAnyway}
            disabled={isExecuting}
          >
            {isExecuting ? 'Wird hinzugefügt …' : 'Trotzdem hinzufügen'}
          </button>
          <button
            type="button"
            className="dai-add-vehicle-dup__secondary"
            onClick={onEditExisting}
            disabled={isExecuting}
          >
            Bestehenden Wunsch bearbeiten
          </button>
          <button
            type="button"
            className="dai-add-vehicle-dup__ghost"
            onClick={onCancel}
            disabled={isExecuting}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
