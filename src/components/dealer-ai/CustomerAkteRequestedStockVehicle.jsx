import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CustomerAkteRequestedStockVehicle.css';

function formatPrice(price) {
  if (price == null) return null;
  return `${Number(price).toLocaleString('de-DE')} €`;
}

export default function CustomerAkteRequestedStockVehicle({
  stockVehicle,
  onOpenListing,
  onCreateOffer,
}) {
  if (!stockVehicle?.vehicleTitle) return null;

  return (
    <section className="cust-akte-stock" aria-label="Angefragtes Fahrzeug">
      <p className="cust-akte-stock__label">Angefragtes Fahrzeug</p>
      <p className="cust-akte-stock__title">{stockVehicle.vehicleTitle}</p>
      {stockVehicle.price != null && (
        <p className="cust-akte-stock__price">{formatPrice(stockVehicle.price)}</p>
      )}
      {stockVehicle.stockNumber && (
        <p className="cust-akte-stock__meta">Fahrzeug-Nr. {stockVehicle.stockNumber}</p>
      )}
      {stockVehicle.sourceLabel && (
        <p className="cust-akte-stock__meta">{stockVehicle.sourceLabel}</p>
      )}
      <div className="cust-akte-stock__actions">
        {stockVehicle.vehicleUrl && (
          <button type="button" className="cust-akte-stock__btn" onClick={() => onOpenListing?.(stockVehicle)}>
            Inserat öffnen
          </button>
        )}
        <button type="button" className="cust-akte-stock__btn cust-akte-stock__btn--primary" onClick={() => onCreateOffer?.(stockVehicle)}>
          Angebot erstellen
        </button>
      </div>
    </section>
  );
}

export function buildStockVehicleAktePath(leadId) {
  return buildKundenaktePath(leadId);
}
