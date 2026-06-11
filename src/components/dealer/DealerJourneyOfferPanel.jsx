import { useMemo } from 'react';
import { buildJourneyOffers } from '../../services/dealer/journeyOfferService.js';
import './dealer-landing.css';

function OfferCard({ offer, highlighted }) {
  return (
    <article className={`dl-offer-card${highlighted ? ' dl-offer-card--primary' : ''}`}>
      <h3 className="dl-offer-card__label">{offer.label}</h3>
      <p className="dl-offer-card__headline">{offer.headline}</p>
      {offer.headline !== 'auf Anfrage' && offer.id !== 'cash' && (
        <p className="dl-offer-card__per-month">pro Monat</p>
      )}
      <ul className="dl-offer-card__lines">
        {offer.lines.map((line) => (
          <li key={`${offer.id}-${line.label}`}>
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </li>
        ))}
      </ul>
      <p className="dl-offer-card__disclaimer">{offer.disclaimer}</p>
    </article>
  );
}

/**
 * Phase 5 – persönliches Angebot mit Preisen.
 */
export default function DealerJourneyOfferPanel({
  journeySnapshot,
  dealerConditions,
  dealerName,
  onRequestLead,
}) {
  const offerBundle = useMemo(
    () => buildJourneyOffers(journeySnapshot, dealerConditions),
    [journeySnapshot, dealerConditions],
  );

  if (!offerBundle) {
    const title = journeySnapshot?.vehicle?.modelLabel
      ? `${journeySnapshot.vehicle.modelLabel} ${journeySnapshot.vehicle.trimLabel ?? ''}`.trim()
      : 'Ihr Fahrzeug';
    return (
      <section className="dl-offer-panel dl-offer-panel--request" aria-labelledby="dl-offer-panel-title">
        <h2 id="dl-offer-panel-title" className="dl-offer-panel__title">{title}</h2>
        <p className="dl-offer-panel__intro">
          Ihr Händler berechnet Kauf, Finanzierung und Leasing persönlich –
          auf Basis Ihrer Ausstattung und Sonderkonditionen.
        </p>
        {onRequestLead && (
          <button type="button" className="btn btn-primary dl-offer-panel__cta" onClick={onRequestLead}>
            Unverbindlich anfragen
          </button>
        )}
      </section>
    );
  }

  const primaryId = journeySnapshot?.purchaseType === 'open'
    ? null
    : journeySnapshot?.purchaseType;

  return (
    <section className="dl-offer-panel" aria-labelledby="dl-offer-panel-title">
      <header className="dl-offer-panel__head">
        <p className="dl-offer-panel__phase">Ihr Angebot</p>
        <h2 id="dl-offer-panel-title" className="dl-offer-panel__title">
          {offerBundle.vehicleTitle}
        </h2>
        {dealerName && (
          <p className="dl-offer-panel__dealer">
            Angebot von
            {' '}
            {dealerName}
            {offerBundle.discountPercent > 0 && (
              <>
                {' · '}
                {offerBundle.discountPercent}
                % Händlerrabatt
              </>
            )}
          </p>
        )}
        {offerBundle.showAllPaymentVariants && (
          <p className="dl-offer-panel__intro">
            Sie haben die Kaufart noch offen – hier alle drei Varianten zum Vergleich.
          </p>
        )}
      </header>

      <div className={`dl-offer-panel__grid dl-offer-panel__grid--${offerBundle.offers.length}`}>
        {offerBundle.offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            highlighted={!primaryId || primaryId === offer.id}
          />
        ))}
      </div>

      <p className="dl-offer-panel__delivery">
        Lieferzeit:
        {' '}
        {offerBundle.pricing.deliveryTime}
      </p>

      {onRequestLead && (
        <button type="button" className="btn btn-primary dl-offer-panel__cta" onClick={onRequestLead}>
          Unverbindlich anfragen
        </button>
      )}
    </section>
  );
}
