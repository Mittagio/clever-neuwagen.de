import './vehicle-detail-stream.css';

export default function VehicleDetailUpgradeSection({
  upgrade,
  vehicleModel,
  paymentMode = 'leasing',
  cleverQuote,
  cleverQuoteAfter,
  onAcceptTrim,
  onAcceptPackage,
  onViewAlternative,
}) {
  if (!upgrade) return null;

  if (upgrade.kind === 'package') {
    const pkg = upgrade.data;
    const isCash = paymentMode === 'cash';
    return (
      <section className="vd-stream-block vd-stream-upgrade vd-stream-upgrade--package" aria-labelledby="vd-stream-upgrade-title">
        <p className="vd-stream-upgrade__kicker">💡 Clever denkt mit</p>
        <h2 id="vd-stream-upgrade-title" className="vd-stream-block__title">Für Ihre Wünsche fehlt noch:</h2>
        <article className="vd-stream-upgrade__card card">
          <p className="vd-stream-upgrade__badge">{pkg.name}</p>
          {upgrade.gains?.length > 0 && (
            <ul className="vd-stream-upgrade__gains">
              {upgrade.gains.map((g) => (
                <li key={g}><span aria-hidden>✓</span> {g}</li>
              ))}
            </ul>
          )}
          {upgrade.bonusLabels?.length > 0 && (
            <p className="vd-stream-upgrade__bonus">
              Bonus: {upgrade.bonusLabels.join(', ')}
            </p>
          )}
          {cleverQuote && cleverQuoteAfter && (
            <p className="vd-stream-upgrade__cq-delta">
              CleverQuote {cleverQuote.percent} % → <strong>{cleverQuoteAfter.percent} %</strong>
            </p>
          )}
          {(upgrade.baselinePriceLabel || upgrade.newPriceLabel) && (
            <p className="vd-stream-upgrade__price">
              {isCash ? 'Kaufpreis' : 'Rate'}:{' '}
              {upgrade.baselinePriceLabel && (
                <span className="vd-stream-upgrade__price-old">{upgrade.baselinePriceLabel}</span>
              )}
              {upgrade.baselinePriceLabel && upgrade.newPriceLabel && (
                <span className="vd-stream-upgrade__price-arrow" aria-hidden> → </span>
              )}
              {upgrade.newPriceLabel && (
                <strong>{upgrade.newPriceLabel}</strong>
              )}
            </p>
          )}
          {upgrade.priceDeltaLabel && (
            <p className="vd-stream-upgrade__delta">{upgrade.priceDeltaLabel}</p>
          )}
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block"
            onClick={() => onAcceptPackage?.(pkg.id)}
          >
            Paket übernehmen
          </button>
        </article>
      </section>
    );
  }

  if (upgrade.kind === 'alt') {
    const alt = upgrade.data;
    return (
      <section className="vd-stream-block vd-stream-upgrade" aria-labelledby="vd-stream-upgrade-title">
        <p className="vd-stream-upgrade__kicker">💡 Clever hat etwas gefunden</p>
        <h2 id="vd-stream-upgrade-title" className="vd-stream-block__title">Noch besser passend?</h2>
        <article className="vd-stream-upgrade__card card">
          <p className="vd-stream-upgrade__name">{alt.title}</p>
          <p className="vd-stream-upgrade__meta">{alt.fulfillmentLabel}</p>
          <p className="vd-stream-upgrade__price">{alt.priceLabel}</p>
          <button
            type="button"
            className="vd-btn vd-btn--secondary vd-btn--block"
            onClick={() => onViewAlternative?.(alt)}
          >
            Upgrade ansehen
          </button>
        </article>
      </section>
    );
  }

  const { trim, title, subtitle, gains = [], losses = [], direction } = upgrade;
  return (
    <section className="vd-stream-block vd-stream-upgrade" aria-labelledby="vd-stream-upgrade-title">
      <p className="vd-stream-upgrade__kicker">💡 Clever denkt mit</p>
      <h2 id="vd-stream-upgrade-title" className="vd-stream-block__title">Noch besser passend?</h2>
      <article className="vd-stream-upgrade__card card">
        <p className="vd-stream-upgrade__badge">
          {direction === 'up' ? '🟢' : '💶'} {vehicleModel} {title}
        </p>
        {subtitle && <p className="vd-stream-upgrade__delta">{subtitle}</p>}
        {gains.length > 0 && (
          <ul className="vd-stream-upgrade__gains">
            {gains.map((g) => (
              <li key={g}><span aria-hidden>+</span> {g}</li>
            ))}
          </ul>
        )}
        {losses.length > 0 && (
          <ul className="vd-stream-upgrade__losses">
            {losses.map((l) => (
              <li key={l}><span aria-hidden>−</span> {l}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="vd-btn vd-btn--secondary vd-btn--block"
          onClick={() => onAcceptTrim?.(trim)}
        >
          Upgrade ansehen
        </button>
      </article>
    </section>
  );
}
