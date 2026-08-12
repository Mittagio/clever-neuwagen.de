import { useState } from 'react';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';
import { IconBack, IconMoreDots, IconPhone, IconSearch } from './AkteIcons.jsx';
import './CustomerAkte.css';

function buildInitials(name = '') {
  const cleaned = String(name)
    .replace(/^(herr|frau)\s+/i, '')
    .trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

/**
 * Kompakter Header der Kundenakte (Messenger-Stil).
 * Nur in der Akte gerendert – kein redundanter Öffnen-CTA.
 * Avatar + Name / Kontext → Kundendaten-Sheet; Suche; ••• → seltene Aktionen.
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
  onSearch = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = formatCustomerDisplayName(customerName) || 'Kunde noch offen';
  const initials = buildInitials(displayName);
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
          <span className="cust-akte-compact-header__avatar" aria-hidden>
            {initials}
          </span>
          <span className="cust-akte-compact-header__text">
            <h1 className="cust-akte-compact-header__name">{displayName}</h1>
            {contextLine ? (
              <p className="cust-akte-compact-header__context">{contextLine}</p>
            ) : null}
            {!hasPhone ? (
              <p className="cust-akte-compact-header__hint" role="status">
                Telefon fehlt
              </p>
            ) : null}
          </span>
        </button>

        <div className="cust-akte-compact-header__actions">
          {typeof onSearch === 'function' ? (
            <button
              type="button"
              className="cust-akte-compact-header__icon-btn"
              onClick={onSearch}
              aria-label="In dieser Akte suchen"
            >
              <IconSearch />
            </button>
          ) : null}
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
            aria-label="Mehr"
            aria-expanded={menuOpen}
          >
            <IconMoreDots />
          </button>
        </div>
      </div>
    </header>
  );
}
