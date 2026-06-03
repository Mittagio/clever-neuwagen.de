import { useState } from 'react';
import { formatCurrency, getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import { normalizePaymentModeInput } from '../../services/pricing/pricingResolver.js';
import './vehicle-detail.css';

export default function DealerOffersTable({
  offers = [],
  payment = 'leasing',
  onSelectDealer,
  onExpandRadius,
  onViewOffer,
  embedded = false,
  compareOpen: compareOpenProp,
  onCompareOpenChange,
}) {
  const [compareOpenLocal, setCompareOpenLocal] = useState(false);
  const compareOpen = onCompareOpenChange ? compareOpenProp : compareOpenLocal;
  const setCompareOpen = onCompareOpenChange ?? setCompareOpenLocal;

  if (!offers.length) return null;
  if (embedded && !compareOpen) return null;

  function rateForOffer(offer) {
    const mode = normalizePaymentModeInput(payment);
    if (mode === 'cash') return formatCurrency(offer.cashPrice);
    if (mode === 'finance') {
      return `${formatCurrency(offer.financeRate ?? offer.monthlyRate)}/Monat`;
    }
    return `${formatCurrency(offer.monthlyRate)}/Monat`;
  }

  if (!embedded && offers.length === 1) {
    const offer = offers[0];
    const avail = getAvailabilityPlainLabel(offer.availability);
    return (
      <section className="vd-offers vd-offers--single" aria-label="Lokales Angebot">
        <h2 className="vd-section-title">Bestes lokales Angebot</h2>
        <p className="vd-offers__dealer-name">{offer.dealerName}</p>
        <p className="vd-offers__detail-line">
          {offer.distanceKm} km entfernt · {rateForOffer(offer)} · {avail}
        </p>
        <div className="vd-offers__actions">
          <button
            type="button"
            className="vd-btn vd-btn--secondary vd-btn--sm"
            onClick={() => (onViewOffer ? onViewOffer(offer) : onSelectDealer?.(offer))}
          >
            Angebot ansehen
          </button>
          {onExpandRadius && (
            <button type="button" className="vd-btn vd-btn--ghost" onClick={onExpandRadius}>
              Weitere Händler ab 50 km
            </button>
          )}
        </div>
      </section>
    );
  }

  const best = offers[0];
  const bestAvail = getAvailabilityPlainLabel(best.availability);

  if (!embedded && !compareOpen) {
    return (
      <section className="vd-offers vd-offers--compare-teaser vd-tool-row" aria-label="Händler vergleichen">
        <div className="vd-offers__compare-head">
          <div>
            <h2 className="vd-offers__compare-title">Weitere Händler vergleichen</h2>
            <p className="vd-offers__compare-sub">
              {offers.length} Angebote · Bestes: {best.dealerName} · {rateForOffer(best)}
            </p>
          </div>
          <button
            type="button"
            className="vd-calc__teaser-btn"
            onClick={() => setCompareOpen(true)}
            aria-expanded={false}
          >
            Vergleichen
          </button>
        </div>
        <p className="vd-offers__compare-hint">
          {best.distanceKm} km · {bestAvail}
        </p>
      </section>
    );
  }

  const visible = offers.slice(0, 8);

  return (
    <section
      id="vd-offers-compare"
      className={`vd-offers vd-offers--compare-open${embedded ? ' vd-offers--embedded' : ''}`}
      aria-label="Händlervergleich"
    >
      <div className="vd-offers__compare-head">
        <h2 className="vd-section-title">Händlervergleich</h2>
        <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setCompareOpen(false)}>
          Schließen
        </button>
      </div>
      <ul className="vd-offers__list">
        {visible.map((offer, index) => {
          const avail = getAvailabilityPlainLabel(offer.availability);
          const isBest = index === 0;
          return (
            <li key={offer.dealerSlug} className={`vd-offer-row${isBest ? ' is-best' : ''}`}>
              <div className="vd-offer-row__main">
                <p className="vd-offer-row__dealer">
                  {offer.dealerName}
                  {isBest && <span className="vd-offer-row__badge">Bestes Angebot</span>}
                </p>
                <p className="vd-offer-row__meta">
                  {offer.distanceKm} km entfernt · {rateForOffer(offer)} · {avail}
                </p>
              </div>
              <button
                type="button"
                className="vd-btn vd-btn--secondary vd-btn--sm"
                onClick={() => onSelectDealer?.(offer)}
              >
                Ansehen
              </button>
            </li>
          );
        })}
      </ul>
      {onExpandRadius && (
        <button type="button" className="vd-btn vd-btn--ghost" onClick={onExpandRadius}>
          Weitere Händler ab 50 km
        </button>
      )}
    </section>
  );
}
