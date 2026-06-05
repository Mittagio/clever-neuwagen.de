import { useNavigate } from 'react-router-dom';
import { KIA_MODEL_WORLD } from '../../data/dealerLandingContent.js';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import VehicleImage from '../shared/VehicleImage.jsx';
import './dealer-landing.css';

function formatPrice(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealerModelWorld({ city = '' }) {
  const navigate = useNavigate();

  function exploreModel(model) {
    const query = city ? `${model.searchQuery} ${city}` : model.searchQuery;
    navigate(buildWishSearchUrl(query));
  }

  return (
    <section className="dl-modellwelt" aria-labelledby="dl-modellwelt-heading">
      <h2 id="dl-modellwelt-heading" className="dl-modellwelt__title">
        Kia Modellwelt
      </h2>
      <p className="dl-modellwelt__sub">Nach links und rechts wischen</p>

      <div className="dl-modellwelt__track" role="list">
        {KIA_MODEL_WORLD.map((model) => {
          const media = getKiaModelMediaEntry(model.modelKey, 'hero');
          return (
            <article key={model.id} className="dl-modellwelt__card" role="listitem">
              <div className="dl-modellwelt__image">
                <VehicleImage
                  brand="Kia"
                  model={model.modelKey}
                  variant="hero"
                  bodyType="suv"
                  dealerImageUrl={media?.hero ?? media?.default}
                  className="dl-modellwelt__vehicle-image"
                />
              </div>
              <div className="dl-modellwelt__body">
                <h3 className="dl-modellwelt__name">Kia {model.name}</h3>
                <p className="dl-modellwelt__tagline">{model.tagline}</p>
                <p className="dl-modellwelt__price">
                  ab {model.rateFrom} €/Monat
                  <span className="dl-modellwelt__upe"> · UPE {formatPrice(model.priceFrom)}</span>
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm dl-modellwelt__cta"
                  onClick={() => exploreModel(model)}
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
