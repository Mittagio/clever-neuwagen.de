import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import { getVehicleOfferPath } from '../../logic/oneSearchService.js';
import { formatMatchPrimaryPrice } from '../../logic/discoveryDisplay.js';
import './discovery-results.css';

export default function DiscoveryAlternativesStrip({
  matches = [],
  max = 3,
  paymentMode = 'leasing',
  title = 'Vielleicht auch interessant',
  subtitle = 'Falls Sie noch vergleichen möchten.',
}) {
  const navigate = useNavigate();
  const items = matches.slice(0, max);
  if (!items.length) return null;

  return (
    <section className="disc-section disc-section--alt" aria-label="Alternativen">
      <div className="disc-section__head">
        <h2 className="disc-section__title">{title}</h2>
        {subtitle && <p className="disc-section__sub">{subtitle}</p>}
      </div>
      <div className="disc-alt__scroll disc-alt__scroll--snap" role="list">
        {items.map((match) => {
          const v = match.vehicle;
          const label = match.model || v.title;
          const price = formatMatchPrimaryPrice(match, paymentMode);
          return (
            <article key={v.id} className="disc-alt-card" role="listitem">
              <VehicleImage
                brand={v.brand}
                model={v.imageModel}
                bodyType={v.bodyType}
                className="disc-alt-card__img-wrap"
                imageClassName="disc-alt-card__img"
              />
              <div className="disc-alt-card__body">
                <h3>{label}</h3>
                <p className="disc-alt-card__rate">
                  {price.label}{price.suffix}
                </p>
                <p className="disc-alt-card__meta">{v.distanceKm} km</p>
                <button
                  type="button"
                  className="disc-alt-card__btn"
                  onClick={() => navigate(getVehicleOfferPath(v))}
                >
                  Ansehen
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
