import PageShell from '../components/layout/PageShell';
import { Link } from 'react-router-dom';
import LandingHero from '../components/landing/LandingHero.jsx';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { formatCurrency } from '../logic/marketplaceService.js';
import './LandingPage.css';

export default function LandingPage() {
  const spotlightVehicles = MARKETPLACE_VEHICLES.slice(0, 4);

  return (
    <PageShell className="landing-shell">
      <div className="lp-page">
        <LandingHero />
        <div className="lp-page__container">
          <section className="lp-section">
            <h2>🔥 Aktuelle Angebote</h2>
            <div className="lp-offers-grid">
              {spotlightVehicles.map((vehicle) => (
                <article key={vehicle.id} className="lp-offer-card">
                  <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="lp-offer-card__img" />
                  <div className="lp-offer-card__body">
                    <strong>{vehicle.model}</strong>
                    <span>{formatCurrency(vehicle.monthlyRate)}/Monat</span>
                    <span>{vehicle.dealerName}</span>
                    <span>{vehicle.deliveryTime}</span>
                    <Link to={`/fahrzeug/${vehicle.slug}`} className="lp-offer-card__cta">Angebot ansehen</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
