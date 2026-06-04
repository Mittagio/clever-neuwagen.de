import './vehicle-detail-stream.css';

export default function VehicleDetailDealerCompact({
  dealerName,
  distanceKm,
  matchingCount = 1,
  onInquiry,
}) {
  if (!dealerName) return null;

  return (
    <section
      id="vd-dealer-block"
      className="vd-stream-block vd-stream-dealer"
      aria-labelledby="vd-stream-dealer-title"
    >
      <h2 id="vd-stream-dealer-title" className="vd-stream-block__title">Ihr Händler</h2>
      <article className="vd-stream-dealer__card card">
        <p className="vd-stream-dealer__name">{dealerName}</p>
        <ul className="vd-stream-dealer__facts">
          {distanceKm != null && <li>{distanceKm} km entfernt</li>}
          <li>{matchingCount} passende Fahrzeuge verfügbar</li>
        </ul>
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onInquiry}>
          Angebot anfragen
        </button>
      </article>
    </section>
  );
}
