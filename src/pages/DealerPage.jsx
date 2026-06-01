import { useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import SportageConfigurator from '../components/configurator/SportageConfigurator';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { getMainSiteUrl } from '../logic/dealerSubdomain.js';
import { sportage } from '../data/kiaSportage.js';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import VehicleDataReadonlyBanner from '../components/shared/VehicleDataReadonlyBanner.jsx';
import './DealerPage.css';

const KIA_MODELS = [
  { id: 'sportage', name: 'Sportage', active: true, available: true },
  { id: 'ceed', name: 'Ceed', active: false, available: false },
  { id: 'ev6', name: 'EV6', active: false, available: false },
  { id: 'niro', name: 'Niro', active: false, available: false },
];

export default function DealerPage() {
  const { slug: routeSlug } = useParams();
  const { dealerId: subdomainDealerId, isSubdomain } = useDealerSubdomain();
  const dealerId = useMemo(
    () => subdomainDealerId || routeSlug || DEFAULT_DEALER_ID,
    [subdomainDealerId, routeSlug],
  );
  const { publishedConditions: conditions } = usePublishedDealerConditions(dealerId);
  const configuratorRef = useRef(null);
  const location = useLocation();
  const homeUrl = isSubdomain ? getMainSiteUrl('/') : '/';

  useEffect(() => {
    if (location.hash === '#sportage-konfigurator') {
      configuratorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  function scrollToConfigurator() {
    configuratorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <PageShell className="dealer-shell" hideMarketingHeader={isSubdomain}>
      <div className="dealer-page page">
        {/* Händler-Header */}
        <header className="dealer-header">
          <div className="container dealer-header-inner">
            <div className="dealer-header-brand">
              <span className="dealer-header-kia">Kia Partner</span>
              <h1 className="dealer-header-name">{conditions.dealerName}</h1>
              <p className="dealer-header-meta">
                {conditions.plz} {conditions.city}
              </p>
            </div>
            <a href={homeUrl} className="dealer-header-back">← clever-neuwagen.de</a>
          </div>
        </header>

        <div className="container">
          {/* Kia Angebote */}
          <section className="dealer-offers" aria-label="Kia Angebote">
            <div className="dealer-offers-head">
              <h2 className="dealer-offers-title">Kia Angebote</h2>
              <p className="dealer-offers-sub">Neuwagen mit Händlerkonditionen von {conditions.dealerName}</p>
            </div>

            <div className="dealer-models" role="tablist" aria-label="Modelle">
              {KIA_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="tab"
                  aria-selected={model.active}
                  disabled={!model.available}
                  className={`dealer-model-tab ${model.active ? 'is-active' : ''} ${!model.available ? 'is-disabled' : ''}`}
                >
                  {model.name}
                  {!model.available && <span className="dealer-model-soon">Demnächst</span>}
                </button>
              ))}
            </div>

            <div className="dealer-model-hero card">
              <div className="dealer-model-hero-text">
                <p className="dealer-model-hero-label">{sportage.brand} {sportage.model}</p>
                <p className="dealer-model-hero-tagline">{sportage.tagline}</p>
                <div className="dealer-model-cta-row">
                  <Link to="/berater/ausstattung" className="btn btn-secondary dealer-model-cta-secondary">
                    Ausstattungsberater
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary dealer-model-cta"
                    onClick={scrollToConfigurator}
                  >
                    Sportage konfigurieren
                  </button>
                </div>
              </div>
              <div className="dealer-model-hero-image">
                <VehicleImage
                  brand={sportage.brand}
                  model={sportage.model}
                  dealerId={conditions.dealerId}
                  bodyType="suv"
                  variant="hero"
                  className="dealer-model-hero-visual"
                  imageClassName="dealer-model-hero-visual__img"
                  alt={`${sportage.brand} ${sportage.model}`}
                />
              </div>
            </div>
          </section>

          {/* Konfigurator */}
          <section
            ref={configuratorRef}
            id="sportage-konfigurator"
            className="dealer-configurator-section"
            aria-label="Sportage Konfigurator"
          >
            <header className="dealer-configurator-head">
              <h2 className="dealer-configurator-title">
                {sportage.brand} {sportage.model} konfigurieren
              </h2>
              <p className="dealer-configurator-sub">
                Wählen Sie Motor, Ausstattung und Zahlungsart – der Preis aktualisiert sich sofort.
              </p>
            </header>

            <VehicleDataReadonlyBanner />

            <SportageConfigurator dealerName={conditions.dealerName} dealerId={dealerId} />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
