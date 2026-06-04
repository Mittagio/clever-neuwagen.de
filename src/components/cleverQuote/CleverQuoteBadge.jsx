import { useState } from 'react';
import {
  getCleverQuoteTier,
  partitionCleverQuoteItems,
  CLEVER_QUOTE_UNCERTAIN_LABEL,
} from '../../services/cleverQuote/cleverQuoteService.js';
import './cleverQuote.css';

export default function CleverQuoteBadge({
  cleverQuote,
  size = 'md',
  showTier = true,
  onWhyClick,
}) {
  if (!cleverQuote) return null;

  const tier = cleverQuote.tier ?? getCleverQuoteTier(cleverQuote.percent);
  const percentLabel = cleverQuote.percent != null
    ? `${cleverQuote.percent} %`
    : CLEVER_QUOTE_UNCERTAIN_LABEL;

  return (
    <div className={`clever-quote clever-quote--${size} clever-quote--${tier.dot}`}>
      <span className="clever-quote__dot" aria-hidden />
      <div className="clever-quote__text">
        <strong className="clever-quote__brand">CleverQuote {percentLabel}</strong>
        {showTier && (
          <span className="clever-quote__tier">{cleverQuote.tierLabel ?? tier.label}</span>
        )}
        {cleverQuote.fulfillmentLabel && size !== 'sm' && (
          <span className="clever-quote__fulfillment">Erfüllt {cleverQuote.fulfillmentLabel}</span>
        )}
      </div>
      {onWhyClick && (
        <button type="button" className="clever-quote__why" onClick={onWhyClick}>
          {cleverQuote.percent != null ? `Warum ${cleverQuote.percent} %?` : 'Details anzeigen'}
        </button>
      )}
    </div>
  );
}

export function CleverQuoteBreakdown({
  cleverQuote,
  open,
  onClose,
  onAcceptUpgrade,
  paymentMode = 'leasing',
}) {
  if (!open || !cleverQuote) return null;

  const upgrade = cleverQuote.upgrade;
  const { fulfilled, packageNeeded, missing, uncertain } = partitionCleverQuoteItems(cleverQuote);

  function renderGroup(title, items, icon, className) {
    if (!items.length) return null;
    return (
      <div className={`clever-quote-breakdown__group ${className}`}>
        <p className="clever-quote-breakdown__group-title">{title}</p>
        <ul className="clever-quote-breakdown__list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`clever-quote-breakdown__item clever-quote-breakdown__item--${item.status}`}
            >
              <span className="clever-quote-breakdown__icon" aria-hidden>{icon}</span>
              <span>{item.label}</span>
              <span className="clever-quote-breakdown__status">
                {item.status === 'fulfilled' && (item.via === 'package' ? 'Im Paket' : 'vorhanden')}
                {item.status === 'package' && 'Paket nötig'}
                {item.status === 'missing' && 'fehlt'}
                {item.status === 'uncertain' && 'unsicher'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="clever-quote-breakdown-backdrop" role="presentation" onClick={onClose}>
      <div
        className="clever-quote-breakdown"
        role="dialog"
        aria-labelledby="cq-breakdown-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="clever-quote-breakdown__head">
          <h2 id="cq-breakdown-title">
            {cleverQuote.percent != null
              ? `Warum ${cleverQuote.percent} %?`
              : 'CleverQuote – Einschätzung'}
          </h2>
          <button type="button" className="clever-quote-breakdown__close" onClick={onClose} aria-label="Schließen">×</button>
        </header>
        <p className="clever-quote-breakdown__lead">
          CleverQuote™ bewertet, wie gut dieses Fahrzeug zu Ihren Wünschen passt.
          Unklare Ausstattungen werden nicht geraten.
        </p>
        {cleverQuote.trustNote && (
          <p className="clever-quote-breakdown__trust">{cleverQuote.trustNote}</p>
        )}
        {renderGroup('Bereits enthalten', fulfilled, '✓', 'clever-quote-breakdown__group--ok')}
        {renderGroup('Fehlt', missing, '✗', 'clever-quote-breakdown__group--no')}
        {renderGroup('Mit Paket möglich', packageNeeded, '○', 'clever-quote-breakdown__group--pkg')}
        {renderGroup(CLEVER_QUOTE_UNCERTAIN_LABEL, uncertain, '?', 'clever-quote-breakdown__group--uncertain')}
        {upgrade && (
          <div className="clever-quote-breakdown__upgrade">
            <p className="clever-quote-breakdown__upgrade-title">Lösung</p>
            <p className="clever-quote-breakdown__upgrade-pkg">{upgrade.packageName}</p>
            {upgrade.impactLabel && (
              <p className="clever-quote-breakdown__upgrade-impact">{upgrade.impactLabel}</p>
            )}
            {upgrade.bonusLabels?.length > 0 && (
              <ul className="clever-quote-breakdown__bonus">
                {upgrade.bonusLabels.map((l) => (
                  <li key={l}><span aria-hidden>✓</span> {l}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="vd-btn vd-btn--primary vd-btn--block"
              onClick={() => onAcceptUpgrade?.(upgrade.packageId)}
            >
              {upgrade.packageName} übernehmen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CleverQuoteCompareCards({ matches = [], paymentMode = 'leasing', onViewVehicle }) {
  if (!matches.length) return null;

  return (
    <div className="clever-quote-compare">
      <h2 className="clever-quote-compare__title">Welches Fahrzeug erfüllt Ihre Wünsche am besten?</h2>
      <div className="clever-quote-compare__grid">
        {matches.map((m) => (
          <article key={m.slug} className="clever-quote-compare-card">
            <CleverQuoteBadge cleverQuote={m.cleverQuote} size="sm" showTier={false} />
            <h3>{m.model}{m.bestTrim ? ` ${m.bestTrim}` : ''}</h3>
            <p className="clever-quote-compare-card__rate">
              {m.cleverQuote?.label}
            </p>
            <p className="clever-quote-compare-card__price">
              {m.bestOffer?.monthlyRate != null && paymentMode !== 'cash'
                ? `${m.bestOffer.monthlyRate} €/Monat`
                : m.vehicle?.cashPrice
                  ? `${m.vehicle.cashPrice.toLocaleString('de-DE')} €`
                  : ''}
            </p>
            {onViewVehicle && (
              <button
                type="button"
                className="clever-quote-compare-card__cta"
                onClick={() => onViewVehicle(m)}
              >
                Angebot ansehen
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
