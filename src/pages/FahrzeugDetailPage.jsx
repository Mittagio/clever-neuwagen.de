import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { formatCurrency, getAvailabilityMeta } from '../logic/marketplaceService.js';
import './FahrzeugDetailPage.css';

export default function FahrzeugDetailPage() {
  const { slug } = useParams();
  const vehicle = MARKETPLACE_VEHICLES.find((item) => item.slug === slug);

  if (!vehicle) {
    return (
      <PageShell>
        <div className="vehicle-detail">
          <div className="vehicle-detail__container">
            <p>Fahrzeug nicht gefunden.</p>
            <Link to="/fahrzeuge">Zur Suche</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const availability = getAvailabilityMeta(vehicle.availability);
  const mapsQuery = encodeURIComponent(`${vehicle.dealerName}, ${vehicle.plz} ${vehicle.city}`);

  return (
    <PageShell>
      <div className="vehicle-detail">
        <div className="vehicle-detail__container">
          <Link to="/fahrzeuge" className="vehicle-detail__back">← Zur Fahrzeugsuche</Link>
          <article className="vehicle-detail__hero card">
            <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="vehicle-detail__image" />
            <div className="vehicle-detail__facts">
              <h1>{vehicle.title}</h1>
              <p className="vehicle-detail__rate">{formatCurrency(vehicle.monthlyRate)}/Monat</p>
              <p>Kaufpreis {formatCurrency(vehicle.cashPrice)} · Rabatt {vehicle.discountPercent}%</p>
              <p>Lieferzeit: {vehicle.deliveryTime}</p>
              <p>{availability.label}</p>
              <h2>Ausstattung</h2>
              <ul>
                {vehicle.equipment.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <h2>Ansprechpartner</h2>
              <p>{vehicle.contactName} · {vehicle.contactPhone}</p>
              <p>{vehicle.dealerName} · {vehicle.city} ({vehicle.distanceKm} km)</p>
              <div className="vehicle-detail__actions">
                <Link className="btn btn-primary btn-sm" to={`/haendler/${vehicle.dealerSlug}`}>Autohaus öffnen</Link>
                <Link className="btn btn-secondary btn-sm" to="/communication">Verkaufschance starten</Link>
              </div>
            </div>
          </article>

          <section className="vehicle-detail__map card">
            <h2>Karte & Entfernung</h2>
            <p>📍 {vehicle.dealerName} · {vehicle.distanceKm} km entfernt</p>
            <iframe
              title="Händlerstandort"
              src={`https://maps.google.com/maps?q=${mapsQuery}&z=11&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
