import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  resolveVehicleStatus,
} from '../../services/customerAkte.js';
import './CustomerAkte.css';

export default function CustomerAkteVehicleCard({
  card,
  lead = null,
  index = 0,
  animateIn = false,
  onClick,
  onMenu,
}) {
  const title = formatVehicleCardTitle(card);
  const price = formatVehicleCardPrice(card);
  const status = resolveVehicleStatus(card, { lead });

  return (
    <article
      className={`cust-akte-vcard cust-akte-vcard--board${animateIn ? ' cust-akte-vcard--animate' : ''}`}
      style={{ '--card-index': index }}
    >
      <button
        type="button"
        className="cust-akte-vcard__main"
        onClick={() => onClick?.(card)}
        aria-label={`${title} – Vorschlag ansehen`}
      >
        <div className="cust-akte-vcard__visual">
          <VehicleImage
            brand="Kia"
            model={card.modelKey}
            bodyType={card.bodyType ?? 'suv'}
            variant="card"
            className="cust-akte-vcard__image-wrap"
            imageClassName="cust-akte-vcard__image"
          />
        </div>

        <div className="cust-akte-vcard__body">
          <p className="cust-akte-vcard__title">{title}</p>
          {price && <p className="cust-akte-vcard__price">{price}</p>}
          <span className={`cust-akte-vcard__status cust-akte-vcard__status--${status.tone}`}>
            {status.label}
          </span>
          {status.openQuestionCount > 0 && (
            <span className="cust-akte-vcard__question-hint">
              {status.openQuestionCount} Frage{status.openQuestionCount > 1 ? 'n' : ''} offen
            </span>
          )}
        </div>
      </button>

      <button
        type="button"
        className="cust-akte-vcard__menu"
        onClick={(e) => { e.stopPropagation(); onMenu?.(card); }}
        aria-label="Mehr Optionen"
      >
        ⋯
      </button>
    </article>
  );
}
