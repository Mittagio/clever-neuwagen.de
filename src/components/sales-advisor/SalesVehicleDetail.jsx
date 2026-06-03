import CleverQuoteBadge, { CleverQuoteBreakdown } from '../cleverQuote/CleverQuoteBadge.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import {
  getFulfilledLabels,
  getMissingLabels,
} from '../../services/sales/salesAdvisorService.js';
import { useState } from 'react';

export default function SalesVehicleDetail({
  match,
  dealerName,
  onBack,
  shareSlot,
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  if (!match) return null;

  const v = match.vehicle;
  const title = match.model ?? `${v.brand} ${v.model}`;
  const rate = match.bestOffer?.monthlyRate ?? v.monthlyRate;
  const financeRate = v.financeRate ?? Math.round(rate * 1.08);
  const fulfilled = getFulfilledLabels(match);
  const missing = getMissingLabels(match);
  const availability = getAvailabilityPlainLabel(v.availability);
  const delivery = match.bestOffer?.deliveryTime ?? v.deliveryTime ?? '—';

  return (
    <div className="ss-detail">
      <button type="button" className="ss-detail__back" onClick={onBack}>← Zurück zu den Ergebnissen</button>

      <header className="ss-detail__head">
        <h1>Warum passt dieses Fahrzeug?</h1>
        <h2>{title}</h2>
        {match.cleverQuote && (
          <CleverQuoteBadge
            cleverQuote={match.cleverQuote}
            size="lg"
            onWhyClick={() => setBreakdownOpen(true)}
          />
        )}
      </header>

      <section className="ss-detail__pricing" aria-label="Preise">
        <div className="ss-price-tile">
          <p className="ss-price-tile__label">Leasing</p>
          <p className="ss-price-tile__value">{formatCurrency(rate)}/Monat</p>
        </div>
        <div className="ss-price-tile">
          <p className="ss-price-tile__label">Finanzierung</p>
          <p className="ss-price-tile__value">{formatCurrency(financeRate)}/Monat</p>
        </div>
        <div className="ss-price-tile">
          <p className="ss-price-tile__label">Kaufpreis</p>
          <p className="ss-price-tile__value">{v.cashPrice?.toLocaleString('de-DE')} €</p>
        </div>
      </section>

      <section className="ss-detail__meta">
        <p><strong>Lieferzeit:</strong> {delivery}</p>
        <p><strong>Verfügbarkeit:</strong> {availability}</p>
        {v.discountPercent > 0 && (
          <p><strong>Rabatt:</strong> {v.discountPercent} % Preisvorteil</p>
        )}
        <p><strong>Händler:</strong> {match.bestOffer?.dealer ?? v.dealerName ?? dealerName}</p>
      </section>

      <section className="ss-detail__wishes">
        <h3>Kundenwünsche</h3>
        <ul className="ss-wish-list ss-wish-list--ok">
          {fulfilled.map((label) => (
            <li key={label}><span aria-hidden>✓</span> {label}</li>
          ))}
        </ul>
        {missing.length > 0 && (
          <>
            <h3>Nicht erfüllt</h3>
            <ul className="ss-wish-list ss-wish-list--miss">
              {missing.map((label) => (
                <li key={label}><span aria-hidden>✗</span> {label}</li>
              ))}
            </ul>
          </>
        )}
        {match.cleverQuote?.upgrade && (
          <div className="ss-detail__upgrade">
            <p className="ss-detail__upgrade-title">Empfehlung für 100 % CleverQuote</p>
            <p className="ss-detail__upgrade-pkg">{match.cleverQuote.upgrade.packageName}</p>
            {match.cleverQuote.upgrade.impactLabel && (
              <p>{match.cleverQuote.upgrade.impactLabel}</p>
            )}
          </div>
        )}
      </section>

      {shareSlot}

      <CleverQuoteBreakdown
        cleverQuote={match.cleverQuote}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
    </div>
  );
}
