import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KIA_MODEL_WORLD } from '../../data/dealerLandingContent.js';
import { buildCustomerModelBadges } from '../../services/dealer/dealerVehicleManagement.js';
import { buildCustomerPricePresentation } from '../../services/dealer/dealerModelPricing.js';
import { priceConfiguration } from '../../services/pricing/pricingEngine.js';
import { buildDealerWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import VehicleImage from '../shared/VehicleImage.jsx';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import './dealer-landing.css';

function formatPrice(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveDisplayName(card) {
  if (card.kiaPrefix === false) return card.name;
  return `Kia ${card.name}`;
}

function resolveBodyType(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.bodyType ?? 'suv';
}

export default function DealerModelWorld({
  city = '',
  dealerSlug = '',
  conditions = null,
  onSearch,
}) {
  const navigate = useNavigate();

  const modelCards = useMemo(() => {
    return KIA_MODEL_WORLD.map((card) => {
      let rateFrom = card.rateFrom;
      let priceFrom = card.priceFrom;
      let promoBadges = conditions
        ? buildCustomerModelBadges(conditions, card.modelKey)
        : [];
      let preparationFeeLine = null;
      let priceFootnotes = [];

      if (conditions) {
        const pricing = priceConfiguration({
          brand: 'Kia',
          model: card.name,
          modelKey: card.modelKey,
          dealerConditions: conditions,
          paymentType: 'leasing',
        });
        if (pricing) {
          const presentation = buildCustomerPricePresentation(
            conditions,
            card.modelKey,
            pricing,
            'leasing',
          );
          if (presentation.amount != null) {
            rateFrom = presentation.amount;
          }
          preparationFeeLine = presentation.preparationFeeLine;
          priceFootnotes = presentation.footnotes ?? [];
          if (presentation.badges?.length) {
            promoBadges = presentation.badges;
          }
        }
      }

      return {
        ...card,
        rateFrom,
        priceFrom,
        promoBadges,
        preparationFeeLine,
        priceFootnotes,
      };
    });
  }, [conditions]);

  function exploreCard(card) {
    if (onSearch) {
      onSearch(card.searchQuery);
      return;
    }
    navigate(buildDealerWishSearchUrl(card.searchQuery, { city, dealerSlug }));
  }

  return (
    <section
      className="dl-modellwelt dl-modellwelt--inspire"
      aria-labelledby="dl-modellwelt-heading"
    >
      <div className="dl-modellwelt__head">
        <h2 id="dl-modellwelt-heading" className="dl-modellwelt__title">
          Unsere Modelle
        </h2>
      </div>

      <div
        className="dl-modellwelt__track"
        role="list"
        aria-label="Fahrzeugmodelle entdecken"
      >
        {modelCards.map((card) => {
          const media = getKiaModelMediaEntry(card.modelKey, 'hero');
          const displayName = resolveDisplayName(card);
          return (
            <article key={card.id} className="dl-modellwelt__card" role="listitem">
              <button
                type="button"
                className="dl-modellwelt__card-btn"
                onClick={() => exploreCard(card)}
                aria-label={`${displayName}: ${card.tagline}`}
              >
                <div className="dl-modellwelt__image">
                  <VehicleImage
                    brand="Kia"
                    model={card.modelKey}
                    variant="hero"
                    bodyType={resolveBodyType(card.modelKey)}
                    dealerImageUrl={media?.hero ?? media?.default}
                    className="dl-modellwelt__vehicle-image"
                  />
                </div>
                <div className="dl-modellwelt__body">
                  <h3 className="dl-modellwelt__name">{displayName}</h3>
                  <p className="dl-modellwelt__tagline">{card.tagline}</p>
                  {(card.rateFrom != null || card.priceFrom != null) && (
                    <p className="dl-modellwelt__price">
                      {card.rateFrom != null ? (
                        <>ab {Math.round(card.rateFrom)} € Leasing</>
                      ) : (
                        <>ab {formatPrice(card.priceFrom)}</>
                      )}
                    </p>
                  )}
                  {card.preparationFeeLine && (
                    <p className="dl-modellwelt__prep">{card.preparationFeeLine}</p>
                  )}
                  {card.promoBadges.length > 0 && (
                    <DealerModelPromotionBadges badges={card.promoBadges} className="dl-modellwelt__badges" />
                  )}
                  {card.priceFootnotes?.slice(0, 1).map((line) => (
                    <p key={line} className="dl-modellwelt__legal">{line}</p>
                  ))}
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
