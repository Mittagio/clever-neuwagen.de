import { useState } from 'react';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import './CustomerAkte.css';

/**
 * Kompakter Header der Mobile-Kundenakte (kein CRM-Block).
 */
export default function CustomerAkteCompactHeader({
  customerName = '',
  contextLine = '',
  telHref = null,
  phone = '',
  onBack,
  onMore,
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
            ←
          </button>
        ) : (
          <span className="cust-akte-compact-header__spacer" aria-hidden />
        )}

        <div className="cust-akte-compact-header__identity">
          <h1 className="cust-akte-compact-header__name">{displayName}</h1>
          {contextLine ? (
            <p className="cust-akte-compact-header__context">{contextLine}</p>
          ) : null}
        </div>

        <div className="cust-akte-compact-header__actions">
          {hasPhone ? (
            <a
              href={telHref}
              className="cust-akte-compact-header__icon-btn"
              aria-label="Anrufen"
            >
              📞
            </a>
          ) : (
            <button
              type="button"
              className="cust-akte-compact-header__icon-btn cust-akte-compact-header__icon-btn--muted"
              onClick={handleCall}
              aria-label="Telefonnummer fehlt"
              title="Telefonnummer fehlt"
            >
              📞
            </button>
          )}
          <button
            type="button"
            className="cust-akte-compact-header__icon-btn"
            onClick={handleMore}
            aria-label="Mehr Aktionen"
            aria-expanded={menuOpen}
          >
            •••
          </button>
        </div>
      </div>
      {!hasPhone ? (
        <p className="cust-akte-compact-header__hint" role="status">
          Telefonnummer fehlt
        </p>
      ) : null}
    </header>
  );
}
