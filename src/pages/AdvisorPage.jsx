import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import {
  ADVISOR_MILEAGE_OPTIONS,
  ADVISOR_HOUSEHOLD_OPTIONS,
  ADVISOR_WISHES,
} from '../data/advisorCatalog.js';
import { getAdvisorRecommendations, formatAdvisorRate } from '../services/advisorEngine.js';
import {
  buildAdvisorUrl,
  parseAdvisorUrlProfile,
  parseAdvisorLocationFromParams,
  DEFAULT_LOCATION_RADIUS_KM,
} from '../services/landingAdvisorBridge.js';
import {
  hasAdvisorLocation,
  formatLocationChip,
  getLocationDisplayLabel,
} from '../logic/advisorLocation.js';
import { enrichLocationWithGeocoding } from '../services/geocodingService.js';
import AdvisorLocationStep from '../components/advisor/AdvisorLocationStep.jsx';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { CUSTOMER_ROUTES } from '../data/customerFlow.js';
import './AdvisorPage.css';

function findMarketplaceSlug(rec) {
  const match = MARKETPLACE_VEHICLES.find(
    (v) => v.brand === rec.brand && v.model?.toLowerCase() === rec.model?.toLowerCase(),
  );
  return match?.slug ?? MARKETPLACE_VEHICLES[0]?.slug;
}

const TERM_CHIPS = [36, 48, 60];
const MILEAGE_CHIPS = [10000, 15000, 20000, 25000, 30000];
const RADIUS_CHIPS = [25, 50, 100, null];
const PAYMENT_LABELS = {
  leasing: '📄 Leasing',
  finance: '📄 Finanzierung',
  cash: '💵 Kauf',
};

const DEALERS = [
  { id: 'trinkle', name: 'Autohaus Trinkle', distanceKm: 18, rating: 5 },
  { id: 'mueller', name: 'Autohaus Müller', distanceKm: 33, rating: 5 },
  { id: 'esslingen', name: 'Autohaus Esslingen', distanceKm: 42, rating: 4 },
  { id: 'ulm', name: 'Autohaus Ulm', distanceKm: 67, rating: 4 },
];

function normalizeProfile(parsed = {}) {
  return {
    desiredRate: parsed.desiredRate ?? 400,
    mileage: parsed.mileage || '15k-20k',
    household: parsed.household || 'family',
    fuelPreference: parsed.fuelPreference || 'egal',
    bodyType: parsed.bodyType || 'suv',
    paymentType: parsed.paymentType,
    wishes: parsed.wishes ?? [],
  };
}

function getMileageIdByValue(value) {
  if (value <= 10000) return 'under-10k';
  if (value <= 15000) return '10k-15k';
  if (value <= 20000) return '15k-20k';
  return 'over-20k';
}

function buildUnderstoodChips(profile, location, radiusKm) {
  const chips = [];

  if (profile.desiredRate) chips.push(`💰 bis ${profile.desiredRate} €`);
  if (profile.paymentType && PAYMENT_LABELS[profile.paymentType]) {
    chips.push(PAYMENT_LABELS[profile.paymentType]);
  }

  const household = ADVISOR_HOUSEHOLD_OPTIONS.find((o) => o.id === profile.household)?.label;
  if (household) chips.push(`👨‍👩‍👧‍👦 ${household}`);
  if (profile.household?.includes('dog')) chips.push('🐶 Hund');

  const mileage = ADVISOR_MILEAGE_OPTIONS.find((o) => o.id === profile.mileage)?.value;
  if (mileage) chips.push(`📏 ${mileage.toLocaleString('de-DE')} km/Jahr`);

  const locChip = hasAdvisorLocation(location) ? formatLocationChip(location, radiusKm) : null;
  if (locChip) chips.push(locChip);

  for (const wish of profile.wishes ?? []) {
    const label = ADVISOR_WISHES.find((w) => w.id === wish)?.label;
    if (label) chips.push(`✓ ${label}`);
  }

  return chips.slice(0, 10);
}

function stars(count) {
  return '★★★★★'.slice(0, count) + '☆☆☆☆☆'.slice(0, Math.max(0, 5 - count));
}

function toOfferRows(recommendations, termMonths, mileagePerYear) {
  const termFactor = termMonths === 36 ? 1.06 : termMonths === 60 ? 0.94 : 1;
  const mileageFactor = mileagePerYear <= 10000 ? 0.95 : mileagePerYear >= 30000 ? 1.14 : 1 + ((mileagePerYear - 15000) / 15000) * 0.09;

  return recommendations.flatMap((rec) =>
    DEALERS.map((dealer, dealerIdx) => {
      const dealerFactor = 1 + (dealerIdx - 1.2) * 0.03;
      const monthlyRate = Math.round(rec.monthlyRate * termFactor * mileageFactor * dealerFactor);
      return {
        id: `${rec.id}-${dealer.id}`,
        recommendation: rec,
        dealer,
        monthlyRate,
        termMonths,
        mileagePerYear,
      };
    }),
  ).sort((a, b) => a.monthlyRate - b.monthlyRate);
}

function resolveInitialView(searchParams, locationState) {
  if (locationState.skipped) return 'results';
  if (hasAdvisorLocation(locationState.location)) return 'results';
  if (searchParams.get('start') === '1') return 'location';
  return 'results';
}

export default function AdvisorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();

  const locationState = useMemo(() => parseAdvisorLocationFromParams(searchParams), [searchParams]);
  const parsedProfile = useMemo(() => parseAdvisorUrlProfile(searchParams), [searchParams]);
  const queryText = searchParams.get('q') ?? '';

  const [view, setView] = useState(() => resolveInitialView(searchParams, locationState));
  const [profile, setProfile] = useState(() => normalizeProfile(parsedProfile));
  const [location, setLocation] = useState(locationState.location);
  const [locationSkipped, setLocationSkipped] = useState(locationState.skipped);

  const initialRadius = useMemo(() => {
    if (locationState.skipped || !hasAdvisorLocation(locationState.location)) return null;
    const r = searchParams.get('radius');
    if (r) {
      const n = Number(r);
      if (!Number.isNaN(n)) return n;
    }
    return DEFAULT_LOCATION_RADIUS_KM;
  }, [searchParams, locationState]);

  const [termMonths, setTermMonths] = useState(48);
  const [mileagePerYear, setMileagePerYear] = useState(
    ADVISOR_MILEAGE_OPTIONS.find((m) => m.id === profile.mileage)?.value ?? 17500,
  );
  const [radiusKm, setRadiusKm] = useState(initialRadius);
  const [nearbyOnly, setNearbyOnly] = useState(false);

  const hasLocation = hasAdvisorLocation(location) && !locationSkipped;

  useEffect(() => {
    if (!location?.plz || location.city || location.label || locationSkipped) return;
    let cancelled = false;
    enrichLocationWithGeocoding(location).then((enriched) => {
      if (cancelled || !enriched?.city) return;
      setLocation(enriched);
      const url = buildAdvisorUrl(profile, queryText, {
        location: enriched,
        radiusKm: radiusKm ?? DEFAULT_LOCATION_RADIUS_KM,
      });
      navigate(url, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [location, locationSkipped, profile, queryText, radiusKm, navigate]);

  function goToResults(nextLocation, { skip = false, radius = DEFAULT_LOCATION_RADIUS_KM } = {}) {
    const url = buildAdvisorUrl(profile, queryText, {
      location: skip ? null : nextLocation,
      locSkip: skip,
      radiusKm: skip ? undefined : radius,
    });
    navigate(url, { replace: true });
    setLocation(skip ? null : nextLocation);
    setLocationSkipped(skip);
    setRadiusKm(skip ? null : radius);
    setView('results');
  }

  const recommendations = useMemo(
    () => getAdvisorRecommendations(profile, conditions),
    [profile, conditions],
  );

  const offerRows = useMemo(() => {
    const base = toOfferRows(recommendations, termMonths, mileagePerYear);
    return base.filter((row) => {
      if (hasLocation && radiusKm != null && row.dealer.distanceKm > radiusKm) return false;
      if (hasLocation && nearbyOnly && row.dealer.distanceKm > 50) return false;
      return true;
    });
  }, [recommendations, termMonths, mileagePerYear, radiusKm, nearbyOnly, hasLocation]);

  const bestRow = offerRows[0] ?? null;
  const additionalRows = offerRows.slice(1, 10);
  const understoodChips = buildUnderstoodChips(profile, location, radiusKm);
  const uniqueDealerCount = new Set(offerRows.map((row) => row.dealer.id)).size;
  const locationLabel = getLocationDisplayLabel(location);

  if (view === 'location') {
    return (
      <div className="ai-offers-page">
        <header className="ai-offers-header">
          <Link to="/" className="ai-offers-header__back">← Zurück</Link>
          <h1>Ihr Wunsch wurde verstanden</h1>
          <p>Optional: Standort für Angebote in Ihrer Nähe festlegen.</p>
        </header>
        <main className="ai-offers-main">
          <AdvisorLocationStep
            onUseLocation={(loc) => goToResults(loc, { radius: DEFAULT_LOCATION_RADIUS_KM })}
            onSkip={() => goToResults(null, { skip: true })}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="ai-offers-page">
      <header className="ai-offers-header">
        <Link to="/" className="ai-offers-header__back">← Zurück</Link>
        <h1>Passende Fahrzeuge für Sie</h1>
        <p>Basierend auf Ihrer Beschreibung hat unsere KI folgende Fahrzeuge gefunden.</p>
      </header>

      <main className="ai-offers-main">
        <section className="ai-understood card">
          <h2>1. KI hat Ihre Suche verstanden</h2>
          <div className="ai-chip-row">
            {understoodChips.map((chip) => (
              <span key={chip} className="ai-chip">{chip}</span>
            ))}
            {!hasLocation && (
              <span className="ai-chip ai-chip--muted">Standort nicht angegeben</span>
            )}
          </div>
          {!hasLocation && (
            <button type="button" className="ai-add-location" onClick={() => setView('location')}>
              Standort hinzufügen
            </button>
          )}
        </section>

        <section className="ai-filters card">
          <h2>2. Angebots-Chips</h2>
          <div className="ai-filter-block">
            <span>Laufzeit</span>
            <div className="ai-chip-controls">
              {TERM_CHIPS.map((term) => (
                <button key={term} type="button" className={`ai-chip-btn${termMonths === term ? ' is-active' : ''}`} onClick={() => setTermMonths(term)}>
                  {term} Monate
                </button>
              ))}
            </div>
          </div>
          <div className="ai-filter-block">
            <span>Kilometer</span>
            <div className="ai-chip-controls">
              {MILEAGE_CHIPS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`ai-chip-btn${mileagePerYear === km ? ' is-active' : ''}`}
                  onClick={() => {
                    setMileagePerYear(km);
                    setProfile((prev) => ({ ...prev, mileage: getMileageIdByValue(km) }));
                  }}
                >
                  {km.toLocaleString('de-DE')} km
                </button>
              ))}
            </div>
          </div>
          {hasLocation && (
            <div className="ai-filter-block">
              <span>Umkreis</span>
              <div className="ai-chip-controls">
                {RADIUS_CHIPS.map((radius) => (
                  <button
                    key={String(radius)}
                    type="button"
                    className={`ai-chip-btn${radiusKm === radius ? ' is-active' : ''}`}
                    onClick={() => setRadiusKm(radius)}
                  >
                    {radius == null ? 'Deutschlandweit' : `${radius} km`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasLocation && (
            <div className="ai-toggle-row">
              <button type="button" className={`ai-chip-btn${!nearbyOnly ? ' is-active' : ''}`} onClick={() => setNearbyOnly(false)}>Beste Angebote</button>
              <button type="button" className={`ai-chip-btn${nearbyOnly ? ' is-active' : ''}`} onClick={() => setNearbyOnly(true)}>Nur in meiner Nähe</button>
            </div>
          )}
        </section>

        <section className="ai-local-block card">
          <h2>📍 Angebote in Ihrer Nähe</h2>
          {hasLocation ? (
            <p>
              {uniqueDealerCount} Händler · {offerRows.length} Fahrzeuge
              {locationLabel ? ` · ${locationLabel}` : ''}
              {' · Umkreis '}
              {radiusKm == null ? 'Deutschlandweit' : `${radiusKm} km`}
            </p>
          ) : (
            <>
              <p>Standort nicht angegeben · deutschlandweite Auswahl</p>
              <button type="button" className="ai-add-location" onClick={() => setView('location')}>
                Standort hinzufügen
              </button>
            </>
          )}
        </section>

        {bestRow && (
          <section className="ai-best card">
            <h2>3. Beste Empfehlung</h2>
            <OfferCard row={bestRow} highlight showDistance={hasLocation} />
          </section>
        )}

        <section className="ai-list">
          <h2>4. Weitere passende Angebote</h2>
          <div className="ai-offer-grid">
            {additionalRows.map((row) => (
              <OfferCard key={row.id} row={row} showDistance={hasLocation} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function OfferCard({ row, highlight = false, showDistance = true }) {
  const rec = row.recommendation;
  return (
    <article className={`ai-offer-card${highlight ? ' is-highlight' : ''}`}>
      <VehicleImage brand={rec.brand} model={rec.model} className="ai-offer-card__img" />
      <div className="ai-offer-card__body">
        <h3>{rec.fullLabel ?? `${rec.brand} ${rec.model}`}</h3>
        <p className="ai-offer-card__rate">{formatAdvisorRate(row.monthlyRate)}/Monat</p>
        <p>{row.termMonths} Monate · {row.mileagePerYear.toLocaleString('de-DE')} km/Jahr</p>
        <p>{rec.deliveryTime}</p>
        <p>{row.dealer.name}{showDistance ? ` · ${row.dealer.distanceKm} km entfernt` : ''}</p>
        <p>{stars(row.dealer.rating)}</p>
        <Link to={CUSTOMER_ROUTES.vehicle(findMarketplaceSlug(rec))} className="ai-offer-card__cta">Angebot ansehen</Link>
      </div>
    </article>
  );
}
