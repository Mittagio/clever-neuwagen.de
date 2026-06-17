import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatPaymentBadge,
  formatVehicleCardConditionsDot,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  resolveVehicleFooter,
  resolveVehicleStatus,
} from '../../services/customerAkte.js';
import './CustomerAkte.css';

const FOOTER_ICONS = {
  eye: '👁',
  bulb: '💡',
  clock: '🕐',
};

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
  const footer = resolveVehicleFooter(card, index);
  const payment = formatPaymentBadge(card.paymentType);

  return (
    <article
      className={`cust-akte-vcard${animateIn ? ' cust-akte-vcard--animate' : ''}`}
      style={{ '--card-index': index }}
    >
      <span className={`cust-akte-vcard__status cust-akte-vcard__status--${status.tone}`}>
        {status.label}
      </span>

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
          <p className="cust-akte-vcard__payment-row">
            <span className={`cust-akte-vcard__payment cust-akte-vcard__payment--${payment.tone}`}>
              {payment.label}
            </span>
          </p>
          {conditions && (
            <p className="cust-akte-vcard__conditions">{conditions}</p>
          )}
          {price && (
            <p className="cust-akte-vcard__price">{price}</p>
          )}
        </div>

        <div className="cust-akte-vcard__aside">
          <button
            type="button"
            className="cust-akte-vcard__menu"
            onClick={(e) => { e.stopPropagation(); onMenu?.(card); }}
            aria-label="Mehr Optionen"
          >
            ⋯
          </button>
          <span className="cust-akte-vcard__chev" aria-hidden>›</span>
        </div>
      </button>

      <div className={`cust-akte-vcard__footer cust-akte-vcard__footer--${footer.tone}`}>
        <span className="cust-akte-vcard__footer-icon" aria-hidden>
          {FOOTER_ICONS[footer.icon] ?? '•'}
        </span>
        <span>{footer.label}</span>
      </div>
    </article>
  );
}
