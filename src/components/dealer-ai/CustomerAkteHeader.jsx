import {
  computeAkteCleverStaerke,
  formatCustomerSince,
  formatWhatsappHref,
  getAkteCleverLabel,
  getCustomerInitials,
} from '../../services/customerAkte.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import './CustomerAkte.css';

export default function CustomerAkteHeader({
  customerName,
  phone = '',
  email = '',
  customerSince,
  cleverScore,
  vehicleLine,
  referenceCode,
  kundenhelferNotes = '',
  vehicleCardCount = 0,
  offersCount = 0,
  hasNextStep = true,
  isStarred = false,
  onEditCustomer,
  telHref,
}) {
  const displayName = formatCustomerDisplayName(customerName) || 'Kunde noch offen';
  const hasNamedCustomer = displayName !== 'Kunde noch offen';

  const score = cleverScore ?? computeAkteCleverStaerke({
    name: customerName,
    phone,
    email,
    kundenhelferNotes,
    vehicleCardCount,
    offersCount,
    hasNextStep,
  });

  const tier = getAkteCleverLabel(score);
  const sinceLine = formatCustomerSince(customerSince);
  const initials = getCustomerInitials(customerName);
  const whatsappHref = formatWhatsappHref(phone);
  const showStar = isStarred || score >= 70;

  return (
    <header className="cust-akte-profile">
      <div className="cust-akte-profile__row">
        <div className="cust-akte-profile__avatar" aria-hidden>{initials}</div>
        <div className="cust-akte-profile__main">
          <button
            type="button"
            className="cust-akte-profile__name-btn"
            onClick={onEditCustomer}
          >
            <h1 className="cust-akte-profile__name">
              {displayName}
              {showStar && hasNamedCustomer && (
                <span className="cust-akte-profile__star" aria-label="Wichtiger Kunde">★</span>
              )}
            </h1>
          </button>

          {hasNamedCustomer ? (
            <>
              <p className="cust-akte-profile__meta">
                {sinceLine && <span>{sinceLine}</span>}
                {sinceLine && <span className="cust-akte-profile__sep">·</span>}
                <span>Clever-Stärke {score} %</span>
                <span className="cust-akte-profile__info" title={tier.label} aria-label={tier.label}>ⓘ</span>
              </p>
              <p className="cust-akte-profile__tier">{tier.shortLabel}</p>
            </>
          ) : (
            <>
              {vehicleLine && <p className="cust-akte-profile__vehicle">{vehicleLine}</p>}
              {referenceCode && <p className="cust-akte-profile__ref">{referenceCode}</p>}
              <p className="cust-akte-profile__meta">
                <span>Clever-Stärke {score} %</span>
              </p>
            </>
          )}
        </div>
      </div>

      {hasNamedCustomer && (phone || email) && (
        <div className="cust-akte-profile__contacts">
          {phone && (
            <p className="cust-akte-profile__contact">
              <span className="cust-akte-profile__contact-icon" aria-hidden>📞</span>
              {phone}
            </p>
          )}
          {email && (
            <p className="cust-akte-profile__contact">
              <span className="cust-akte-profile__contact-icon" aria-hidden>✉</span>
              {email}
            </p>
          )}
        </div>
      )}

      <div className="cust-akte-profile__quick">
        {telHref ? (
          <a href={telHref} className="cust-akte-profile__quick-btn">Anrufen</a>
        ) : (
          <button type="button" className="cust-akte-profile__quick-btn" onClick={onEditCustomer}>
            Anrufen
          </button>
        )}
        {whatsappHref ? (
          <a href={whatsappHref} className="cust-akte-profile__quick-btn" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        ) : (
          <button type="button" className="cust-akte-profile__quick-btn" disabled>
            WhatsApp
          </button>
        )}
        {email ? (
          <a href={`mailto:${email}`} className="cust-akte-profile__quick-btn">E-Mail</a>
        ) : (
          <button type="button" className="cust-akte-profile__quick-btn" onClick={onEditCustomer}>
            E-Mail
          </button>
        )}
      </div>
    </header>
  );
}
