import { formatCurrency } from '../../logic/marketplaceService.js';
import { getPackagePriceImpactLabel } from '../../logic/vehicleDetailPricing.js';
import { normalizePaymentModeInput } from '../../services/pricing/pricingResolver.js';
import '../vehicle-detail/vehicle-detail.css';

export default function WishResultPanel({ recommendationResult, displayPrice, paymentMode }) {
  if (!recommendationResult?.magicSummary && !recommendationResult?.includedFeatures?.length) {
    return null;
  }

  const mode = normalizePaymentModeInput(paymentMode);
  const lines = recommendationResult.magicSummary?.split('\n') ?? [];

  return (
    <aside className="vd-wish-magic vd-wish-magic--advisor" aria-label="Clever-Neuwagen berät">
      <p className="vd-wish-magic__kicker">Clever-Neuwagen berät</p>
      {lines.map((line) => (
        <p key={line} className="vd-wish-magic__line">{line}{line.endsWith('.') ? '' : '.'}</p>
      ))}
      {displayPrice?.label && (
        <p className="vd-wish-magic__price">
          {mode === 'cash' ? 'Neuer Kaufpreis' : 'Neue Rate'}: {displayPrice.label}
        </p>
      )}
      {recommendationResult.priceDeltaLabel && (
        <p className="vd-wish-magic__delta">{recommendationResult.priceDeltaLabel}</p>
      )}
    </aside>
  );
}

export function PackageRecommendationCard({
  package: pkg,
  paymentMode,
  displayPrice,
  baselinePriceLabel,
  cleverQuote,
  cleverQuoteAfter,
  onAccept,
}) {
  if (!pkg) return null;
  const mode = normalizePaymentModeInput(paymentMode);
  const impactLabel = getPackagePriceImpactLabel({
    payment: mode,
    rateDelta: pkg.monthlyImpact,
    priceGross: pkg.priceImpact,
    packageName: pkg.name,
  });

  const requiredFeatures = pkg.features.filter((f) => f.reason !== 'bonus');
  const bonusFeatures = pkg.features.filter((f) => f.reason === 'bonus');
  const containsFeatures = [...requiredFeatures, ...bonusFeatures];

  return (
    <article className="vd-pkg-card vd-pkg-card--advisor">
      <p className="vd-pkg-card__eyebrow">Clever-Neuwagen berät</p>
      <p className="vd-pkg-card__wish">Für Ihre Wünsche benötigen Sie:</p>
      <h3 className="vd-pkg-card__title">{pkg.name}</h3>
      {containsFeatures.length > 0 && (
        <div className="vd-pkg-card__section">
          <p className="vd-pkg-card__section-label">Enthält:</p>
          <ul className="vd-pkg-card__bonus-list">
            {containsFeatures.map((f) => (
              <li key={f.id}><span aria-hidden>✓</span> {f.label}</li>
            ))}
          </ul>
        </div>
      )}
      {cleverQuote && cleverQuoteAfter && (
        <div className="clever-quote-pkg-delta">
          <span>Neue CleverQuote:</span>
          <span>{cleverQuote.percent} %</span>
          <span className="clever-quote-pkg-delta__arrow" aria-hidden>→</span>
          <strong>{cleverQuoteAfter.percent} %</strong>
        </div>
      )}
      <div className="vd-pkg-card__price-row">
        <p className="vd-pkg-card__price-label">
          {mode === 'cash' ? 'Neuer Kaufpreis' : 'Neue Rate'}
        </p>
        {baselinePriceLabel && displayPrice?.label && (
          <p className="vd-pkg-card__price-compare">
            <span>{baselinePriceLabel}</span>
            <span className="vd-pkg-card__arrow" aria-hidden>→</span>
            <strong>{displayPrice.label}</strong>
          </p>
        )}
        {impactLabel && <p className="vd-pkg-card__impact">{impactLabel}</p>}
      </div>
      <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={() => onAccept(pkg.id)}>
        Übernehmen
      </button>
    </article>
  );
}

export function CleverRecommendationCard({
  betterTrim,
  vehicle,
  fulfillment,
  onAccept,
}) {
  if (!betterTrim?.exists) return null;

  const fulfilledLabels = fulfillment?.items
    ?.filter((i) => i.status === 'standard' || i.status === 'fulfilled')
    .map((i) => i.label) ?? [];

  return (
    <section className="vd-trim-compare vd-trim-compare--advisor" aria-label="Clever-Neuwagen Empfehlung">
      <p className="vd-trim-compare__kicker">🎯 Clever-Neuwagen Empfehlung</p>
      <h3 className="vd-trim-compare__title">
        {vehicle.model} {betterTrim.trim} erfüllt Ihre Wünsche günstiger
      </h3>
      {betterTrim.reason && (
        <p className="vd-trim-compare__savings">{betterTrim.reason}</p>
      )}
      <div className="vd-trim-compare__cards">
        <article className="vd-trim-card">
          <p className="vd-trim-card__label">Aktuell</p>
          <p className="vd-trim-card__name">{vehicle.model} {vehicle.trimName ?? ''}</p>
          <p className="vd-trim-card__price">{betterTrim.oldPrice?.label}</p>
        </article>
        <article className="vd-trim-card vd-trim-card--recommended">
          <p className="vd-trim-card__label">Empfohlen</p>
          <p className="vd-trim-card__name">{vehicle.model} {betterTrim.trim}</p>
          <p className="vd-trim-card__price">{betterTrim.newPrice?.label}</p>
        </article>
      </div>
      {fulfilledLabels.length > 0 && (
        <div className="vd-trim-compare__fulfilled">
          <p className="vd-trim-compare__fulfilled-label">Und erhalten trotzdem:</p>
          <ul>
            {fulfilledLabels.map((l) => (
              <li key={l}><span aria-hidden>✓</span> {l}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className="vd-btn vd-btn--primary vd-btn--block"
        onClick={() => onAccept(betterTrim.trimId, betterTrim.resolution)}
      >
        Empfehlung übernehmen
      </button>
    </section>
  );
}

/** @deprecated Use CleverRecommendationCard */
export function BetterTrimCard(props) {
  return <CleverRecommendationCard {...props} />;
}
