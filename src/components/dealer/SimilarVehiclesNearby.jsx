import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getVehicleOfferPath } from '../../logic/oneSearchService.js';
import './dealer-offer.css';

export default function SimilarVehiclesNearby({ vehicles = [], currentSlug }) {
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
                {v.distanceKm} km · {formatCurrency(v.monthlyRate)}/Monat
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
