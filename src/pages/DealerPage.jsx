import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import GoogleRatingBadge, { GoogleReviewSnippet } from '../components/dealer/GoogleRatingBadge.jsx';
import DealerSearchHero from '../components/dealer/DealerSearchHero.jsx';
import DealerCleverMoment from '../components/dealer/DealerCleverMoment.jsx';
import DealerCuratedSuggestions from '../components/dealer/DealerCuratedSuggestions.jsx';
import DealerImmediateCard from '../components/dealer/DealerImmediateCard.jsx';
import { useDealerGoogleReviewsBatch } from '../hooks/useDealerGoogleReviews.js';
import { mergeDealerProfileWithGoogle, getDealerProfile } from '../data/dealers/dealerProfiles.js';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { getMainSiteUrl } from '../logic/dealerSubdomain.js';
import { buildMarketplaceSearch } from '../logic/marketplaceService.js';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';
import { computeDealerLandingStats } from '../logic/dealerLandingStats.js';
import { enrichDealerStockItem } from '../logic/dealerStockPresentation.js';
import {
  DEALER_ACTION_BANNERS,
  KIA_DEALER_MODELS,
} from '../data/dealerLandingContent.js';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import './DealerPage.css';
import './dealer-mobile.css';

const MARKETPLACE_POOL = getMarketplaceVehiclePool();

function DealerReviewsSection({ dealerSlug }) {
  const { reviewsBySlug, loading } = useDealerGoogleReviewsBatch([dealerSlug]);
  const google = reviewsBySlug[dealerSlug];
  const profile = mergeDealerProfileWithGoogle(getDealerProfile(dealerSlug), google);

  if (loading && !google) {
    return <p className="dealer-reviews-loading">Google-Bewertungen werden geladen…</p>;
  }

  return (
    <div className="dealer-reviews-live">
      <GoogleRatingBadge
        rating={profile.rating}
        reviewCount={profile.reviewCount}
        googleMapsUri={profile.googleMapsUri ?? google?.googleMapsUri}
        ratingSource={profile.ratingSource}
        size="lg"
      />
      <GoogleReviewSnippet reviews={profile.googleReviews ?? google?.reviews} />
      {profile.ratingSource !== 'google' && (
        <p className="dealer-reviews-fallback">
          Live-Google-Daten: API-Key in <code>GOOGLE_PLACES_API_KEY</code> setzen.
        </p>
      )}
    </div>
  );
}

export default function DealerPage() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const { dealerId: subdomainDealerId, isSubdomain } = useDealerSubdomain();
  const dealerId = useMemo(
    () => subdomainDealerId || routeSlug || DEFAULT_DEALER_ID,
    [subdomainDealerId, routeSlug],
  );
  const { publishedConditions: conditions } = usePublishedDealerConditions(dealerId);
  const homeUrl = isSubdomain ? getMainSiteUrl('/') : '/';
  const contact = conditions.contact ?? {};

  const visibleInventory = (conditions.inventoryVehicles ?? []).filter(
    (item) => item.visibleOnLanding !== false,
  );
  const immediateInventory = visibleInventory.filter((item) =>
    ['lager', 'vorlauf'].includes(item.type),
  );

  const stockCards = useMemo(
    () => immediateInventory.map((item) =>
      enrichDealerStockItem(item, MARKETPLACE_POOL, conditions),
    ),
    [immediateInventory, conditions],
  );

  const cleverStats = useMemo(
    () => computeDealerLandingStats({
      vehicles: MARKETPLACE_POOL,
      dealerId,
      city: conditions.city,
      inventory: visibleInventory,
      activeModelCount: KIA_DEALER_MODELS.length,
    }),
    [dealerId, conditions.city, visibleInventory],
  );

  function goToModelSearch(model, extra = {}) {
    const query = buildMarketplaceSearch({
      q: conditions.city,
      radius: 100,
      model: model.name,
      type: extra.type ?? model.type,
    });
    navigate(`/fahrzeuge?${query}`);
  }

  return (
    <PageShell className="dealer-shell" hideMarketingHeader={isSubdomain}>
      <div className="dealer-page page dealer-page--mf5 dealer-page--clever">
        <header className="dealer-header dealer-header--slim">
          <div className="container dealer-header-inner">
            <div className="dealer-header-brand">
              <span className="dealer-header-kia">Kia Partner</span>
              <p className="dealer-header-name">{conditions.dealerName}</p>
              <p className="dealer-header-meta">{conditions.plz} {conditions.city}</p>
            </div>
            {!isSubdomain && (
              <a href={homeUrl} className="dealer-header-back">clever-neuwagen.de</a>
            )}
          </div>
        </header>

        <div className="container dealer-layout">
          <DealerSearchHero
            dealerName={conditions.dealerName}
            city={conditions.city}
            brand="Kia"
          />

          <DealerCleverMoment
            dealerName={conditions.dealerName}
            stats={cleverStats}
          />

          <DealerCuratedSuggestions />

          <section className="dealer-section dl-section">
            <h3 className="dl-section__title">Aktuelle Aktionen</h3>
            <div className="dealer-actions-grid">
              {DEALER_ACTION_BANNERS.map((banner) => (
                <article key={banner.id} className="dealer-action-banner card">
                  <h4>{banner.title}</h4>
                  <p>{banner.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dealer-section dl-section">
            <h3 className="dl-section__title">Sofort verfügbare Fahrzeuge</h3>
            <p className="dl-section__sub">Lager & Vorlauf – mit Bild, Rate und Lieferzeit</p>
            <div className="dl-stock-grid">
              {stockCards.map((item) => (
                <DealerImmediateCard key={item.id} item={item} />
              ))}
              {stockCards.length === 0 && (
                <article className="dealer-stock-card card">
                  <strong>Aktuell keine Sofortfahrzeuge</strong>
                  <p>Neue Lagerfahrzeuge folgen in Kürze.</p>
                </article>
              )}
            </div>
          </section>

          <section className="dealer-section dl-section">
            <h3 className="dl-section__title">Alle Kia-Modelle</h3>
            <p className="dl-section__sub">Modell-Showroom – direkt in die Suche</p>
            <div className="dealer-models" aria-label="Modelle">
              {KIA_DEALER_MODELS.map((model) => (
                <article key={model.id} className="dealer-model-card card">
                  <VehicleImage brand="Kia" model={model.imageModel} className="dealer-model-card__image" />
                  <div className="dealer-model-card__body">
                    <strong>Kia {model.name}</strong>
                    <span>ab {model.rateFrom} €</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToModelSearch(model)}>
                      Modell entdecken
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dealer-section dealer-why card">
            <h3>Warum {conditions.dealerName}</h3>
            <ul>
              <li>Seit über 15 Jahren Kia Partner</li>
              <li>Persönliche Beratung & Probefahrten</li>
              <li>Werkstatt vor Ort & deutschlandweite Lieferung</li>
              <li>Leasing, Finanzierung und Corporate-Angebote</li>
            </ul>
          </section>

          <section className="dealer-section dl-section">
            <h3 className="dl-section__title">Bewertungen</h3>
            <DealerReviewsSection dealerSlug={dealerId} />
          </section>

          <section className="dealer-contact-grid">
            <article className="dealer-contact card">
              <h3>Ansprechpartner</h3>
              <p><strong>{contact.name || conditions.dealerName}</strong></p>
              <p>{contact.role || 'Verkauf Neuwagen'}</p>
              <p>📞 <a href={`tel:${contact.phone ?? ''}`}>{contact.phone || 'n. a.'}</a></p>
              <p>💬 <a href={`https://wa.me/${(contact.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></p>
              <p>✉️ <a href={`mailto:${contact.email ?? ''}`}>{contact.email || 'n. a.'}</a></p>
            </article>
            <article className="dealer-location card">
              <h3>Standort</h3>
              <p>{conditions.dealerName}</p>
              <p>{conditions.address}</p>
              <p>{conditions.plz} {conditions.city}</p>
              <p>Mo-Fr 08:30-18:00 · Sa 09:00-14:00</p>
              <iframe
                title="Autohaus Standort"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${conditions.dealerName}, ${conditions.plz} ${conditions.city}`)}&z=12&output=embed`}
                loading="lazy"
              />
            </article>
          </section>

          <section className="dealer-section dealer-footer-cta card">
            <h3>Alle Angebote im Marktplatz</h3>
            <p>Clever-Suche, CleverQuote und Ausstattungsempfehlung – für jedes Kia-Modell.</p>
            <div className="dealer-footer-cta__actions">
              <Link to="/fahrzeuge" className="btn btn-primary btn-sm">Fahrzeuge finden</Link>
              <Link to="/assistant?brand=kia" className="btn btn-secondary btn-sm">Kia Kaufberater</Link>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
