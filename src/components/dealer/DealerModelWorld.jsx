import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildShowcaseCards } from '../../services/dealer/dealerShowcaseModel.js';
import { buildDealerWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
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
  modelLineGroups = [],
  loading = false,
  source = 'local',
}) {
  const navigate = useNavigate();

  const cards = useMemo(
    () => buildShowcaseCards(modelLineGroups),
    [modelLineGroups],
  );

  function exploreCard(card) {
    if (card.slug) {
      navigate(`/fahrzeug/${card.slug}`);
      return;
    }
    navigate(buildDealerWishSearchUrl(card.searchQuery, { city, dealerSlug }));
  }

  return (
    <section className="dl-modellwelt" aria-labelledby="dl-modellwelt-heading">
      <div className="dl-modellwelt__head">
        <h2 id="dl-modellwelt-heading" className="dl-modellwelt__title">
          Kia Modellwelt
        </h2>
        <p className="dl-modellwelt__sub">
          {loading
            ? 'Bestand wird geladen …'
            : source === 'server'
              ? 'Live aus dem Händlerbestand · nach links und rechts wischen'
              : 'Nach links und rechts wischen'}
        </p>
      </div>

      <div className="dl-modellwelt__track" role="list">
        {cards.map((card) => {
          const media = getKiaModelMediaEntry(card.modelKey, 'hero');
          return (
            <article key={card.id} className="dl-modellwelt__card" role="listitem">
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
                <h3 className="dl-modellwelt__name">
                  Kia {card.name}
                  {card.variantCount > 1 && (
                    <span className="dl-modellwelt__variants">
                      {' '}
                      · {card.variantCount} Ausstattungen
                    </span>
                  )}
                </h3>
                {card.tagline && <p className="dl-modellwelt__tagline">{card.tagline}</p>}
                <p className="dl-modellwelt__price">
                  {card.rateFrom != null ? (
                    <>ab {Math.round(card.rateFrom)} €/Monat</>
                  ) : (
                    'Preis auf Anfrage'
                  )}
                  {card.priceFrom != null && (
                    <span className="dl-modellwelt__upe"> · UPE {formatPrice(card.priceFrom)}</span>
                  )}
                </p>
                {card.cleverQuote && (
                  <CleverQuoteBadge cleverQuote={card.cleverQuote} size="sm" showTier={false} />
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm dl-modellwelt__cta"
                  onClick={() => exploreCard(card)}
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
