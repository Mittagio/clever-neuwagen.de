import { useMemo } from 'react';
import {
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../../services/customerAkte.js';
import { canEditOfferInCalculator } from '../../services/dealer/openOfferCalculator.js';
import {
  VEHICLE_OFFER_STATUS_UI,
} from '../../services/vehicleOffer.js';
import VehicleImage from '../shared/VehicleImage.jsx';

/**
 * Angebot im Workspace über dem Verlauf – Composer bleibt App-Ebene sichtbar.
 */
export default function CustomerAkteOfferWorkspacePanel({
  card,
  lead = null,
  onBack,
  onEdit,
  onOpenBoard = null,
}) {
  const title = formatVehicleCardTitle(card);
  const conditions = formatVehicleCardConditions(card);
  const price = formatVehicleCardPrice(card);
  const offer = lead?.crm?.vehicleOffers?.[card?.id]
    ?? lead?.crm?.vehicleOffers?.[card?.configurationId]
    ?? card?.vehicleOffer
    ?? null;
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
  const canEdit = canEditOfferInCalculator(card, lead);

  const facts = useMemo(() => {
    const rows = [];
    if (price) rows.push({ label: 'Rate / Preis', value: price });
    if (card?.termMonths) rows.push({ label: 'Laufzeit', value: `${card.termMonths} Monate` });
    if (card?.mileagePerYear) {
      rows.push({
        label: 'Fahrleistung',
        value: `${Number(card.mileagePerYear).toLocaleString('de-DE')} km/Jahr`,
      });
    }
    if (card?.downPayment != null && card.downPayment !== '') {
      rows.push({
        label: 'Sonderzahlung',
        value: `${Number(card.downPayment).toLocaleString('de-DE')} €`,
      });
    }
    if (conditions && !card?.termMonths) {
      rows.push({ label: 'Konditionen', value: conditions });
    }
    return rows;
  }, [card, conditions, price]);

  return (
    <div className="cust-offer-ws" role="region" aria-label="Angebot Workspace">
      <header className="cust-offer-ws__head">
        <button
          type="button"
          className="cust-offer-ws__back"
          onClick={onBack}
          aria-label="Zurück zum Verlauf"
        >
          ←
        </button>
        <div className="cust-offer-ws__head-main">
          <p className="cust-offer-ws__eyebrow">Angebot</p>
          <h2 className="cust-offer-ws__title">{title}</h2>
        </div>
        {onOpenBoard ? (
          <button
            type="button"
            className="cust-offer-ws__more"
            onClick={onOpenBoard}
            aria-label="Alle Angebote"
          >
            •••
          </button>
        ) : <span className="cust-offer-ws__more-spacer" aria-hidden />}
      </header>

      <div className="cust-offer-ws__hero">
        <div className="cust-offer-ws__visual">
          <VehicleImage
            brand="Kia"
            model={card?.modelKey}
            bodyType={card?.bodyType ?? 'suv'}
            variant="card"
            className="cust-offer-ws__image-wrap"
            imageClassName="cust-offer-ws__image"
          />
        </div>
        <div className="cust-offer-ws__summary">
          {price ? <p className="cust-offer-ws__price">{price}</p> : null}
          {conditions ? <p className="cust-offer-ws__conditions">{conditions}</p> : null}
          <span className={`cust-offer-ws__badge cust-offer-ws__badge--${statusUi.tone || 'draft'}`}>
            {statusUi.badge || 'Entwurf'}
          </span>
        </div>
      </div>

      {facts.length > 0 ? (
        <dl className="cust-offer-ws__facts">
          {facts.map((row) => (
            <div key={row.label} className="cust-offer-ws__fact">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="cust-offer-ws__hint">
        Clever kennt dieses Angebot – sprich unten einfach Änderungen oder eine Nachricht aus.
      </p>

      <div className="cust-offer-ws__actions">
        {canEdit && onEdit ? (
          <button type="button" className="dai-btn dai-btn--primary" onClick={() => onEdit(card)}>
            Bearbeiten
          </button>
        ) : null}
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onBack}>
          Zum Verlauf
        </button>
      </div>
    </div>
  );
}
