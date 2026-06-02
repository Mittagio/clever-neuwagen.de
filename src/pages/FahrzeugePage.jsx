import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import {
  MARKETPLACE_VEHICLES,
  MARKETPLACE_SEO_LANDING_PAGES,
  MARKETPLACE_RADIUS_OPTIONS,
  MARKETPLACE_RATE_OPTIONS,
  MARKETPLACE_PRICE_OPTIONS,
  MARKETPLACE_TYPE_OPTIONS,
} from '../data/marketplaceVehicles.js';
import {
  parseMarketplaceQuery,
  buildMarketplaceSearch,
  filterMarketplaceVehicles,
  getAvailabilityMeta,
  formatCurrency,
} from '../logic/marketplaceService.js';
import './FahrzeugePage.css';

export default function FahrzeugePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [compareIds, setCompareIds] = useState([]);
  const filters = parseMarketplaceQuery(new URLSearchParams(location.search));

  const results = useMemo(
    () => filterMarketplaceVehicles(MARKETPLACE_VEHICLES, filters),
    [filters],
  );

  function updateFilter(field, value) {
    const next = { ...filters, [field]: value, seo: '' };
    const query = buildMarketplaceSearch(next);
    navigate(`/fahrzeuge${query ? `?${query}` : ''}`);
  }

  function toggleCompare(id) {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 3)));
  }

  const compareVehicles = MARKETPLACE_VEHICLES.filter((vehicle) => compareIds.includes(vehicle.id));

  return (
    <PageShell>
      <div className="marketplace-page">
        <div className="marketplace-page__container">
          <header className="marketplace-head">
            <h1>Fahrzeuge in Ihrer Nähe</h1>
            <p>ImmoScout-Gefühl für Neuwagen: vergleichen, filtern, direkt anfragen.</p>
          </header>

          <section className="marketplace-filters card">
            <input
              type="search"
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
              placeholder="PLZ oder Ort"
              className="form-input"
            />
            <select className="form-select" value={filters.radius ?? ''} onChange={(event) => updateFilter('radius', event.target.value ? Number(event.target.value) : null)}>
              <option value="">Radius wählen</option>
              {MARKETPLACE_RADIUS_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
            </select>
            <select className="form-select" value={filters.maxRate ?? ''} onChange={(event) => updateFilter('maxRate', event.target.value ? Number(event.target.value) : null)}>
              <option value="">Rate</option>
              {MARKETPLACE_RATE_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
            </select>
            <select className="form-select" value={filters.maxPrice ?? ''} onChange={(event) => updateFilter('maxPrice', event.target.value ? Number(event.target.value) : null)}>
              <option value="">Kaufpreis</option>
              {MARKETPLACE_PRICE_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
            </select>
            <select className="form-select" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              {MARKETPLACE_TYPE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </section>

          <section className="marketplace-seo card">
            <p>SEO-Landingpages</p>
            <div className="marketplace-seo__links">
              {MARKETPLACE_SEO_LANDING_PAGES.map((item) => (
                <Link key={item.slug} to={`/fahrzeuge?seo=${item.slug}`}>{item.label}</Link>
              ))}
            </div>
          </section>

          <section className="marketplace-results">
            {results.map((vehicle) => {
              const availability = getAvailabilityMeta(vehicle.availability);
              return (
                <article key={vehicle.id} className="market-card card">
                  <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="market-card__image" />
                  <div className="market-card__body">
                    <h2>{vehicle.title}</h2>
                    <p className="market-card__rate">{formatCurrency(vehicle.monthlyRate)}/Monat</p>
                    <p>{vehicle.discountPercent}% Rabatt · {vehicle.deliveryTime}</p>
                    <p>{vehicle.dealerName} · {vehicle.distanceKm} km entfernt</p>
                    <p className={`market-card__availability market-card__availability--${availability.color}`}>{availability.label}</p>
                    <div className="market-card__actions">
                      <Link className="btn btn-primary btn-sm" to={`/fahrzeug/${vehicle.slug}`}>Angebot ansehen</Link>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleCompare(vehicle.id)}>Vergleichen</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {results.length === 0 && <p className="marketplace-empty card">Keine Treffer. Filter erweitern oder Radius erhöhen.</p>}
          </section>
        </div>

        {compareVehicles.length > 0 && (
          <aside className="marketplace-compare">
            <p>{compareVehicles.length} Fahrzeug{compareVehicles.length !== 1 ? 'e' : ''} im Vergleich</p>
            <div className="marketplace-compare__list">
              {compareVehicles.map((vehicle) => (
                <Link key={vehicle.id} to={`/fahrzeug/${vehicle.slug}`}>{vehicle.title}</Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </PageShell>
  );
}
