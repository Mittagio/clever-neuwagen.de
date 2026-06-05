import CleverQuoteBadge, { CleverQuoteBreakdown } from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import { buildRecommendReasons } from '../../services/cleverQuote/cleverQuoteRecommendation.js';
import {
  getMatchDisplayTitle,
  getMatchVariantLabel,
  formatMatchPrimaryPrice,
} from '../../logic/discoveryDisplay.js';
import { useState } from 'react';

export default function SalesVehicleDetail({
  match,
  trimVariants = [],
  dealerName,
  onBack,
  onSelectTrim,
  shareSlot,
  wishes = null,
  paymentMode = 'leasing',
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const trimLabel = getMatchVariantLabel(match);
  const rate = match.bestOffer?.monthlyRate ?? v.monthlyRate;
  const recommendReasons = buildRecommendReasons(match, { wishes, maxReasons: 5 });
  const availability = getAvailabilityPlainLabel(v.availability);
  const delivery = match.bestOffer?.deliveryTime ?? v.deliveryTime ?? '—';
  const dealerLabel = match.bestOffer?.dealer ?? v.dealerName ?? dealerName;

  const priceLabel = paymentMode === 'cash'
    ? `${v.cashPrice?.toLocaleString('de-DE')} €`
    : `${formatCurrency(rate)}/Monat`;
  const priceCaption = paymentMode === 'cash' ? 'Kaufpreis' : 'Leasing';
  const hasTrimPicker = trimVariants.length > 1;

  return (
    <div className="ss-detail">
      <button type="button" className="ss-detail__back" onClick={onBack}>← Zurück zu den Ergebnissen</button>

      <header className="ss-detail__head">
        <h1>{title}</h1>
        <p className="ss-detail__trim">{trimLabel}</p>
        {match.cleverQuote && (
          <CleverQuoteBadge
            cleverQuote={match.cleverQuote}
            size="lg"
            showTier={false}
            onWhyClick={() => setBreakdownOpen(true)}
          />
        )}
      </header>

      {hasTrimPicker && (
        <section className="ss-detail__trims" aria-label="Ausstattungen">
          <h2 className="ss-detail__trims-title">Ausstattungen im Modell</h2>
          <div className="ss-detail__trims-list">
            {trimVariants.map((entry) => {
              const price = formatMatchPrimaryPrice(entry.match, paymentMode);
              const isActive = entry.match.slug === match.slug;
              return (
                <button
                  key={entry.trimKey}
                  type="button"
                  className={`ss-detail__trim-btn${isActive ? ' ss-detail__trim-btn--active' : ''}`}
                  onClick={() => onSelectTrim?.(entry.match)}
                >
                  <span className="ss-detail__trim-name">
                    {entry.trimLabel}
                    {entry.isPrimary && ' · Empfohlen'}
                  </span>
                  <span className="ss-detail__trim-price">
                    ab {price.label}{price.suffix}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <RecommendReasonsPanel reasons={recommendReasons} title="Warum empfehlen wir dieses Fahrzeug?" />

      <section className="ss-detail__pricing ss-detail__pricing--single" aria-label="Preis">
        <div className="ss-price-tile ss-price-tile--primary">
          <p className="ss-price-tile__label">{priceCaption}</p>
          <p className="ss-price-tile__value">{priceLabel}</p>
        </div>
      </section>

      <section className="ss-detail__meta">
        <p><strong>Lieferzeit:</strong> {delivery}</p>
        <p><strong>Verfügbarkeit:</strong> {availability}</p>
        {v.discountPercent > 0 && (
          <p><strong>Rabatt:</strong> {v.discountPercent} % Preisvorteil</p>
        )}
        <p className="ss-detail__dealer"><strong>Händler:</strong> {dealerLabel}</p>
      </section>

      {match.cleverQuote?.upgrade && (
        <section className="ss-detail__upgrade">
          <p className="ss-detail__upgrade-title">Mehr CleverQuote mit Paket</p>
          <p className="ss-detail__upgrade-pkg">{match.cleverQuote.upgrade.packageName}</p>
          {match.cleverQuote.upgrade.impactLabel && (
            <p>{match.cleverQuote.upgrade.impactLabel}</p>
          )}
        </section>
      )}

      {shareSlot}

      <CleverQuoteBreakdown
        cleverQuote={match.cleverQuote}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
    </div>
  );
}
