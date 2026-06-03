import { formatCurrency, getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import { normalizePaymentModeInput } from '../../services/pricing/pricingResolver.js';
import VehicleDetailDealerBlock from '../vehicle-detail/VehicleDetailDealerBlock.jsx';
import '../vehicle-detail/vehicle-detail.css';

function rateForOffer(offer, paymentMode) {
  const mode = normalizePaymentModeInput(paymentMode);
  if (mode === 'cash') return formatCurrency(offer.cashPrice);
  if (mode === 'finance') {
    return `${formatCurrency(offer.financeRate ?? offer.monthlyRate)}/Monat`;
  }
  return `${formatCurrency(offer.monthlyRate)}/Monat`;
}

export default function DealerCompareCard({
  offers = [],
  paymentMode,
  displayPrice,
  onCompare,
}) {
  const offerCount = offers.length;
  const best = offers[0];
  if (!best) return null;

  const mode = normalizePaymentModeInput(paymentMode);
  const fromLabel = mode === 'cash'
    ? `${offerCount} Händler · ab ${formatCurrency(best.cashPrice)}`
    : `${offerCount} Händler · ab ${rateForOffer(best, paymentMode)}`;

  return (
    <article className="vd-action-card">
      <h3 className="vd-action-card__title">Angebote vergleichen</h3>
      <p className="vd-action-card__subtitle">{fromLabel}</p>
      <p className="vd-action-card__detail">
        Bestes Angebot: {best.dealerName} · {best.distanceKm} km
      </p>
      <p className="vd-action-card__hint">
        {getAvailabilityPlainLabel(best.availability)}
      </p>
      <button type="button" className="vd-btn vd-btn--secondary vd-btn--sm vd-action-card__cta" onClick={onCompare}>
        Vergleichen
      </button>
    </article>
  );
}

export function DealerTrustCard(props) {
  return <VehicleDetailDealerBlock {...props} />;
}
