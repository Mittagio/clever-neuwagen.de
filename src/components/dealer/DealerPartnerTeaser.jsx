import '../vehicle-detail/vehicle-detail.css';

/**
 * Sprint 39 – Händler emotional sichtbar (Ebene 1,5), nicht nur „12 km“.
 */
export default function DealerPartnerTeaser({
  dealerName,
  distanceKm,
  brand,
  responseHint = 'Antwort meist innerhalb von 1 Stunde',
  onExpand,
}) {
  if (!dealerName) return null;

  return (
    <section className="vd-partner-teaser" aria-label="Ansprechpartner vor Ort">
      <p className="vd-partner-teaser__kicker">Ihr Ansprechpartner vor Ort</p>
      <h2 className="vd-partner-teaser__name">{dealerName}</h2>
      <ul className="vd-partner-teaser__facts">
        {Number.isFinite(distanceKm) && (
          <li>{Math.round(distanceKm)} km entfernt</li>
        )}
        {brand && <li>{brand} Vertragspartner</li>}
        <li>{responseHint}</li>
      </ul>
      {onExpand && (
        <button type="button" className="vd-partner-teaser__more" onClick={onExpand}>
          Mehr zum Händler
        </button>
      )}
    </section>
  );
}
