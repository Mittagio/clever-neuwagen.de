import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getVehicleOfferPath } from '../../logic/oneSearchService.js';
import './dealer-offer.css';

export default function DealerInventoryCarousel({ dealerName, vehicles = [], title }) {
  const navigate = useNavigate();

  if (!vehicles.length) return null;

  return (
    <section className="dealer-inventory" aria-label={`Weitere Fahrzeuge bei ${dealerName}`}>
      <h2 className="dealer-inventory__title">
        {title ?? `Weitere Fahrzeuge bei ${dealerName}`}
      </h2>
      <div className="dealer-inventory__scroll">
        {vehicles.map((v) => (
          <article key={v.id} className="dealer-inventory-card">
            <VehicleImage brand={v.brand} model={v.imageModel} className="dealer-inventory-card__image" />
            <div className="dealer-inventory-card__body">
              <h3>{v.title}</h3>
              <p className="dealer-inventory-card__rate">{formatCurrency(v.monthlyRate)}/Monat</p>
              <button
                type="button"
                className="dealer-inventory-card__cta"
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
