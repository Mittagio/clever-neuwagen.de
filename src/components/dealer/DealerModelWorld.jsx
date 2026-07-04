import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KIA_MODEL_WORLD } from '../../data/dealerLandingContent.js';
import {
  buildModelTrimPricePresentation,
  pickPresentationForLanding,
} from '../../services/dealer/dealerTrimPricing.js';
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
  onConfigureModel,
  variant = 'classic',
}) {
  const navigate = useNavigate();

  const modelCards = useMemo(() => {
    return KIA_MODEL_WORLD.map((card) => {
      let rateFrom = card.rateFrom;
      let priceFrom = card.priceFrom;
      let promoBadges = [];
      let overflowLabel = null;
      let trimLines = [];
      let preparationFeeLine = null;
      let priceFootnotes = [];

      if (conditions) {
        const presentation = buildModelTrimPricePresentation(
          conditions,
          { id: card.modelKey, brand: 'Kia', name: card.name },
          { paymentType: 'leasing' },
        );
        const landing = pickPresentationForLanding(presentation);
        if (landing.rate != null) rateFrom = landing.rate;
        trimLines = landing.trimLines;
        preparationFeeLine = landing.preparationFeeLine;
        priceFootnotes = landing.footnotes ?? [];
        promoBadges = landing.badges ?? [];
        overflowLabel = landing.overflowLabel;
      }

      return {
        ...card,
        rateFrom,
        priceFrom,
        promoBadges,
        overflowLabel,
        trimLines,
        preparationFeeLine,
        priceFootnotes,
      };
    });
  }, [conditions]);

  function exploreCard(card) {
    if (onConfigureModel) {
      onConfigureModel(card);
      return;
    }
    if (onSearch) {
      onSearch(card.searchQuery);
      return;
    }
    navigate(buildDealerWishSearchUrl(card.searchQuery, { city, dealerSlug }));
  }

  const isClassicVariant = variant === 'classic';
  const isInspirationVariant = variant === 'inspiration';

  return (
    <section
      className={`dl-modellwelt dl-modellwelt--inspire dl-modellwelt--portal${isClassicVariant ? ' dl-modellwelt--classic' : ''}${isInspirationVariant ? ' dl-modellwelt--inspiration' : ''}`}
      aria-labelledby="dl-modellwelt-heading"
    >
      <div className="dl-modellwelt__head">
        {isClassicVariant && (
          <p className="dl-modellwelt__classic-label">Oder Modell selbst auswählen</p>
        )}
        {isInspirationVariant && (
          <p className="dl-modellwelt__inspiration-label">Inspiration</p>
        )}
        <h2 id="dl-modellwelt-heading" className="dl-modellwelt__title">
          {isInspirationVariant
            ? 'Unsere Modelle entdecken'
            : isClassicVariant
              ? 'Modell konfigurieren'
              : 'Unsere Modelle'}
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
                className={`dl-modellwelt__card-btn${isClassicVariant ? ' dl-modellwelt__card-btn--classic' : ''}`}
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
                        <>ab {Math.round(card.rateFrom)} € mtl.</>
                      ) : (
                        <>ab {formatPrice(card.priceFrom)}</>
                      )}
                    </p>
                  )}
                  {card.trimLines?.length > 1 && (
                    <ul className="dl-modellwelt__trim-rates">
                      {card.trimLines.map((line) => (
                        <li key={line.trimId}>
                          <span>{line.trimName}</span>
                          <span>
                            {line.displayRate != null
                              ? `ab ${Math.round(line.displayRate)} €`
                              : '–'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {card.preparationFeeLine && (
                    <p className="dl-modellwelt__prep">{card.preparationFeeLine}</p>
                  )}
                  {card.promoBadges.length > 0 && (
                    <DealerModelPromotionBadges
                      badges={card.promoBadges.slice(0, 2)}
                      overflowLabel={card.overflowLabel}
                      className="dl-modellwelt__badges"
                    />
                  )}
                  {card.priceFootnotes?.slice(0, 1).map((line) => (
                    <p key={line} className="dl-modellwelt__legal">{line}</p>
                  ))}
                  {isClassicVariant && (
                    <span className="dl-modellwelt__configure">Konfigurieren</span>
                  )}
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
