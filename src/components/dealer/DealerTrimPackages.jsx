import './dealer-landing.css';

function formatPrice(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Phase 5 – Pakete mit Live-Auswirkung auf CleverQuote.
 */
export default function DealerTrimPackages({
  packages = [],
  selectedPackageIds = [],
  onTogglePackage,
}) {
  if (!packages.length) return null;

  return (
    <section className="dl-trim-packages" aria-labelledby="dl-trim-packages-title">
      <h3 id="dl-trim-packages-title" className="dl-trim-packages__title">
        Verfügbare Pakete
      </h3>
      <ul className="dl-trim-packages__list">
        {packages.map((pkg) => {
          const active = selectedPackageIds.includes(pkg.id);
          return (
            <li key={pkg.id} className={`dl-trim-packages__item${active ? ' dl-trim-packages__item--active' : ''}`}>
              <div className="dl-trim-packages__head">
                <span className="dl-trim-packages__emoji" aria-hidden>{pkg.emoji ?? '📦'}</span>
                <div>
                  <p className="dl-trim-packages__label">{pkg.label}</p>
                  {pkg.highlights?.length > 0 && (
                    <ul className="dl-trim-packages__highlights">
                      {pkg.highlights.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="dl-trim-packages__price">
                  +
                  {formatPrice(pkg.priceGross)}
                </p>
              </div>
              <button
                type="button"
                className={`btn btn-secondary dl-trim-packages__btn${active ? ' dl-trim-packages__btn--active' : ''}`}
                onClick={() => onTogglePackage?.(pkg.id)}
              >
                {active ? 'Paket entfernen' : 'Paket hinzufügen'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
