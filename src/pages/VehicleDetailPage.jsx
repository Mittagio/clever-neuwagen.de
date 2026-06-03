import { useState, useCallback } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import CustomerSaveOfferModal from '../components/customer/CustomerSaveOfferModal.jsx';
import CleverQuoteBadge, { CleverQuoteBreakdown } from '../components/cleverQuote/CleverQuoteBadge.jsx';
import HeroOffer from '../components/vehicle/HeroOffer.jsx';
import StickyOfferBox from '../components/vehicle/StickyOfferBox.jsx';
import MobileStickyBar from '../components/vehicle/MobileStickyBar.jsx';
import PriceToolCard from '../components/pricing/PriceToolCard.jsx';
import PriceDrawer from '../components/pricing/PriceDrawer.jsx';
import WishBuilderCard from '../components/configurator/WishBuilderCard.jsx';
import WishResultPanel, { PackageRecommendationCard, CleverRecommendationCard } from '../components/configurator/WishResultPanel.jsx';
import AdvisorNextSteps from '../components/advisor/AdvisorNextSteps.jsx';
import CleverAnalysisPanel from '../components/advisor/CleverAnalysisPanel.jsx';
import WishBasedAlternatives from '../components/advisor/WishBasedAlternatives.jsx';
import DealerCompareCard, { DealerTrustCard } from '../components/dealer/DealerCompareCard.jsx';
import InquirySummaryModal from '../components/inquiry/InquirySummaryModal.jsx';
import MobileBottomSheet from '../components/shared/MobileBottomSheet.jsx';
import DealerOffersTable from '../components/vehicle-detail/DealerOffersTable.jsx';
import SimilarVehiclesNearby from '../components/dealer/SimilarVehiclesNearby.jsx';
import { CUSTOMER_LABELS } from '../data/customerFlow.js';
import { buildFahrzeugeSearchUrl } from '../logic/oneSearchService.js';
import { buildOfferPath } from '../logic/offerService.js';
import { createLeadFromMarketplaceVehicle } from '../logic/marketplaceLeadService.js';
import { useVehicleDetailController } from '../hooks/useVehicleDetailController.js';
import { buildRecommendReasons } from '../services/cleverQuote/cleverQuoteRecommendation.js';
import { useLeads } from '../context/LeadsContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import '../components/vehicle-detail/vehicle-detail.css';
import '../components/dealer/dealer-offer.css';
import './FahrzeugDetailPage.css';

export default function VehicleDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { addLead } = useLeads();
  const { registerMarketplaceInquiry } = useCustomerAuth();

  const [saveOpen, setSaveOpen] = useState(false);
  const [inquiryModal, setInquiryModal] = useState(null);
  const [wishSectionActive, setWishSectionActive] = useState(false);
  const [wishSheetOpen, setWishSheetOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [cleverQuoteOpen, setCleverQuoteOpen] = useState(false);

  const ctrl = useVehicleDetailController({
    slug,
    searchParams: new URLSearchParams(location.search),
  });

  const {
    vehicle,
    showCustomize,
    configMode,
    filters,
    detailSelection,
    displayPrice,
    displayTitle,
    displaySubtitle,
    dealer,
    activeDealer,
    rankedDealerOffers,
    dealerInventory,
    similarVehicles,
    basePricing,
    discountPercent,
    effectiveColorId,
    priceDrawerOpen,
    setPriceDrawerOpen,
    compareOpen,
    setCompareOpen,
    setSelectedDealerSlug,
    handleToggleFeature,
    handleAcceptPackage,
    handleAcceptBetterTrim,
    handlePaymentApply,
    wishFulfillment,
    wishAlternatives,
    recommendationResult,
    cleverQuote,
    cleverQuoteAfterPackage,
    wishes,
  } = ctrl;

  const openWishes = useCallback(() => {
    setWishSectionActive(true);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setWishSheetOpen(true);
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById('vd-wish-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const scrollToDealer = useCallback(() => {
    setMobileMoreOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('vd-dealer-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const openCompare = useCallback(() => {
    setCompareOpen(true);
    if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => {
        document.getElementById('vd-offers-compare')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [setCompareOpen]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function submitInquiry(action, contact) {
    const lead = createLeadFromMarketplaceVehicle(vehicle, action, contact, {
      pricing: displayPrice?.raw,
      detailSelection,
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

  if (vehicle?.offerCode && !configMode && !showCustomize) {
    return <Navigate to={buildOfferPath(vehicle.offerCode)} replace />;
  }

  if (!vehicle || !displayPrice) {
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

  const primaryPackage = recommendationResult?.requiredPackages?.[0];
  const wishCount = detailSelection.selectedFeatures?.length ?? 0;
  const recommendReasons = buildRecommendReasons(
    { vehicle, cleverQuote, bestOffer: activeDealer, displayRate: displayPrice?.amount },
    { wishes, maxReasons: 3 },
  );

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
              <HeroOffer
                vehicle={vehicle}
                dealer={dealer}
                price={displayPrice}
                displayTitle={displayTitle}
                discountPercent={discountPercent}
                colorId={effectiveColorId}
                cleverQuote={cleverQuote}
                recommendReasons={recommendReasons}
                wishesActive={wishSectionActive}
                compareActive={compareOpen}
                onCleverQuoteWhy={() => setCleverQuoteOpen(true)}
                onStartInquiry={() => setInquiryModal('inquiry')}
                onOpenPricing={() => setPriceDrawerOpen(true)}
                onOpenWishes={openWishes}
                onOpenCompare={openCompare}
              />

              <CleverQuoteBreakdown
                cleverQuote={cleverQuote}
                open={cleverQuoteOpen}
                onClose={() => setCleverQuoteOpen(false)}
                onAcceptUpgrade={handleAcceptPackage}
                paymentMode={detailSelection.paymentMode}
              />

              <div className="vd-desktop-only">
              <AdvisorNextSteps
                displayPrice={displayPrice}
                paymentMode={detailSelection.paymentMode}
                wishCount={wishCount}
                dealerCount={rankedDealerOffers.length}
                onOpenPricing={() => setPriceDrawerOpen(true)}
                onOpenWishes={openWishes}
                onOpenDealerCompare={openCompare}
                wishesActive={wishSectionActive}
                compareActive={compareOpen}
              />
              </div>

              <div className="vd-tools-flow vd-desktop-only">
                <PriceToolCard
                  price={displayPrice}
                  open={priceDrawerOpen}
                  onOpen={() => setPriceDrawerOpen(true)}
                />

                <PriceDrawer
                  open={priceDrawerOpen}
                  onOpenChange={setPriceDrawerOpen}
                  paymentMode={detailSelection.paymentMode}
                  paymentView={detailSelection.paymentMode}
                  termMonths={detailSelection.termMonths}
                  mileagePerYear={detailSelection.mileagePerYear}
                  downPayment={detailSelection.downPayment}
                  financeDown={detailSelection.financeDown}
                  financeBalloon={detailSelection.financeBalloon}
                  pricing={displayPrice.raw}
                  discountPercent={discountPercent}
                  basePricing={basePricing}
                  activeDealer={activeDealer}
                  vehicle={vehicle}
                  onApply={handlePaymentApply}
                />

                {showCustomize && (
                  <>
                    <WishBuilderCard
                      vehicle={vehicle}
                      selection={detailSelection}
                      recommendationResult={recommendationResult}
                      fulfillment={wishFulfillment}
                      onToggleFeature={handleToggleFeature}
                    />
                    <CleverAnalysisPanel fulfillment={wishFulfillment} />
                    <WishResultPanel
                      recommendationResult={recommendationResult}
                      displayPrice={displayPrice}
                      paymentMode={detailSelection.paymentMode}
                    />
                    {primaryPackage && (
                      <PackageRecommendationCard
                        package={primaryPackage}
                        paymentMode={detailSelection.paymentMode}
                        displayPrice={displayPrice}
                        baselinePriceLabel={recommendationResult?.baselinePriceLabel}
                        cleverQuote={cleverQuote}
                        cleverQuoteAfter={cleverQuoteAfterPackage}
                        onAccept={handleAcceptPackage}
                      />
                    )}
                    {recommendationResult?.betterTrim?.exists && (
                      <CleverRecommendationCard
                        betterTrim={recommendationResult.betterTrim}
                        vehicle={{ ...vehicle, trimName: detailSelection.trimName }}
                        fulfillment={wishFulfillment}
                        onAccept={handleAcceptBetterTrim}
                      />
                    )}
                    <WishBasedAlternatives
                      alternatives={wishAlternatives}
                      currentTitle={displayTitle}
                    />
                  </>
                )}

                <DealerCompareCard
                  offers={rankedDealerOffers}
                  paymentMode={detailSelection.paymentMode}
                  displayPrice={displayPrice}
                  onCompare={openCompare}
                />

                <DealerOffersTable
                  embedded
                  compareOpen={compareOpen}
                  onCompareOpenChange={setCompareOpen}
                  offers={rankedDealerOffers}
                  payment={detailSelection.paymentMode}
                  onSelectDealer={(offer) => setSelectedDealerSlug(offer.dealerSlug)}
                  onViewOffer={scrollToDealer}
                  onExpandRadius={() => showToast('Weitere Händler werden geladen …')}
                />
              </div>

              <div className="vd-mobile-more">
                {!mobileMoreOpen ? (
                  <button
                    type="button"
                    className="vd-btn vd-btn--ghost vd-btn--block vd-mobile-more__toggle"
                    onClick={() => setMobileMoreOpen(true)}
                  >
                    Mehr zum Händler & ähnliche Fahrzeuge
                  </button>
                ) : (
                  <>
                    <div className="vd-trust" id="vd-dealer-block">
                      <DealerTrustCard
                        offer={{ ...activeDealer, brand: vehicle.brand }}
                        inventory={dealerInventory}
                        configuredOffer={detailSelection.selectedFeatures.length > 0}
                        onInquiry={() => setInquiryModal('inquiry')}
                        onTestDrive={() => setInquiryModal('testdrive')}
                      />
                    </div>
                    <div className="vd-similar vd-inspire">
                      <SimilarVehiclesNearby
                        vehicles={similarVehicles}
                        currentSlug={vehicle.slug}
                        paymentMode={detailSelection.paymentMode}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="vd-desktop-only vd-trust-block">
              <div className="vd-trust" id="vd-dealer-block">
                <DealerTrustCard
                  offer={{ ...activeDealer, brand: vehicle.brand }}
                  inventory={dealerInventory}
                  configuredOffer={detailSelection.selectedFeatures.length > 0}
                  onInquiry={() => setInquiryModal('inquiry')}
                  onTestDrive={() => setInquiryModal('testdrive')}
                />
              </div>

              <div className="vd-similar vd-inspire">
                <SimilarVehiclesNearby
                  vehicles={similarVehicles}
                  currentSlug={vehicle.slug}
                  paymentMode={detailSelection.paymentMode}
                />
              </div>
              </div>

              <LegalDisclaimer compact className="vd-page__legal vd-desktop-only" />
            </div>

            <StickyOfferBox
              price={displayPrice}
              dealer={dealer}
              onStartInquiry={() => setInquiryModal('inquiry')}
              onSaveOffer={() => setSaveOpen(true)}
            />
          </div>
        </div>
      </div>

      <MobileStickyBar
        price={displayPrice}
        visible={false}
        onStartInquiry={() => setInquiryModal('inquiry')}
        onSaveOffer={() => setSaveOpen(true)}
      />

      <MobileBottomSheet
        open={wishSheetOpen}
        onClose={() => setWishSheetOpen(false)}
        title="Wunschauto bauen"
        titleId="vd-wish-sheet-title"
      >
        {showCustomize && (
          <>
            <WishBuilderCard
              vehicle={vehicle}
              selection={detailSelection}
              recommendationResult={recommendationResult}
              fulfillment={wishFulfillment}
              onToggleFeature={handleToggleFeature}
            />
            <CleverAnalysisPanel fulfillment={wishFulfillment} />
            <WishResultPanel
              recommendationResult={recommendationResult}
              displayPrice={displayPrice}
              paymentMode={detailSelection.paymentMode}
            />
            {primaryPackage && (
              <PackageRecommendationCard
                package={primaryPackage}
                paymentMode={detailSelection.paymentMode}
                displayPrice={displayPrice}
                baselinePriceLabel={recommendationResult?.baselinePriceLabel}
                cleverQuote={cleverQuote}
                cleverQuoteAfter={cleverQuoteAfterPackage}
                onAccept={handleAcceptPackage}
              />
            )}
            {recommendationResult?.betterTrim?.exists && (
              <CleverRecommendationCard
                betterTrim={recommendationResult.betterTrim}
                vehicle={{ ...vehicle, trimName: detailSelection.trimName }}
                fulfillment={wishFulfillment}
                onAccept={handleAcceptBetterTrim}
              />
            )}
          </>
        )}
      </MobileBottomSheet>

      <MobileBottomSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Angebote vergleichen"
        titleId="vd-compare-sheet-title"
      >
        <DealerOffersTable
          embedded
          compareOpen
          onCompareOpenChange={setCompareOpen}
          offers={rankedDealerOffers}
          payment={detailSelection.paymentMode}
          onSelectDealer={(offer) => {
            setSelectedDealerSlug(offer.dealerSlug);
            setCompareOpen(false);
          }}
          onViewOffer={scrollToDealer}
          onExpandRadius={() => showToast('Weitere Händler werden geladen …')}
        />
      </MobileBottomSheet>

      <div className="vd-mobile-only">
        <PriceDrawer
          open={priceDrawerOpen}
          onOpenChange={setPriceDrawerOpen}
          paymentMode={detailSelection.paymentMode}
          paymentView={detailSelection.paymentMode}
          termMonths={detailSelection.termMonths}
          mileagePerYear={detailSelection.mileagePerYear}
          downPayment={detailSelection.downPayment}
          financeDown={detailSelection.financeDown}
          financeBalloon={detailSelection.financeBalloon}
          pricing={displayPrice.raw}
          discountPercent={discountPercent}
          basePricing={basePricing}
          activeDealer={activeDealer}
          vehicle={vehicle}
          onApply={handlePaymentApply}
        />
      </div>

      {saveOpen && (
        <CustomerSaveOfferModal vehicle={vehicle} onClose={() => setSaveOpen(false)} />
      )}

      <InquirySummaryModal
        open={inquiryModal === 'inquiry'}
        title={CUSTOMER_LABELS.startInquiry}
        detailSelection={detailSelection}
        recommendationResult={recommendationResult}
        displayPrice={displayPrice}
        displayTitle={displayTitle}
        dealer={dealer}
        onClose={() => setInquiryModal(null)}
        onSubmit={(contact) => submitInquiry('inquiry', contact)}
      />
      <InquirySummaryModal
        open={inquiryModal === 'testdrive'}
        title={CUSTOMER_LABELS.testDrive}
        detailSelection={detailSelection}
        recommendationResult={recommendationResult}
        displayPrice={displayPrice}
        displayTitle={displayTitle}
        dealer={dealer}
        onClose={() => setInquiryModal(null)}
        onSubmit={(contact) => submitInquiry('testdrive', contact)}
      />

      {toast && <div className="vd-page__toast">{toast}</div>}
    </PageShell>
  );
}
