import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import CustomerSaveOfferModal from '../components/customer/CustomerSaveOfferModal.jsx';
import CustomerInquiryModal from '../components/customer/CustomerInquiryModal.jsx';
import VehicleDetailHero from '../components/vehicle-detail/VehicleDetailHero.jsx';
import VehicleDetailNextSteps from '../components/vehicle-detail/VehicleDetailNextSteps.jsx';
import VehiclePriceCalculator from '../components/vehicle-detail/VehiclePriceCalculator.jsx';
import VehicleCustomizePanel from '../components/vehicle-detail/VehicleCustomizePanel.jsx';
import VehicleSummaryCard from '../components/vehicle-detail/VehicleSummaryCard.jsx';
import VehicleDetailMobileBar from '../components/vehicle-detail/VehicleDetailMobileBar.jsx';
import DealerOffersTable from '../components/vehicle-detail/DealerOffersTable.jsx';
import VehicleDetailDealerBlock from '../components/vehicle-detail/VehicleDetailDealerBlock.jsx';
import SimilarVehiclesNearby from '../components/dealer/SimilarVehiclesNearby.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { CUSTOMER_LABELS } from '../data/customerFlow.js';
import { CONFIGURATOR_FEATURE_IDS, getFeatureLabel } from '../data/features/featureCatalog.js';
import { getDetailWishChips } from '../data/features/wishDetailChips.js';
import { getManufacturerModel } from '../data/manufacturer/manufacturerRegistry.js';
import {
  filtersFromSearchParams,
  buildFahrzeugeSearchUrl,
} from '../logic/oneSearchService.js';
import { buildOfferPath } from '../logic/offerService.js';
import { createLeadFromMarketplaceVehicle } from '../logic/marketplaceLeadService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { priceConfiguration } from '../services/pricing/pricingEngine.js';
import { findBestTrimForWish } from '../services/configurator/wishPackageResolver.js';
import { buildWishInsight, trimIdFromVehicle } from '../services/configurator/wishMagicService.js';
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
import {
  getVehicleColors,
  getConfigurablePackages,
  resolveColorIdForPricing,
} from '../logic/vehicleDetailConfig.js';
import {
  computeDetailPricing,
  buildInquirySummary,
  getDetailSelectionState,
  wishIdsToLabels,
} from '../logic/vehicleDetailPricing.js';
import { useLeads } from '../context/LeadsContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import '../components/vehicle-detail/vehicle-detail.css';
import '../components/dealer/dealer-offer.css';
import './FahrzeugDetailPage.css';

const DEFAULT_TERM = 48;
const DEFAULT_MILEAGE = 10000;

export default function FahrzeugDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { addLead } = useLeads();
  const { registerMarketplaceInquiry } = useCustomerAuth();

  const [paymentView, setPaymentView] = useState('leasing');
  const [termMonths, setTermMonths] = useState(DEFAULT_TERM);
  const [mileagePerYear, setMileagePerYear] = useState(DEFAULT_MILEAGE);
  const [downPayment, setDownPayment] = useState(0);
  const [financeDown, setFinanceDown] = useState(0);
  const [financeBalloon, setFinanceBalloon] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [inquiryModal, setInquiryModal] = useState(null);
  const [toast, setToast] = useState('');
  const [wishIds, setWishIds] = useState([]);
  const [packageIds, setPackageIds] = useState([]);
  const [accessoryIds, setAccessoryIds] = useState([]);
  const [colorId, setColorId] = useState(null);
  const [selectedDealerSlug, setSelectedDealerSlug] = useState(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [customizeSection, setCustomizeSection] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [trimOverride, setTrimOverride] = useState(null);
  const [exploreWishId, setExploreWishId] = useState(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const configMode = searchParams.get('wunsch') === '1' || filters.features.length > 0 || !!filters.query;

  const vehicle = MARKETPLACE_VEHICLES.find((item) => item.slug === slug);
  const manufacturer = vehicle ? getManufacturerModel(vehicle.brand, vehicle.model) : null;
  const showCustomize = !!manufacturer || configMode;

  const wishes = useMemo(
    () => parseCustomerWish(filters.query, filters.features),
    [filters.query, filters.features],
  );

  const initialWishIds = useMemo(
    () => wishes.features.filter((id) => CONFIGURATOR_FEATURE_IDS.includes(id)),
    [wishes.features],
  );

  const effectiveWishIds = wishIds.length ? wishIds : initialWishIds;

  const bestConfig = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return findBestTrimForWish({
      brand: vehicle.brand,
      model: vehicle.model,
      wishFeatureIds: effectiveWishIds,
    });
  }, [manufacturer, vehicle, effectiveWishIds]);

  const listingTrimId = useMemo(
    () => (vehicle ? trimIdFromVehicle(vehicle) : null) ?? manufacturer?.defaultTrimId,
    [vehicle, manufacturer],
  );
  const trimId = trimOverride ?? listingTrimId ?? bestConfig?.trimId ?? manufacturer?.defaultTrimId;
  const trimName = useMemo(() => {
    if (!manufacturer) return bestConfig?.trimName;
    const trim = manufacturer.data.trims?.find((t) => t.id === trimId);
    return trim?.name ?? bestConfig?.trimName;
  }, [manufacturer, trimId, bestConfig?.trimName]);

  const defaultColor = useMemo(() => {
    if (!vehicle) return null;
    const colors = getVehicleColors(vehicle.brand, vehicle.model, trimId);
    return colors[0]?.id ?? null;
  }, [vehicle, trimId]);

  const effectiveColorId = colorId ?? defaultColor;
  const pricingColorId = vehicle
    ? resolveColorIdForPricing(vehicle.brand, vehicle.model, effectiveColorId)
    : null;

  const basePricing = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return priceConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: effectiveWishIds,
      packageIds,
      accessoryIds,
      colorId: pricingColorId,
      paymentType: paymentView,
      termMonths,
      mileagePerYear,
    });
  }, [
    manufacturer,
    vehicle,
    trimId,
    effectiveWishIds,
    packageIds,
    accessoryIds,
    pricingColorId,
    paymentView,
    termMonths,
    mileagePerYear,
  ]);

  const baseRankedOffers = useMemo(() => {
    if (!vehicle || !manufacturer) return [];
    return getDealerOffersForConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: effectiveWishIds,
      packageIds,
      accessoryIds,
      colorId: pricingColorId,
      paymentType: paymentView,
      termMonths,
      mileagePerYear,
      preferredDealerSlug: vehicle.dealerSlug,
    });
  }, [
    vehicle,
    manufacturer,
    trimId,
    effectiveWishIds,
    packageIds,
    accessoryIds,
    pricingColorId,
    paymentView,
    termMonths,
    mileagePerYear,
  ]);

  const dealerSlugs = useMemo(
    () => baseRankedOffers.map((o) => o.dealerSlug),
    [baseRankedOffers],
  );

  const { reviewsBySlug } = useDealerGoogleReviewsBatch(dealerSlugs);

  const rankedDealerOffers = useMemo(() => {
    if (baseRankedOffers.length) {
      const enriched = enrichOffersWithGoogle(baseRankedOffers, reviewsBySlug);
      return rankDealerOffers(enriched);
    }
    if (!vehicle) return [];
    return [{
      dealerName: vehicle.dealerName,
      dealerSlug: vehicle.dealerSlug,
      city: vehicle.city,
      plz: vehicle.plz,
      distanceKm: vehicle.distanceKm,
      monthlyRate: vehicle.monthlyRate,
      financeRate: Math.round(vehicle.monthlyRate * 1.08),
      cashPrice: vehicle.cashPrice,
      availability: vehicle.availability,
      deliveryTime: vehicle.deliveryTime,
      discountPercent: vehicle.discountPercent,
      score: 85,
      profile: {},
    }];
  }, [baseRankedOffers, reviewsBySlug, vehicle]);

  const activeDealer = useMemo(() => {
    if (selectedDealerSlug) {
      return rankedDealerOffers.find((o) => o.dealerSlug === selectedDealerSlug) ?? rankedDealerOffers[0];
    }
    return rankedDealerOffers[0] ?? null;
  }, [rankedDealerOffers, selectedDealerSlug]);

  const dealerInventory = useMemo(() => {
    if (!activeDealer) return [];
    return getDealerInventory(activeDealer.dealerSlug, vehicle?.slug);
  }, [activeDealer, vehicle?.slug]);

  const similarVehicles = useMemo(() => {
    if (!vehicle) return [];
    return getSimilarVehiclesNearby(vehicle, 5);
  }, [vehicle]);

  const applyWishConfiguration = useCallback(({ wishIds: nextWishIds, packageIds: pkg, accessoryIds: acc }) => {
    if (nextWishIds) setWishIds(nextWishIds);
    setPackageIds(pkg);
    setAccessoryIds(acc);
  }, []);

  useEffect(() => {
    if (!manufacturer || !effectiveWishIds.length) {
      if (!effectiveWishIds.length) {
        setPackageIds([]);
        setAccessoryIds([]);
      }
      return;
    }
    const wr = basePricing?.wishResolution;
    if (!wr) return;
    setPackageIds(wr.packageIds);
    setAccessoryIds(wr.accessoryIds);
  }, [
    manufacturer,
    effectiveWishIds,
    trimId,
    basePricing?.wishResolution?.packageIds?.join(','),
    basePricing?.wishResolution?.accessoryIds?.join(','),
  ]);

  const togglePackage = useCallback((id) => {
    setPackageIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  const toggleAccessory = useCallback((id) => {
    setAccessoryIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }, []);

  const displayTitle = useMemo(() => {
    if (!vehicle) return '';
    return trimName
      ? `${vehicle.brand} ${vehicle.model} ${trimName}`
      : vehicle.title;
  }, [vehicle, trimName]);

  const pricing = useMemo(() => {
    if (!vehicle) return null;
    return computeDetailPricing({
      payment: paymentView,
      termMonths,
      mileagePerYear,
      downPayment,
      financeDown,
      financeBalloon,
      basePricing,
      activeDealer,
      vehicle,
    });
  }, [
    vehicle,
    paymentView,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    basePricing,
    activeDealer,
  ]);

  const colorName = useMemo(() => {
    if (!vehicle || !effectiveColorId) return null;
    const colors = getVehicleColors(vehicle.brand, vehicle.model, trimId);
    return colors.find((c) => c.id === effectiveColorId)?.name ?? null;
  }, [vehicle, effectiveColorId, trimId]);

  const baselineEnginePricing = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return priceConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: [],
      packageIds: [],
      accessoryIds: [],
      colorId: pricingColorId,
      paymentType: paymentView,
      termMonths,
      mileagePerYear,
    });
  }, [
    manufacturer,
    vehicle,
    trimId,
    pricingColorId,
    paymentView,
    termMonths,
    mileagePerYear,
  ]);

  const wishInsight = useMemo(() => {
    if (!manufacturer || !vehicle || !effectiveWishIds.length) return null;
    return buildWishInsight({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: effectiveWishIds,
      paymentType: paymentView,
      termMonths,
      mileagePerYear,
      downPayment,
      financeDown,
      financeBalloon,
      baselineEnginePricing,
    });
  }, [
    manufacturer,
    vehicle,
    trimId,
    effectiveWishIds,
    paymentView,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    baselineEnginePricing,
  ]);

  const packageLabels = useMemo(() => {
    if (wishInsight?.inquiryMeta?.packageLabels?.length) {
      return wishInsight.inquiryMeta.packageLabels;
    }
    const pkgs = basePricing?.selectedPackages ?? basePricing?.breakdown?.packages ?? [];
    return pkgs.map((p) => p.name ?? p.id).filter(Boolean);
  }, [wishInsight, basePricing]);

  const inquirySummary = useMemo(() => {
    if (!vehicle || !pricing) return null;
    const meta = wishInsight?.inquiryMeta;
    return buildInquirySummary({
      displayTitle,
      dealerName: activeDealer?.dealerName ?? vehicle.dealerName,
      distanceKm: activeDealer?.distanceKm ?? vehicle.distanceKm,
      pricing,
      colorName,
      wishLabels: meta?.wishedLabels ?? wishIdsToLabels(effectiveWishIds),
      packageLabels,
      serialLabels: meta?.serialLabels ?? [],
      bonusLabels: meta?.bonusLabels ?? [],
    });
  }, [vehicle, pricing, displayTitle, activeDealer, colorName, effectiveWishIds, packageLabels, wishInsight]);

  const detailSelection = useMemo(
    () => getDetailSelectionState({
      payment: paymentView,
      termMonths,
      mileagePerYear,
      downPayment,
      financeDown,
      financeBalloon,
      colorId: effectiveColorId,
      trimId,
      trimName,
      packageIds,
      accessoryIds,
      wishIds: effectiveWishIds,
    }),
    [
      paymentView,
      termMonths,
      mileagePerYear,
      downPayment,
      financeDown,
      financeBalloon,
      effectiveColorId,
      trimId,
      trimName,
      packageIds,
      accessoryIds,
      effectiveWishIds,
    ],
  );

  const discountPercent = basePricing?.discountPercent ?? vehicle?.discountPercent ?? 0;
  const deliveryTime = activeDealer?.deliveryTime ?? vehicle?.deliveryTime;
  const heroDealer = activeDealer?.dealerName ?? vehicle?.dealerName;
  const heroDistance = activeDealer?.distanceKm ?? vehicle?.distanceKm;
  const heroAvailability = activeDealer?.availability ?? vehicle?.availability;
  const wishQuickChips = useMemo(() => {
    if (!showCustomize || !vehicle) return [];
    return getDetailWishChips(vehicle.brand, vehicle.model)
      .slice(0, 4)
      .map((id) => ({
        id,
        label: getFeatureLabel(id).replace(' vorne', '').replace(' hinten', ''),
        active: effectiveWishIds.includes(id) || exploreWishId === id,
      }));
  }, [showCustomize, vehicle, effectiveWishIds, exploreWishId]);

  const hideMobileBar = calcOpen || Boolean(customizeSection) || compareOpen || Boolean(exploreWishId);

  const openRateAdjust = useCallback(() => {
    setCalcOpen(true);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      requestAnimationFrame(() => {
        document.getElementById('vd-price-calc')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, []);

  const openCustomize = useCallback(() => {
    setCustomizeSection((prev) => prev ?? 'wishes');
  }, []);

  const openWishChip = useCallback((wishId) => {
    setCustomizeSection('wishes');
    setExploreWishId(wishId);
  }, []);

  const openCompare = useCallback(() => {
    setCompareOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('vd-offers-compare')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const scrollToDealer = useCallback(() => {
    document.getElementById('vd-dealer-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (vehicle?.offerCode && !configMode && !showCustomize) {
    return <Navigate to={buildOfferPath(vehicle.offerCode)} replace />;
  }

  if (!vehicle) {
    return (
      <PageShell>
        <div className="vd-page">
          <div className="vd-page__container">
            <p>Fahrzeug nicht gefunden.</p>
            <Link to="/fahrzeuge">Zur Suche</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function submitInquiry(action, contact) {
    const lead = createLeadFromMarketplaceVehicle(vehicle, action, contact, {
      pricing,
      detailSelection,
      inquirySummary,
    });
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

  function openPriceCalc() {
    setCalcOpen(true);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      requestAnimationFrame(() => {
        document.getElementById('vd-price-calc')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  return (
    <PageShell>
      <div className="vd-page">
        <div className="vd-page__container">
          <header className="vd-page__top">
            <Link to={buildFahrzeugeSearchUrl(filters)} className="vd-page__back">
              ← Zur Fahrzeugsuche
            </Link>
            <Link to="/mein-bereich" className="vd-page__account">{CUSTOMER_LABELS.myArea}</Link>
          </header>

          <div className="vd-layout">
            <div className="vd-layout__main">
              <VehicleDetailHero
                vehicle={vehicle}
                displayTitle={displayTitle}
                dealerName={heroDealer}
                distanceKm={heroDistance}
                availability={heroAvailability}
                deliveryTime={deliveryTime}
                discountPercent={discountPercent}
                pricing={pricing}
                colorId={effectiveColorId}
                onInquiry={() => setInquiryModal('inquiry')}
                onPriceCalc={openPriceCalc}
                onRateAdjust={openRateAdjust}
              />

              <VehicleDetailNextSteps
                pricing={pricing}
                vehicleModel={vehicle.model}
                showCustomize={showCustomize}
                onRateAdjust={openRateAdjust}
                onCustomizeOpen={openCustomize}
                onWishChipClick={openWishChip}
                customizeActive={customizeSection}
                wishQuickChips={wishQuickChips}
                offers={rankedDealerOffers}
                payment={paymentView}
                compareOpen={compareOpen}
                onCompareOpen={openCompare}
                onViewDealer={scrollToDealer}
              />

              <div className="vd-tools-flow">
              <VehiclePriceCalculator
                embedded
                paymentView={paymentView}
                termMonths={termMonths}
                mileagePerYear={mileagePerYear}
                downPayment={downPayment}
                financeDown={financeDown}
                financeBalloon={financeBalloon}
                pricing={pricing}
                discountPercent={discountPercent}
                basePricing={basePricing}
                activeDealer={activeDealer}
                vehicle={vehicle}
                open={calcOpen}
                onOpenChange={setCalcOpen}
                onApply={(draft) => {
                  setPaymentView(draft.paymentView);
                  setTermMonths(draft.termMonths);
                  setMileagePerYear(draft.mileagePerYear);
                  setDownPayment(draft.downPayment);
                  setFinanceDown(draft.financeDown);
                  setFinanceBalloon(draft.financeBalloon);
                }}
              />

              {showCustomize && (
                <VehicleCustomizePanel
                  embedded
                  vehicle={vehicle}
                  configMode={configMode}
                  trimId={trimId}
                  trimName={trimName}
                  colorId={effectiveColorId}
                  onColorChange={setColorId}
                  packageIds={packageIds}
                  accessoryIds={accessoryIds}
                  onPackageToggle={togglePackage}
                  onAccessoryToggle={toggleAccessory}
                  wishIds={effectiveWishIds}
                  onWishIdsChange={setWishIds}
                  exploreWishId={exploreWishId}
                  onExploreWishChange={setExploreWishId}
                  onApplyWishConfiguration={applyWishConfiguration}
                  onTrimUpgrade={(id) => {
                    setTrimOverride(id);
                    setExploreWishId(null);
                  }}
                  paymentType={paymentView}
                  termMonths={termMonths}
                  mileagePerYear={mileagePerYear}
                  downPayment={downPayment}
                  financeDown={financeDown}
                  financeBalloon={financeBalloon}
                  baselineEnginePricing={baselineEnginePricing}
                  currentRateLabel={pricing?.priceLabel}
                  activeSection={customizeSection}
                  onActiveSectionChange={setCustomizeSection}
                />
              )}

              <DealerOffersTable
                embedded
                compareOpen={compareOpen}
                onCompareOpenChange={setCompareOpen}
                offers={rankedDealerOffers}
                payment={paymentView}
                onSelectDealer={(offer) => setSelectedDealerSlug(offer.dealerSlug)}
                onViewOffer={scrollToDealer}
                onExpandRadius={() => showToast('Weitere Händler werden geladen …')}
              />
              </div>

              <div className="vd-trust">
              <VehicleDetailDealerBlock
                offer={{ ...activeDealer, brand: vehicle.brand }}
                inventory={dealerInventory}
                configuredOffer={packageLabels.length > 0 || effectiveWishIds.length > 0}
                onInquiry={() => setInquiryModal('inquiry')}
                onTestDrive={() => setInquiryModal('testdrive')}
              />
              </div>

              <div className="vd-similar vd-inspire">
                <SimilarVehiclesNearby vehicles={similarVehicles} currentSlug={vehicle.slug} />
              </div>

              <LegalDisclaimer compact className="vd-page__legal" />
            </div>

            <VehicleSummaryCard
              dealerName={heroDealer}
              distanceKm={heroDistance}
              pricing={pricing}
              onSave={() => setSaveOpen(true)}
              onInquiry={() => setInquiryModal('inquiry')}
            />
          </div>
        </div>
      </div>

      <VehicleDetailMobileBar
        pricing={pricing}
        visible={!hideMobileBar}
        onInquiry={() => setInquiryModal('inquiry')}
        onSave={() => setSaveOpen(true)}
      />

      {saveOpen && (
        <CustomerSaveOfferModal vehicle={vehicle} onClose={() => setSaveOpen(false)} />
      )}

      {inquiryModal === 'inquiry' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.startInquiry}
          inquirySummary={inquirySummary}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('inquiry', contact)}
        />
      )}
      {inquiryModal === 'testdrive' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.testDrive}
          inquirySummary={inquirySummary}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('testdrive', contact)}
        />
      )}

      {toast && <div className="vd-page__toast">{toast}</div>}
    </PageShell>
  );
}
