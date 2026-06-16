import VehicleImage from '../shared/VehicleImage.jsx';
import { resolveVehicleImageModel } from '../../services/vehicle/vehicleImageService.js';
import { getMatchVariantLabel } from '../../logic/discoveryDisplay.js';

export default function DealerAiSuggestedModels({
  models = [],
  selectedModelId,
  onReserve,
}) {
  if (!models.length) return null;

  return (
    <section className="dai-card dai-card--models dai-card--models-compact">
      <header className="dai-card__head dai-card__head--models">
        <h2 className="dai-card__title">Mögliche Fahrzeuge</h2>
        <p className="dai-card__subline dai-card__subline--desktop-only">
          Passend zum erkannten Wunsch.
        </p>
      </header>

      <div className="dai-model-carousel" tabIndex={0} aria-label="Fahrzeugvorschläge">
        {models.map((model, index) => {
          const isSelected = selectedModelId === model.id;
          const imageModel = resolveVehicleImageModel(model.primaryMatch?.vehicle)
            ?? model.modelKey;
          const trimLabel = model.primaryMatch
            ? getMatchVariantLabel(model.primaryMatch)
            : null;
          const displayName = model.name.replace(/^Kia\s+/i, 'Kia ');
          const badgeLabel = index === 0 ? 'Empfehlung' : (model.badge?.split(',')[0] ?? null);

          return (
            <article
              key={model.id}
              className={`dai-model-card dai-model-card--compact${isSelected ? ' is-selected' : ''}`}
            >
              <div className="dai-model-card__visual dai-model-card__visual--compact">
                <VehicleImage
                  brand="Kia"
                  model={imageModel}
                  bodyType={model.bodyType ?? 'suv'}
                  variant="card"
                  className="dai-model-card__image-wrap"
                  imageClassName="dai-model-card__image"
                />
              </div>

              <div className="dai-model-card__body">
                {badgeLabel && (
                  <span className="dai-model-card__badge">{badgeLabel}</span>
                )}
                <h3 className="dai-model-card__title">{displayName}</h3>
                {trimLabel && (
                  <p className="dai-model-card__trim">{trimLabel}</p>
                )}
                <p className="dai-model-card__rate">{model.priceHint}</p>
                <button
                  type="button"
                  className={`dai-btn dai-btn--reserve dai-btn--reserve-compact${isSelected ? ' is-active' : ''}`}
                  onClick={() => onReserve?.(model)}
                >
                  {isSelected ? '✓ Vorgemerkt' : 'Vormerken'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
