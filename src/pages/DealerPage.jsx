import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import GoogleRatingBadge, { GoogleReviewSnippet } from '../components/dealer/GoogleRatingBadge.jsx';
import { useDealerGoogleReviewsBatch } from '../hooks/useDealerGoogleReviews.js';
import { mergeDealerProfileWithGoogle, getDealerProfile } from '../data/dealers/dealerProfiles.js';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../context/DealerConditionsContext.jsx';
import { useDealerSubdomain } from '../context/DealerSubdomainContext.jsx';
import { getMainSiteUrl } from '../logic/dealerSubdomain.js';
import { buildMarketplaceSearch } from '../logic/marketplaceService.js';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import './DealerPage.css';
import './dealer-mobile.css';

const KIA_MODELS = [
  { id: 'picanto', name: 'Picanto', rateFrom: 149, type: 'kleinwagen', imageModel: 'Picanto' },
  { id: 'ev2', name: 'EV2', rateFrom: 199, type: 'elektro', imageModel: 'EV2' },
  { id: 'ev3', name: 'EV3', rateFrom: 299, type: 'elektro', imageModel: 'EV3' },
  { id: 'ev4', name: 'EV4', rateFrom: 349, type: 'elektro', imageModel: 'EV4' },
  { id: 'sportage', name: 'Sportage', rateFrom: 255, type: 'suv', imageModel: 'Sportage' },
  { id: 'sorento', name: 'Sorento', rateFrom: 499, type: 'suv', imageModel: 'Sorento' },
];

const ACTION_BANNERS = [
  { id: 'stock-sale', title: '🔥 Lagerabverkauf', text: 'Nur solange Bestand vorhanden' },
  { id: 'black-edition', title: '🔥 Black Edition', text: 'Top-Ausstattung zu Aktionsraten' },
  { id: 'corporate', title: '🔥 Corporate Benefits', text: 'Exklusive Konditionen für Mitarbeiterprogramme' },
  { id: 'daily', title: '🔥 Tageszulassungen', text: 'Sofort verfügbar mit Preisvorteil' },
  { id: 'fast', title: '🔥 Sofort verfügbare Fahrzeuge', text: 'Direkt aus Lager & Vorlauf' },
];


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
  const [advisorPrompt, setAdvisorPrompt] = useState('');

  const visibleInventory = (conditions.inventoryVehicles ?? []).filter((item) => item.visibleOnLanding !== false);
  const immediateInventory = visibleInventory.filter((item) => ['lager', 'vorlauf'].includes(item.type));
  const contact = conditions.contact ?? {};
  const heroModel = KIA_MODELS.find((model) => model.id === 'sportage') ?? KIA_MODELS[0];

  function goToModelSearch(model, extra = {}) {
    const query = buildMarketplaceSearch({
      q: conditions.city,
      radius: 100,
      model: model.name,
      type: extra.type ?? model.type,
    });
    navigate(`/fahrzeuge?${query}`);
  }

  function handleAdvisorSubmit(event) {
    event.preventDefault();
    const prompt = advisorPrompt.trim();
    if (!prompt) return;
    navigate(`/assistant?q=${encodeURIComponent(prompt)}&brand=kia&dealer=${encodeURIComponent(conditions.dealerName)}`);
  }

  return (
    <PageShell className="dealer-shell" hideMarketingHeader={isSubdomain}>
      <div className="dealer-page page dealer-page--mf5">
        <header className="dealer-header">
          <div className="container dealer-header-inner">
            <div className="dealer-header-brand">
              <span className="dealer-header-kia">Kia Partner</span>
              <h1 className="dealer-header-name">{conditions.dealerName}</h1>
              <p className="dealer-header-meta">{conditions.plz} {conditions.city}</p>
            </div>
            <a href={homeUrl} className="dealer-header-back">← clever-neuwagen.de</a>
          </div>
        </header>

        <div className="container dealer-layout">
          <section className="dealer-hero card" aria-label="Hero">
            <div className="dealer-hero__text">
              <span className="dealer-hero__brand">KIA</span>
              <h2>Kia Neuwagen zu Top-Konditionen</h2>
              <p>
                Ihr Kia Partner in {conditions.city}. Aktuelle Leasingangebote, Lagerfahrzeuge
                und sofort verfügbare Modelle für Ihre digitale Filiale.
              </p>
              <div className="dealer-hero__actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => goToModelSearch(heroModel)}>
                  🚗 Kia Modelle entdecken
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/assistant?brand=kia')}
                >
                  🤖 Kia Kaufberater
                </button>
                <a className="btn btn-secondary btn-sm" href={`tel:${contact.phone ?? ''}`}>📞 Beratung anfragen</a>
              </div>
            </div>
            <div className="dealer-hero__image">
              <VehicleImage brand="Kia" model={heroModel.imageModel} dealerId={conditions.dealerId} variant="hero" bodyType="suv" />
            </div>
          </section>

          <section className="dealer-section">
            <div className="dealer-section__head">
              <h3>Kia Modelle</h3>
              <p>Horizontaler Modell-Showroom mit Einstieg in die Fahrzeugsuche.</p>
            </div>
            <div className="dealer-models" aria-label="Modelle">
              {KIA_MODELS.map((model) => (
                <article key={model.id} className="dealer-model-card card">
                  <VehicleImage brand="Kia" model={model.imageModel} className="dealer-model-card__image" />
                  <div className="dealer-model-card__body">
                    <strong>Kia {model.name}</strong>
                    <span>ab {model.rateFrom} €</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToModelSearch(model)}>
                      Modellseite öffnen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dealer-section">
            <div className="dealer-section__head">
              <h3>Aktuelle Aktionen</h3>
              <p>Automatisch aus der Aktionsverwaltung, markenspezifisch in Kia-Optik.</p>
            </div>
            <div className="dealer-actions-grid">
              {ACTION_BANNERS.map((banner) => (
                <article key={banner.id} className="dealer-action-banner card">
                  <h4>{banner.title}</h4>
                  <p>{banner.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dealer-section dealer-ai card">
            <h3>Welcher Kia passt zu Ihnen?</h3>
            <p>
              Beschreiben Sie Fahrleistung, Familie und Budget – wir zeigen passende Kia Modelle
              inklusive aktueller Angebote aus Ihrer Region.
            </p>
            <form className="dealer-ai__form" onSubmit={handleAdvisorSubmit}>
              <textarea
                rows={4}
                value={advisorPrompt}
                onChange={(event) => setAdvisorPrompt(event.target.value)}
                placeholder="Ich fahre 20.000 km im Jahr, habe zwei Kinder und möchte maximal 400 € zahlen."
              />
              <button type="submit" className="btn btn-primary btn-sm">🤖 Kia Empfehlung starten</button>
            </form>
          </section>

          <section className="dealer-section">
            <div className="dealer-section__head">
              <h3>Sofort verfügbare Fahrzeuge</h3>
              <p>Lagerfahrzeuge, Tageszulassungen und Vorführwagen mit kurzer Lieferzeit.</p>
            </div>
            <div className="dealer-stock-grid">
              {immediateInventory.map((item) => (
                <article key={item.id} className="dealer-stock-card card">
                  <strong>{item.model} · {item.equipment}</strong>
                  <p>{item.color} · {item.location}</p>
                  <span className="dealer-stock-card__badge">{item.type === 'lager' ? '🟢 Lagerfahrzeug' : '🟡 Vorlauf'}</span>
                </article>
              ))}
              {immediateInventory.length === 0 && (
                <article className="dealer-stock-card card">
                  <strong>Aktuell keine Sofortfahrzeuge</strong>
                  <p>Neue Lagerfahrzeuge folgen in Kürze.</p>
                </article>
              )}
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

          <section className="dealer-section">
            <div className="dealer-section__head">
              <h3>Bewertungen</h3>
              <p>Echte Google-Bewertungen — aktualisiert über Google Places.</p>
            </div>
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
            <h3>Eigene digitale Filiale für {conditions.dealerName}</h3>
            <p>
              Diese Landingpage ist vollständig markenspezifisch und mobiloptimiert — vom Hero
              bis zur Standortkarte. Änderungen können im Händler-Backend gepflegt werden.
            </p>
            <div className="dealer-footer-cta__actions">
              <Link to="/backend" className="btn btn-secondary btn-sm">Händler-Konfiguration öffnen</Link>
              <Link to="/fahrzeuge" className="btn btn-primary btn-sm">Alle Fahrzeuge im Marktplatz</Link>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
