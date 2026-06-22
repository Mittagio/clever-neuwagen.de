import {
  computeAkteCleverStaerke,
  formatCustomerSince,
  formatWhatsappHref,
  getAkteCleverLabel,
  getCustomerInitials,
} from '../../services/customerAkte.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import CustomerAkteKundenhelfer from './CustomerAkteKundenhelfer.jsx';
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
  onCleverAntwort,
  onOpenKundenhelfer,
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
            <h1 className="cust-akte-profile__name">{displayName}</h1>
          </button>

          {hasNamedCustomer ? (
            <>
              {sinceLine && <p className="cust-akte-profile__since">{sinceLine}</p>}
              <p className="cust-akte-profile__score">
                Clever-Stärke {score} %
              </p>
              <p className="cust-akte-profile__tier">{tier.shortLabel}</p>
            </>
          ) : (
            <>
              {vehicleLine && <p className="cust-akte-profile__vehicle">{vehicleLine}</p>}
              {referenceCode && <p className="cust-akte-profile__ref">{referenceCode}</p>}
              <p className="cust-akte-profile__score">Clever-Stärke {score} %</p>
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
              <span className="cust-akte-profile__contact-icon" aria-hidden>✉️</span>
              {email}
            </p>
          )}
        </div>
      )}

      <div className="cust-akte-profile__secondary">
        {whatsappHref ? (
          <a href={whatsappHref} className="cust-akte-profile__secondary-link" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        ) : (
          <span className="cust-akte-profile__secondary-link cust-akte-profile__secondary-link--muted">WhatsApp</span>
        )}
        {email ? (
          <a href={`mailto:${email}`} className="cust-akte-profile__secondary-link">E-Mail</a>
        ) : (
          <button type="button" className="cust-akte-profile__secondary-link" onClick={onEditCustomer}>
            E-Mail
          </button>
        )}
        {onCleverAntwort && (
          <button type="button" className="cust-akte-profile__secondary-link" onClick={onCleverAntwort}>
            Clever Antwort
          </button>
        )}
      </div>

      {onOpenKundenhelfer && (
        <CustomerAkteKundenhelfer
          notes={kundenhelferNotes}
          onOpenSheet={onOpenKundenhelfer}
          variant="profile"
        />
      )}
    </header>
  );
}
