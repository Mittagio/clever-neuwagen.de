import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getVehicleOfferPath } from '../../logic/oneSearchService.js';
import { normalizePaymentModeInput } from '../../services/pricing/pricingResolver.js';
import './dealer-offer.css';

function priceLabelForVehicle(v, paymentMode) {
  const mode = normalizePaymentModeInput(paymentMode);
  if (mode === 'cash') return formatCurrency(v.cashPrice);
  if (mode === 'finance') {
    return `${formatCurrency(v.financeRate ?? Math.round(v.monthlyRate * 1.08))}/Monat`;
  }
  return `${formatCurrency(v.monthlyRate)}/Monat`;
}

export default function SimilarVehiclesNearby({ vehicles = [], currentSlug, paymentMode = 'leasing' }) {
  const navigate = useNavigate();
  const items = vehicles.filter((v) => v.slug !== currentSlug);

  if (!items.length) return null;

  return (
    <section className="similar-nearby" aria-label="Ähnliche Fahrzeuge in Ihrer Nähe">
      <h2 className="similar-nearby__title">Ähnliche Fahrzeuge</h2>
      <p className="similar-nearby__sub">Inspiration – andere Modelle in Ihrer Nähe.</p>
      <div className="similar-nearby__grid">
        {items.map((v) => (
          <article key={v.id} className="similar-nearby-card">
            <VehicleImage brand={v.brand} model={v.imageModel} className="similar-nearby-card__image" />
            <div className="similar-nearby-card__body">
              <h3>{v.title}</h3>
              <p className="similar-nearby-card__meta">
                {v.distanceKm} km · {priceLabelForVehicle(v, paymentMode)}
              </p>
              <button
                type="button"
                className="similar-nearby-card__cta"
                onClick={() => navigate(getVehicleOfferPath(v))}
              >
                Ansehen
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
