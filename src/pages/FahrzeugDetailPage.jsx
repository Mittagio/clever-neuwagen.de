import { useMemo, useState, useCallback } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import CustomerSaveOfferModal from '../components/customer/CustomerSaveOfferModal.jsx';
import CustomerInquiryModal from '../components/customer/CustomerInquiryModal.jsx';
import ConfigurationWishPanel from '../components/configurator/ConfigurationWishPanel.jsx';
import RecommendedDealerCard from '../components/dealer/RecommendedDealerCard.jsx';
import DealerCompareCards from '../components/dealer/DealerCompareCards.jsx';
import DealerInventoryCarousel from '../components/dealer/DealerInventoryCarousel.jsx';
import SimilarVehiclesNearby from '../components/dealer/SimilarVehiclesNearby.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { CUSTOMER_LABELS } from '../data/customerFlow.js';
import { CONFIGURATOR_FEATURE_IDS } from '../data/features/featureCatalog.js';
import { getManufacturerModel } from '../data/manufacturer/manufacturerRegistry.js';
import { formatCurrency, getAvailabilityMeta } from '../logic/marketplaceService.js';
import {
  filtersFromSearchParams,
  buildFahrzeugeSearchUrl,
} from '../logic/oneSearchService.js';
import { buildOfferPath } from '../logic/offerService.js';
import { createLeadFromMarketplaceVehicle } from '../logic/marketplaceLeadService.js';
import { toggleCompareSlug, isInCompare, loadCompareSlugs } from '../services/customerCompareService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { priceConfiguration } from '../services/pricing/pricingEngine.js';
import {
  getDealerOffersForConfiguration,
  getDealerInventory,
  getSimilarVehiclesNearby,
} from '../services/pricing/dealerOfferPricing.js';
import { rankDealerOffers } from '../services/dealer/dealerScoreService.js';
import {
  useDealerGoogleReviewsBatch,
  enrichOffersWithGoogle,
} from '../hooks/useDealerGoogleReviews.js';
import { useLeads } from '../context/LeadsContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import '../components/configurator/configurationWish.css';
import '../components/dealer/dealer-offer.css';
import './FahrzeugDetailPage.css';

const TERM_MONTHS = 48;
const MILEAGE_YEAR = 10000;
const DOWN_PAYMENT = 0;

export default function FahrzeugDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addLead } = useLeads();
  const { registerMarketplaceInquiry } = useCustomerAuth();

  const [paymentView, setPaymentView] = useState('leasing');
  const [saveOpen, setSaveOpen] = useState(false);
  const [inquiryModal, setInquiryModal] = useState(null);
  const [compareSlugs, setCompareSlugs] = useState(() => loadCompareSlugs());
  const [toast, setToast] = useState('');
  const [configState, setConfigState] = useState(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const configMode = searchParams.get('wunsch') === '1' || filters.features.length > 0 || !!filters.query;

  const vehicle = MARKETPLACE_VEHICLES.find((item) => item.slug === slug);
  const manufacturer = vehicle ? getManufacturerModel(vehicle.brand, vehicle.model) : null;
  const showConfigurator = !!manufacturer;

  const wishes = useMemo(
    () => parseCustomerWish(filters.query, filters.features),
    [filters.query, filters.features],
  );

  const initialWishIds = useMemo(
    () => wishes.features.filter((id) => CONFIGURATOR_FEATURE_IDS.includes(id)),
    [wishes.features],
  );

  const wishIds = configState?.wishIds ?? initialWishIds;
  const trimId = configState?.trimId;

  const basePricing = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return priceConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: wishIds,
      paymentType: paymentView,
      termMonths: TERM_MONTHS,
      mileagePerYear: MILEAGE_YEAR,
    });
  }, [manufacturer, vehicle, trimId, wishIds, paymentView]);

  const baseRankedOffers = useMemo(() => {
    if (!vehicle || !manufacturer) return [];
    return getDealerOffersForConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId: trimId ?? manufacturer.defaultTrimId,
      wishFeatureIds: wishIds,
      paymentType: paymentView,
      preferredDealerSlug: vehicle.dealerSlug,
    });
  }, [vehicle, manufacturer, trimId, wishIds, paymentView]);

  const dealerSlugs = useMemo(
    () => baseRankedOffers.map((o) => o.dealerSlug),
    [baseRankedOffers],
  );

  const { reviewsBySlug } = useDealerGoogleReviewsBatch(dealerSlugs);

  const rankedDealerOffers = useMemo(() => {
    if (!baseRankedOffers.length) return [];
    const enriched = enrichOffersWithGoogle(baseRankedOffers, reviewsBySlug);
    return rankDealerOffers(enriched);
  }, [baseRankedOffers, reviewsBySlug]);

  const recommendedDealer = rankedDealerOffers[0] ?? null;
  const dealerInventory = useMemo(() => {
    if (!recommendedDealer) return [];
    return getDealerInventory(recommendedDealer.dealerSlug, vehicle?.slug);
  }, [recommendedDealer, vehicle?.slug]);

  const similarVehicles = useMemo(() => {
    if (!vehicle) return [];
    return getSimilarVehiclesNearby(vehicle, 4);
  }, [vehicle]);

  const handleConfigChange = useCallback((next) => {
    setConfigState(next);
  }, []);

  if (vehicle?.offerCode && !configMode && !showConfigurator) {
    return <Navigate to={buildOfferPath(vehicle.offerCode)} replace />;
  }

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
  const inCompare = isInCompare(vehicle.slug);

  const leasingRate = basePricing?.leasingRate ?? recommendedDealer?.monthlyRate ?? vehicle.monthlyRate;
  const financeRate = basePricing?.financeRate ?? Math.round(leasingRate * 1.08);
  const cashPrice = basePricing?.cashPrice ?? vehicle.cashPrice;
  const discountPercent = basePricing?.discountPercent ?? vehicle.discountPercent;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function submitInquiry(action, contact) {
    const lead = createLeadFromMarketplaceVehicle(vehicle, action, contact);
    addLead(lead);
    if (contact.email) {
      registerMarketplaceInquiry(
        vehicle,
        contact,
        action === 'testdrive' ? 'testdrive' : 'inquiry',
        contact.email,
      );
    }
    showToast('Ihre Anfrage wurde gesendet.');
  }

  function handleCompare() {
    const { added } = toggleCompareSlug(vehicle.slug);
    setCompareSlugs(loadCompareSlugs());
    showToast(added ? 'Zum Vergleich hinzugefügt.' : 'Aus Vergleich entfernt.');
  }

  const paymentOptions = [
    { id: 'leasing', label: 'Leasing', value: leasingRate },
    { id: 'finance', label: 'Finanzierung', value: financeRate },
    { id: 'cash', label: 'Kauf', value: cashPrice },
  ];

  return (
    <PageShell>
      <div className={`vehicle-detail${showConfigurator ? ' vehicle-detail--config' : ''}`}>
        <div className="vehicle-detail__container offer-detail-stack">
          <header className="vehicle-detail__top">
            <Link to={buildFahrzeugeSearchUrl(filters)} className="vehicle-detail__back">
              ← Zur Fahrzeugsuche
            </Link>
            <Link to="/mein-bereich" className="vehicle-detail__account">{CUSTOMER_LABELS.myArea}</Link>
          </header>

          {/* 1. Fahrzeug + Konfiguration */}
          {showConfigurator && (
            <>
              <VehicleImage
                brand={vehicle.brand}
                model={vehicle.imageModel}
                className="vehicle-detail__config-image"
              />
              <ConfigurationWishPanel
                vehicle={vehicle}
                initialWishIds={initialWishIds}
                paymentType={paymentView}
                onConfigChange={handleConfigChange}
              />
            </>
          )}

          {!showConfigurator && (
            <article className="vehicle-detail__hero card">
              <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="vehicle-detail__image" />
              <div className="vehicle-detail__facts">
                <h1>{vehicle.title}</h1>
                <p className="vehicle-detail__rate">{formatCurrency(leasingRate)}/Monat</p>
              </div>
            </article>
          )}

          {/* 2. Empfohlener Händler */}
          {recommendedDealer && (
            <RecommendedDealerCard
              offer={recommendedDealer}
              onInquiry={() => setInquiryModal('inquiry')}
              onTestDrive={() => setInquiryModal('testdrive')}
            />
          )}

          {/* Weitere Händler – Karten, nicht Tabelle */}
          {rankedDealerOffers.length > 1 && (
            <DealerCompareCards
              offers={rankedDealerOffers}
              excludeSlug={recommendedDealer?.dealerSlug}
            />
          )}

          {/* 3. Weitere Fahrzeuge dieses Händlers */}
          {recommendedDealer && (
            <DealerInventoryCarousel
              dealerName={recommendedDealer.dealerName}
              vehicles={dealerInventory}
            />
          )}

          {/* 4. Wettbewerber – erst unter dem Händlerbereich */}
          <SimilarVehiclesNearby vehicles={similarVehicles} currentSlug={vehicle.slug} />

          {/* 5. Anfrage + Details */}
          <article className="vehicle-detail__hero card">
            <div className="vehicle-detail__facts">
              <h2>Ihr Angebot im Detail</h2>
              <p className="vehicle-detail__dealer">{vehicle.title}</p>

              <div className="vehicle-detail__payment-tabs">
                {paymentOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`vehicle-detail__tab${paymentView === opt.id ? ' is-active' : ''}`}
                    onClick={() => setPaymentView(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="vehicle-detail__rate">
                {paymentView === 'cash'
                  ? formatCurrency(paymentOptions.find((p) => p.id === 'cash').value)
                  : `${formatCurrency(paymentOptions.find((p) => p.id === paymentView).value)}/Monat`}
              </p>
              <p className="vehicle-detail__meta">
                Kaufpreis {formatCurrency(cashPrice)} · Rabatt {discountPercent}%
              </p>
              <p>Laufzeit {TERM_MONTHS} Monate · {MILEAGE_YEAR.toLocaleString('de-DE')} km/Jahr · Anzahlung {formatCurrency(DOWN_PAYMENT)}</p>
              <p>Lieferzeit: {vehicle.deliveryTime}</p>
              <p>{availability.label}</p>

              <div className="vehicle-detail__actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSaveOpen(true)}>
                  {CUSTOMER_LABELS.saveOffer}
                </button>
                <button type="button" className={`btn btn-secondary btn-sm${inCompare ? ' is-active' : ''}`} onClick={handleCompare}>
                  {CUSTOMER_LABELS.compare}{compareSlugs.length > 0 ? ` (${compareSlugs.length})` : ''}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setInquiryModal('inquiry')}>
                  {CUSTOMER_LABELS.startInquiry}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInquiryModal('testdrive')}>
                  {CUSTOMER_LABELS.testDrive}
                </button>
              </div>

              <LegalDisclaimer compact className="vehicle-detail__legal" />
            </div>
          </article>

          <section className="vehicle-detail__map card">
            <h2>Standort</h2>
            <p>📍 {recommendedDealer?.dealerName ?? vehicle.dealerName}, {vehicle.plz} {vehicle.city}</p>
            <iframe
              title="Händlerstandort"
              src={`https://maps.google.com/maps?q=${mapsQuery}&z=11&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        </div>
      </div>

      {saveOpen && (
        <CustomerSaveOfferModal vehicle={vehicle} onClose={() => setSaveOpen(false)} />
      )}

      {inquiryModal === 'inquiry' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.startInquiry}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('inquiry', contact)}
        />
      )}
      {inquiryModal === 'testdrive' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.testDrive}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('testdrive', contact)}
        />
      )}

      {toast && <div className="vehicle-detail__toast">{toast}</div>}
    </PageShell>
  );
}
