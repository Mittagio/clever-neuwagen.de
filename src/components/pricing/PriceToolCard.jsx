import { getPaymentTeaserLine } from '../../services/pricing/pricingResolver.js';
import '../vehicle-detail/vehicle-detail.css';

export default function PriceToolCard({ price, open, onOpen }) {
  const teaser = getPaymentTeaserLine(price);
  const ctaLabel = price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen';

  return (
    <section className="vd-calc vd-calc--embedded vd-tool-row" aria-label="Preis und Zahlungsart">
      {!open && (
        <div className="vd-calc__teaser">
          <div className="vd-calc__teaser-text">
            <p className="vd-calc__teaser-title">Preis &amp; Zahlungsart</p>
            <p className="vd-calc__teaser-sub">{teaser}</p>
          </div>
          <button
            type="button"
            className="vd-calc__teaser-btn"
            onClick={onOpen}
            aria-expanded={false}
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </section>
  );
}
