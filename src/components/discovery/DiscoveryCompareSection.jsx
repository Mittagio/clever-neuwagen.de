import './discovery-results.css';

export default function DiscoveryCompareSection({
  dealerCount = 1,
  radiusKm = 25,
  localized = false,
  onCompare,
  onExpandRadius,
}) {
  if (dealerCount > 1 && onCompare) {
    return (
      <section className="disc-local-hit disc-local-hit--multi" aria-label="Mehrere Händler">
        <p className="disc-local-hit__title">
          {dealerCount} Händler in Ihrer Nähe gefunden
        </p>
        <p className="disc-local-hit__text">
          Vergleichen Sie Angebote für dieselbe Suche.
        </p>
        <button type="button" className="disc-local-hit__btn disc-local-hit__btn--ghost" onClick={onCompare}>
          Angebote vergleichen
        </button>
      </section>
    );
  }

  if (!localized) return null;

  return (
    <section className="disc-local-hit" aria-label="Lokaler Treffer">
      <p className="disc-local-hit__title">✓ Lokaler Treffer</p>
      <p className="disc-local-hit__text">
        {dealerCount === 1
          ? '1 Händler in Ihrer Nähe gefunden. Dieses Angebot liegt in Ihrem Umkreis.'
          : `Dieses Angebot liegt in Ihrem Umkreis von ${radiusKm} km.`}
        {' '}
        Weitere Händler ab 50 km anzeigen.
      </p>
      {onExpandRadius && (
        <button type="button" className="disc-local-hit__btn" onClick={onExpandRadius}>
          Radius auf 50 km erweitern
        </button>
      )}
    </section>
  );
}
