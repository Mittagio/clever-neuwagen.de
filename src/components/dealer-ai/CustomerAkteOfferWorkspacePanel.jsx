import { useMemo } from 'react';
import {
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../../services/customerAkte.js';
import { canEditOfferInCalculator } from '../../services/dealer/openOfferCalculator.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../../services/crm/vehicleTrack.js';
import {
  VEHICLE_OFFER_STATUS_UI,
} from '../../services/vehicleOffer.js';
import VehicleImage from '../shared/VehicleImage.jsx';
import { IconBack } from './AkteIcons.jsx';

/**
 * Angebot im Workspace über dem Verlauf – Composer bleibt App-Ebene sichtbar.
 * Filigran: navy/lavender, Rate dominant, Kundenwünsche als Chips bei Favorit.
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
  const offer = lead?.crm?.vehicleOffers?.[card?.id]
    ?? lead?.crm?.vehicleOffers?.[card?.configurationId]
    ?? card?.vehicleOffer
    ?? null;
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
  const canEdit = canEditOfferInCalculator(card, lead);

  const track = useMemo(() => {
    const tracks = listCustomerVehicleTracks(lead);
    return tracks.find((entry) => entry.id === card?.id || entry.id === card?.configurationId)
      ?? null;
  }, [lead, card?.id, card?.configurationId]);

  const wishChips = track?.status === VEHICLE_TRACK_STATUS.FAVORITE
    ? (track.requirementLabels ?? []).filter(Boolean)
    : [];

  const version = Number(offer?.version) || Number(track?.offerVersion) || 1;
  const pdf = offer?.pdf ?? null;
  const pdfHref = pdf?.dataUrl || pdf?.url || null;
  const pdfLabel = pdf?.fileName || pdf?.name || 'Original-PDF';

  const monthlyRate = track?.monthlyRate
    ?? card?.leasingData?.calculatedRate
    ?? card?.monthlyRate
    ?? null;
  const termMonths = track?.termMonths ?? card?.termMonths ?? card?.leasingData?.termMonths ?? null;
  const annualMileage = track?.annualMileage
    ?? card?.mileagePerYear
    ?? card?.leasingData?.mileagePerYear
    ?? null;
  const downPayment = track?.downPayment
    ?? card?.downPayment
    ?? card?.leasingData?.downPayment
    ?? null;

  const price = monthlyRate != null && Number.isFinite(Number(monthlyRate))
    ? `${Number(monthlyRate).toLocaleString('de-DE')} € / Monat`
    : formatVehicleCardPrice(card);

  const displayTitle = track?.displayName
    || title
    || [card?.brand, card?.model, card?.trimLabel].filter(Boolean).join(' ');

  const facts = useMemo(() => {
    const rows = [];
    if (price) rows.push({ label: 'Rate', value: price, dominant: true });
    if (termMonths != null) rows.push({ label: 'Laufzeit', value: `${termMonths} Monate` });
    if (annualMileage != null) {
      rows.push({
        label: 'Fahrleistung',
        value: `${Number(annualMileage).toLocaleString('de-DE')} km/Jahr`,
      });
    }
    if (downPayment != null && downPayment !== '') {
      rows.push({
        label: 'Sonderzahlung',
        value: `${Number(downPayment).toLocaleString('de-DE')} €`,
      });
    }
    if (!termMonths && !annualMileage && conditions) {
      rows.push({ label: 'Konditionen', value: conditions });
    }
    return rows;
  }, [price, termMonths, annualMileage, downPayment, conditions]);

  return (
    <div className="cust-offer-ws" role="region" aria-label="Angebot Workspace">
      <header className="cust-offer-ws__head">
        <button
          type="button"
          className="cust-offer-ws__back"
          onClick={onBack}
          aria-label="Zurück zum Verlauf"
        >
          <IconBack />
        </button>
        <div className="cust-offer-ws__head-main">
          <p className="cust-offer-ws__eyebrow">Angebot</p>
          <h2 className="cust-offer-ws__title">{title}</h2>
          <p className="cust-offer-ws__version">
            v{version}
            {' '}
            aktuell
          </p>
        </div>
        {onOpenBoard ? (
          <button
            type="button"
            className="cust-offer-ws__more"
            onClick={onOpenBoard}
            aria-label="Alle Angebote"
          >
            <span aria-hidden>···</span>
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

      {wishChips.length > 0 ? (
        <div className="cust-offer-ws__wishes" aria-label="Kundenwünsche">
          <p className="cust-offer-ws__wishes-label">Kundenwünsche</p>
          <ul className="cust-offer-ws__chips">
            {wishChips.map((label) => (
              <li key={label} className="cust-offer-ws__chip">{label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.length > 0 ? (
        <dl className="cust-offer-ws__facts">
          {facts.map((row) => (
            <div
              key={row.label}
              className={[
                'cust-offer-ws__fact',
                row.dominant ? 'cust-offer-ws__fact--rate' : '',
              ].filter(Boolean).join(' ')}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {pdfHref ? (
        <a
          className="cust-offer-ws__pdf"
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Original-PDF
          {pdfLabel && pdfLabel !== 'Original-PDF' ? (
            <span className="cust-offer-ws__pdf-name">{pdfLabel}</span>
          ) : null}
        </a>
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
