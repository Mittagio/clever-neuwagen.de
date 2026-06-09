import { useNavigate } from 'react-router-dom';
import { KIA_MODEL_WORLD } from '../../data/dealerLandingContent.js';
import { buildDealerWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import VehicleImage from '../shared/VehicleImage.jsx';
import './dealer-landing.css';

function formatPrice(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealerModelWorld({
  city = '',
  dealerSlug = '',
  onSearch,
  compact = false,
}) {
  const navigate = useNavigate();

  function exploreCard(card) {
    if (onSearch) {
      onSearch(card.searchQuery);
      return;
    }
    navigate(buildDealerWishSearchUrl(card.searchQuery, { city, dealerSlug }));
  }

  return (
    <section
      className={`dl-modellwelt${compact ? ' dl-modellwelt--compact' : ''}`}
      aria-labelledby="dl-modellwelt-heading"
    >
      <div className="dl-modellwelt__head">
        <h2 id="dl-modellwelt-heading" className="dl-modellwelt__title">
          Kia Modellwelt
        </h2>
        <p className="dl-modellwelt__sub">Nach links und rechts wischen</p>
      </div>

      <div className="dl-modellwelt__track" role="list">
        {KIA_MODEL_WORLD.map((card) => {
          const media = getKiaModelMediaEntry(card.modelKey, 'hero');
          return (
            <article key={card.id} className="dl-modellwelt__card" role="listitem">
              <button
                type="button"
                className="dl-modellwelt__card-btn"
                onClick={() => exploreCard(card)}
                aria-label={`${card.name}: ${card.tagline}`}
              >
                <div className="dl-modellwelt__image">
                  <VehicleImage
                    brand="Kia"
                    model={card.modelKey}
                    variant="hero"
                    bodyType="suv"
                    dealerImageUrl={media?.hero ?? media?.default}
                    className="dl-modellwelt__vehicle-image"
                  />
                </div>
                <div className="dl-modellwelt__body">
                  <h3 className="dl-modellwelt__name">Kia {card.name}</h3>
                  <p className="dl-modellwelt__tagline">{card.tagline}</p>
                  <p className="dl-modellwelt__price">
                    {card.rateFrom != null ? (
                      <>ab {Math.round(card.rateFrom)} €/Monat</>
                    ) : (
                      'Preis auf Anfrage'
                    )}
                    {card.priceFrom != null && (
                      <span className="dl-modellwelt__upe"> · ab {formatPrice(card.priceFrom)}</span>
                    )}
                  </p>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
