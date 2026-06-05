import './smartSales.css';

function formatWhen(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function SalesCustomerRecordsList({
  records = [],
  loading = false,
  activeId = null,
  onSelect,
}) {
  if (loading && !records.length) {
    return <p className="ss-records-list__loading">Kundenakten werden geladen …</p>;
  }

  if (!records.length) return null;

  return (
    <section className="ss-records-list" aria-label="Gespeicherte Kundenakten">
      <h2 className="ss-records-list__title">Kundenakten</h2>
      <ul className="ss-records-list__items">
        {records.map((record) => (
          <li key={record.id}>
            <button
              type="button"
              className={`ss-records-list__item${activeId === record.id ? ' ss-records-list__item--active' : ''}`}
              onClick={() => onSelect?.(record)}
            >
              <span className="ss-records-list__name">{record.customer?.name || 'Unbenannt'}</span>
              <span className="ss-records-list__meta">
                {formatWhen(record.updatedAt ?? record.savedAt)}
                {record.inquiryConfirmed && ' · Anfrage bestätigt'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
