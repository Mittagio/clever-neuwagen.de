import './smartSales.css';

export default function SalesCustomerRecordPanel({ record, onClose }) {
  if (!record) return null;

  return (
    <aside className="ss-record" aria-label="Kundenakte">
      <header className="ss-record__head">
        <h2>Kunde: {record.customer?.name || 'Unbenannt'}</h2>
        {onClose && (
          <button type="button" className="ss-record__close" onClick={onClose} aria-label="Schließen">×</button>
        )}
      </header>
      {record.wishLabels?.length > 0 && (
        <div className="ss-record__section">
          <h3>Wünsche</h3>
          <ul>{record.wishLabels.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {record.selectedVehicles?.length > 0 && (
        <div className="ss-record__section">
          <h3>Ausgewählte Fahrzeuge</h3>
          <ul>
            {record.selectedVehicles.map((v) => (
              <li key={v.slug}>{v.title} {v.cleverQuote != null && `(CleverQuote ${v.cleverQuote} %)`}</li>
            ))}
          </ul>
        </div>
      )}
      {record.sentVia?.length > 0 && (
        <div className="ss-record__section">
          <h3>Versendet</h3>
          <ul>{record.sentVia.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      <p className="ss-record__next"><strong>Nächster Schritt:</strong> {record.nextStep}</p>
    </aside>
  );
}
