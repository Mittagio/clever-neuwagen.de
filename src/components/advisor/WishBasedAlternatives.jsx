import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import '../vehicle-detail/vehicle-detail.css';

export default function WishBasedAlternatives({ alternatives = [], currentTitle }) {
  const navigate = useNavigate();
  if (!alternatives.length) return null;

  return (
    <section className="vd-wish-alternatives" aria-label="Alternative Fahrzeuge für Ihre Wünsche">
      <h2 className="vd-wish-alternatives__title">Passende Alternativen</h2>
      <p className="vd-wish-alternatives__sub">
        Vergleich basiert auf Ihren Wünschen – nicht auf Modellnamen.
        {currentTitle ? ` Aktuell: ${currentTitle}.` : ''}
      </p>
      <div className="vd-wish-alternatives__grid">
        {alternatives.map((alt) => (
          <article key={alt.slug} className="vd-wish-alt-card">
            <VehicleImage
              brand={alt.vehicle.brand}
              model={alt.vehicle.imageModel ?? alt.vehicle.model}
              className="vd-wish-alt-card__image"
            />
            <div className="vd-wish-alt-card__body">
              <h3>{alt.title}</h3>
              <p className="vd-wish-alt-card__fulfillment">{alt.fulfillmentLabel}</p>
              <p className="vd-wish-alt-card__price">{alt.priceLabel}</p>
              <button
                type="button"
                className="vd-btn vd-btn--secondary vd-btn--sm vd-wish-alt-card__cta"
                onClick={() => navigate(`${alt.path}?wunsch=1`)}
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
