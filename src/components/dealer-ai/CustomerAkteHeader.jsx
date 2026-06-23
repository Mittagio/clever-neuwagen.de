import {
  computeAkteCleverStaerke,
  formatCustomerSince,
  getAkteCleverLabel,
  getCustomerInitials,
} from '../../services/customerAkte.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import { phoneTelHref } from '../../services/dealerAiLeadCrm.js';
import './CustomerAkte.css';

export default function CustomerAkteHeader({
  customerName,
  phone = '',
  email = '',
  address = '',
  customerSince,
  cleverScore,
  kundenhelferNotes = '',
  vehicleCardCount = 0,
  offersCount = 0,
  hasNextStep = true,
  pipelineStatusLabel = '',
  onBack,
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

  const metaParts = [
    sinceLine,
    hasNamedCustomer ? `Clever-Stärke ${score} %` : null,
    pipelineStatusLabel || tier.shortLabel,
  ].filter(Boolean);

  return (
    <header className="cust-akte-profile">
      <div className="cust-akte-profile__top">
        {onBack && (
          <button type="button" className="cust-akte-profile__back" onClick={onBack} aria-label="Zurück">
            <span aria-hidden>←</span>
          </button>
        )}
        {onEditCustomer && (
          <button
            type="button"
            className="cust-akte-profile__edit"
            onClick={onEditCustomer}
            aria-label="Kunde bearbeiten"
          >
            <span aria-hidden>✎</span>
          </button>
        )}
      </div>

      <div className="cust-akte-profile__row">
        <div className="cust-akte-profile__avatar" aria-hidden>{initials}</div>
        <div className="cust-akte-profile__main">
          <h1 className="cust-akte-profile__name">{displayName}</h1>

          <div className="cust-akte-profile__contacts">
            {phone ? (
              <a href={telHref ?? `tel:${phone.replace(/\s/g, '')}`} className="cust-akte-profile__contact cust-akte-profile__contact--link">
                {phone}
              </a>
            ) : (
              <span className="cust-akte-profile__contact cust-akte-profile__contact--muted">Telefon nicht hinterlegt</span>
            )}
            {email ? (
              <a href={`mailto:${email}`} className="cust-akte-profile__contact cust-akte-profile__contact--link">
                {email}
              </a>
            ) : null}
            {address?.trim() ? (
              <span className="cust-akte-profile__contact">{address.trim()}</span>
            ) : null}
          </div>

          {metaParts.length > 0 && (
            <p className="cust-akte-profile__meta-line">{metaParts.join(' · ')}</p>
          )}
        </div>
      </div>
    </header>
  );
}
