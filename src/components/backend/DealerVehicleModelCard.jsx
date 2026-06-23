import VehicleImage from '../shared/VehicleImage.jsx';
import './DealerVehicleManagement.css';

export default function DealerVehicleModelCard({ card, model, onManage }) {
  const statusLabel = card.active ? 'Aktiv' : 'Inaktiv';
  const statusTone = card.active ? 'active' : 'inactive';

  return (
    <article className="dvm-model-card">
      <div className="dvm-model-card__visual">
        <VehicleImage
          brand={card.brand}
          model={model.id}
          bodyType="suv"
          variant="card"
          className="dvm-model-card__image-wrap"
          imageClassName="dvm-model-card__image"
        />
        {card.highlight && (
          <span className="dvm-model-card__highlight" aria-label="Highlight">★</span>
        )}
      </div>

      <div className="dvm-model-card__body">
        <div className="dvm-model-card__head">
          <div>
            <p className="dvm-model-card__brand">{card.brand}</p>
            <h3 className="dvm-model-card__name">{card.name}</h3>
          </div>
          <span className={`dvm-model-card__status dvm-model-card__status--${statusTone}`}>
            {statusLabel}
          </span>
        </div>

        <div className="dvm-model-card__meta">
          <span className="dvm-model-card__chip">
            {card.discountPercent} % Rabatt
          </span>
          {card.activeActionCount > 0 && (
            <span className="dvm-model-card__chip dvm-model-card__chip--action">
              {card.activeActionCount} Aktion{card.activeActionCount > 1 ? 'en' : ''}
            </span>
          )}
          <span className="dvm-model-card__chip dvm-model-card__chip--muted">
            {card.deliveryTime}
          </span>
        </div>

        {card.actionLabels?.length > 0 && (
          <p className="dvm-model-card__actions">
            {card.actionLabels.join(' · ')}
          </p>
        )}

        <button
          type="button"
          className="dvm-model-card__cta"
          onClick={() => onManage?.(model)}
        >
          Verwalten
        </button>
      </div>
    </article>
  );
}
