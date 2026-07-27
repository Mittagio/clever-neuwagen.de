import { useState } from 'react';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import { IconBack, IconMoreDots, IconPhone } from './AkteIcons.jsx';
import './CustomerAkte.css';

/**
 * Kompakter Header der Kundenakte (Messenger-Stil).
 * Name / Kontext → Kontaktinfos; ••• → seltene Aktionen.
 */
export default function CustomerAkteCompactHeader({
  customerName = '',
  contextLine = '',
  telHref = null,
  phone = '',
  onBack,
  onMore,
  onOpenProfile = null,
  onMissingPhone,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = formatCustomerDisplayName(customerName) || 'Kunde noch offen';
  const hasPhone = Boolean(String(phone ?? '').trim() && telHref);

  function handleCall() {
    if (hasPhone) return;
    onMissingPhone?.();
  }

  function handleMore() {
    setMenuOpen((open) => !open);
    onMore?.();
  }

  return (
    <header className="cust-akte-compact-header">
      <div className="cust-akte-compact-header__row">
        {onBack ? (
          <button
            type="button"
            className="cust-akte-compact-header__back"
            onClick={onBack}
            aria-label="Zurück"
          >
            <IconBack />
          </button>
        ) : (
          <span className="cust-akte-compact-header__spacer" aria-hidden />
        )}

        <button
          type="button"
          className="cust-akte-compact-header__identity cust-akte-compact-header__identity--btn"
          onClick={() => onOpenProfile?.()}
          aria-label={`${displayName} – Infos öffnen`}
        >
          <h1 className="cust-akte-compact-header__name">{displayName}</h1>
          {contextLine ? (
            <p className="cust-akte-compact-header__context">{contextLine}</p>
          ) : null}
          {!hasPhone ? (
            <p className="cust-akte-compact-header__hint" role="status">
              Telefon fehlt
            </p>
          ) : null}
        </button>

        <div className="cust-akte-compact-header__actions">
          {hasPhone ? (
            <a
              href={telHref}
              className="cust-akte-compact-header__icon-btn"
              aria-label="Anrufen"
            >
              <IconPhone />
            </a>
          ) : (
            <button
              type="button"
              className="cust-akte-compact-header__icon-btn cust-akte-compact-header__icon-btn--muted"
              onClick={handleCall}
              aria-label="Telefon fehlt"
              title="Telefon fehlt"
            >
              <IconPhone />
            </button>
          )}
          <button
            type="button"
            className="cust-akte-compact-header__icon-btn"
            onClick={handleMore}
            aria-label="Mehr Aktionen"
            aria-expanded={menuOpen}
          >
            <IconMoreDots />
          </button>
        </div>
      </div>
    </header>
  );
}
