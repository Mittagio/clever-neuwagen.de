import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatPaymentBadge,
  formatVehicleCardConditionsDot,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  resolveVehicleStatus,
} from '../../services/customerAkte.js';
import './CustomerAkte.css';

export default function CustomerAkteVehicleCard({
  card,
  index = 0,
  animateIn = false,
  onClick,
  onMenu,
}) {
  const title = formatVehicleCardTitle(card);
  const conditions = formatVehicleCardConditionsDot(card);
  const price = formatVehicleCardPrice(card);
  const status = resolveVehicleStatus(card);
  const payment = formatPaymentBadge(card.paymentType);

  return (
    <article
      className={`cust-akte-vcard cust-akte-vcard--compact${animateIn ? ' cust-akte-vcard--animate' : ''}`}
      style={{ '--card-index': index }}
    >
      <button
        type="button"
        className="cust-akte-vcard__main"
        onClick={() => onClick?.(card)}
        aria-label={`${title} bearbeiten`}
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
          {conditions && (
            <p className="cust-akte-vcard__conditions">{conditions}</p>
          )}
          {!price && payment?.label && (
            <p className="cust-akte-vcard__conditions">{payment.label}</p>
          )}
          <p className={`cust-akte-vcard__status-line cust-akte-vcard__status-line--${status.tone}`}>
            {status.label}
          </p>
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
