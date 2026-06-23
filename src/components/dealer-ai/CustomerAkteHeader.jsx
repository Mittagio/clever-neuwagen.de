import { useState } from 'react';
import {
  computeAkteCleverStaerke,
  formatCustomerSince,
  getAkteCleverLabel,
  getCleverScoreRingVariant,
} from '../../services/customerAkte.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import './CustomerAkte.css';

function buildMapsHref(address = '') {
  const trimmed = String(address).trim();
  if (!trimmed) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

async function copyToClipboard(text) {
  const value = String(text ?? '').trim();
  if (!value || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function ContactIconButton({
  label,
  onClick,
  href,
  children,
  className = '',
}) {
  const classes = `cust-akte-contact-row__icon-btn${className ? ` ${className}` : ''}`;

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        aria-label={label}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function ContactRow({
  value,
  emptyLabel,
  href,
  onAdd,
  onCopy,
  copied,
  showMap = false,
  mapsHref,
}) {
  const hasValue = Boolean(value?.trim());

  return (
    <div className={`cust-akte-contact-row${hasValue ? '' : ' cust-akte-contact-row--empty'}`}>
      <div className="cust-akte-contact-row__main">
        {hasValue ? (
          href ? (
            <a href={href} className="cust-akte-contact-row__link">
              {value}
            </a>
          ) : (
            <span className="cust-akte-contact-row__text">{value}</span>
          )
        ) : (
          <button type="button" className="cust-akte-contact-row__placeholder" onClick={onAdd}>
            {emptyLabel}
          </button>
        )}
      </div>
      {hasValue && (
        <div className="cust-akte-contact-row__actions">
          {showMap && mapsHref && (
            <ContactIconButton label="Route / Karte" href={mapsHref}>
              📍
            </ContactIconButton>
          )}
          {onCopy && (
            <ContactIconButton
              label={copied ? 'Kopiert' : 'Kopieren'}
              onClick={onCopy}
              className={copied ? 'cust-akte-contact-row__icon-btn--copied' : ''}
            >
              {copied ? '✓' : '⧉'}
            </ContactIconButton>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [copiedField, setCopiedField] = useState(null);

  const displayName = formatCustomerDisplayName(customerName) || 'Kunde noch offen';

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
  const scoreVariant = getCleverScoreRingVariant(score);
  const sinceLine = formatCustomerSince(customerSince);
  const addressLine = String(address ?? '').trim();
  const mapsHref = buildMapsHref(addressLine);

  const metaParts = [
    sinceLine,
    pipelineStatusLabel || tier.shortLabel,
  ].filter(Boolean);

  async function handleCopy(field, text) {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1600);
  }

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
            aria-label="Kontaktdaten bearbeiten"
          >
            <span aria-hidden>✎</span>
          </button>
        )}
      </div>

      <div className="cust-akte-profile__row">
        <div
          className={`cust-akte-profile__score-ring cust-akte-profile__score-ring--${scoreVariant}`}
          aria-label={`Clever-Stärke ${score} Prozent`}
        >
          <span className="cust-akte-profile__score-value">{score} %</span>
          <span className="cust-akte-profile__score-label">Clever</span>
        </div>

        <div className="cust-akte-profile__main">
          <h1 className="cust-akte-profile__name">{displayName}</h1>

          <div className="cust-akte-profile__contacts">
            <ContactRow
              value={phone}
              emptyLabel="Telefon hinzufügen"
              href={phone?.trim() ? (telHref ?? `tel:${phone.replace(/\s/g, '')}`) : null}
              onAdd={onEditCustomer}
              onCopy={phone?.trim() ? () => handleCopy('phone', phone) : null}
              copied={copiedField === 'phone'}
            />

            <ContactRow
              value={email}
              emptyLabel="E-Mail hinzufügen"
              href={email?.trim() ? `mailto:${email}` : null}
              onAdd={onEditCustomer}
              onCopy={email?.trim() ? () => handleCopy('email', email) : null}
              copied={copiedField === 'email'}
            />

            <ContactRow
              value={addressLine}
              emptyLabel="Adresse hinzufügen"
              onAdd={onEditCustomer}
              onCopy={addressLine ? () => handleCopy('address', addressLine) : null}
              copied={copiedField === 'address'}
              showMap={Boolean(addressLine)}
              mapsHref={mapsHref}
            />
          </div>

          {metaParts.length > 0 && (
            <p className="cust-akte-profile__meta-line">{metaParts.join(' · ')}</p>
          )}
        </div>
      </div>
    </header>
  );
}
