import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';

const MARKETPLACE_VEHICLES = getMarketplaceVehiclePool();
import { CONFIGURATOR_FEATURE_IDS } from '../data/features/featureCatalog.js';
import { getManufacturerModel } from '../data/manufacturer/manufacturerRegistry.js';
import { filtersFromSearchParams } from '../logic/oneSearchService.js';
import {
  getVehicleColors,
  resolveColorIdForPricing,
} from '../logic/vehicleDetailConfig.js';
import { priceConfiguration } from '../services/pricing/pricingEngine.js';
import { getDealerOffersForConfiguration, getDealerInventory, getSimilarVehiclesNearby } from '../services/pricing/dealerOfferPricing.js';
import { rankDealerOffers } from '../services/dealer/dealerScoreService.js';
import { parseCustomerWish } from '../services/wish/wishParser.js';
import { trimIdFromVehicle } from '../services/configurator/wishMagicService.js';
import { findBestTrimForWish } from '../services/configurator/wishPackageResolver.js';
import {
  createInitialDetailSelection,
  toggleFeature,
  acceptPackage,
  acceptBetterTrim,
  buildRecommendation,
} from '../services/configuration/featureResolver.js';
import {
  buildWishFulfillment,
  buildWishBasedAlternatives,
  shouldShowWishAlternatives,
} from '../services/configuration/wishAdvisorService.js';
import { computeCleverQuote, computeCleverQuoteAfterPackage } from '../services/cleverQuote/cleverQuoteService.js';
import { scoreVehicleAgainstWish } from '../services/wish/wishMatchEngine.js';
import { getDisplayPrice } from '../services/pricing/pricingResolver.js';
import { useDealerGoogleReviewsBatch, enrichOffersWithGoogle } from './useDealerGoogleReviews.js';

const DEFAULT_TERM = 48;
const DEFAULT_MILEAGE = 10000;

export function useVehicleDetailController({ slug, searchParams }) {
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

  const listingTrimId = useMemo(
    () => (vehicle ? trimIdFromVehicle(vehicle) : null) ?? manufacturer?.defaultTrimId,
    [vehicle, manufacturer],
  );

  const [detailSelection, setDetailSelection] = useState(() =>
    createInitialDetailSelection(vehicle, {
      trim: listingTrimId,
      selectedFeatures: initialWishIds,
    }),
  );

  const [trimOverride, setTrimOverride] = useState(null);
  const [selectedDealerSlug, setSelectedDealerSlug] = useState(null);
  const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const trimId = trimOverride ?? detailSelection.trim ?? listingTrimId ?? manufacturer?.defaultTrimId;

  const trimName = useMemo(() => {
    if (!manufacturer) return null;
    return manufacturer.data.trims?.find((t) => t.id === trimId)?.name ?? null;
  }, [manufacturer, trimId]);

  const defaultColor = useMemo(() => {
    if (!vehicle) return null;
    return getVehicleColors(vehicle.brand, vehicle.model, trimId)[0]?.id ?? null;
  }, [vehicle, trimId]);

  const effectiveColorId = detailSelection.selectedColor ?? defaultColor;
  const pricingColorId = vehicle
    ? resolveColorIdForPricing(vehicle.brand, vehicle.model, effectiveColorId)
    : null;

  const effectiveWishIds = detailSelection.selectedFeatures.length
    ? detailSelection.selectedFeatures
    : initialWishIds;

  const basePricing = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return priceConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: effectiveWishIds,
      packageIds: detailSelection.selectedPackages,
      accessoryIds: detailSelection.selectedAccessories,
      colorId: pricingColorId,
      paymentType: detailSelection.paymentMode,
      termMonths: detailSelection.termMonths,
      mileagePerYear: detailSelection.mileagePerYear,
    });
  }, [manufacturer, vehicle, trimId, effectiveWishIds, detailSelection, pricingColorId]);

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
      paymentType: detailSelection.paymentMode,
      termMonths: detailSelection.termMonths,
      mileagePerYear: detailSelection.mileagePerYear,
    });
  }, [manufacturer, vehicle, trimId, pricingColorId, detailSelection.paymentMode, detailSelection.termMonths, detailSelection.mileagePerYear]);

  const baseRankedOffers = useMemo(() => {
    if (!vehicle || !manufacturer) return [];
    return getDealerOffersForConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: effectiveWishIds,
      packageIds: detailSelection.selectedPackages,
      accessoryIds: detailSelection.selectedAccessories,
      colorId: pricingColorId,
      paymentType: detailSelection.paymentMode,
      termMonths: detailSelection.termMonths,
      mileagePerYear: detailSelection.mileagePerYear,
      preferredDealerSlug: vehicle.dealerSlug,
    });
  }, [vehicle, manufacturer, trimId, effectiveWishIds, detailSelection, pricingColorId]);

  const { reviewsBySlug } = useDealerGoogleReviewsBatch(
    baseRankedOffers.map((o) => o.dealerSlug),
  );

  const rankedDealerOffers = useMemo(() => {
    if (baseRankedOffers.length) {
      return rankDealerOffers(enrichOffersWithGoogle(baseRankedOffers, reviewsBySlug));
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
    }];
  }, [baseRankedOffers, reviewsBySlug, vehicle]);

  const activeDealer = useMemo(() => {
    if (selectedDealerSlug) {
      return rankedDealerOffers.find((o) => o.dealerSlug === selectedDealerSlug) ?? rankedDealerOffers[0];
    }
    return rankedDealerOffers[0] ?? null;
  }, [rankedDealerOffers, selectedDealerSlug]);

  const vehicleCatalog = useMemo(() => ({
    brand: vehicle?.brand,
    model: vehicle?.model,
    vehicle,
    dealerConditions: activeDealer?.dealerConditions,
  }), [vehicle, activeDealer]);

  const selectionForResolver = useMemo(() => ({
    ...detailSelection,
    trim: trimId,
    selectedFeatures: effectiveWishIds,
  }), [detailSelection, trimId, effectiveWishIds]);

  const recommendationResult = useMemo(() => {
    if (!vehicle || !manufacturer) return null;
    return buildRecommendation(selectionForResolver, vehicleCatalog, {
      baselineEnginePricing,
    });
  }, [vehicle, manufacturer, selectionForResolver, vehicleCatalog, baselineEnginePricing]);

  const wishFulfillment = useMemo(
    () => buildWishFulfillment(
      { ...selectionForResolver, selectedPackages: detailSelection.selectedPackages },
      recommendationResult,
    ),
    [selectionForResolver, detailSelection.selectedPackages, recommendationResult],
  );

  const wishAlternatives = useMemo(() => {
    if (!shouldShowWishAlternatives(effectiveWishIds, wishFulfillment)) return [];
    return buildWishBasedAlternatives({
      currentVehicle: vehicle,
      wishFeatureIds: effectiveWishIds,
      paymentMode: detailSelection.paymentMode,
      termMonths: detailSelection.termMonths,
      mileagePerYear: detailSelection.mileagePerYear,
    });
  }, [vehicle, effectiveWishIds, wishFulfillment, detailSelection.paymentMode, detailSelection.termMonths, detailSelection.mileagePerYear]);

  const displayPrice = useMemo(() => {
    if (!vehicle) return null;
    return getDisplayPrice(
      { ...detailSelection, trim: trimId },
      activeDealer,
      { basePricing, vehicle },
    );
  }, [vehicle, detailSelection, trimId, activeDealer, basePricing]);

  const displayTitle = useMemo(() => {
    if (!vehicle) return '';
    if (showCustomize && effectiveWishIds.length) {
      return `${vehicle.brand} ${vehicle.model}`;
    }
    return trimName
      ? `${vehicle.brand} ${vehicle.model} ${trimName}`
      : vehicle.title;
  }, [vehicle, trimName, showCustomize, effectiveWishIds.length]);

  const displaySubtitle = useMemo(() => {
    if (!showCustomize || !effectiveWishIds.length || !trimName) return null;
    return `Empfohlene Ausstattung: ${trimName}`;
  }, [showCustomize, effectiveWishIds.length, trimName]);

  const dealer = useMemo(() => ({
    name: activeDealer?.dealerName ?? vehicle?.dealerName,
    distanceKm: activeDealer?.distanceKm ?? vehicle?.distanceKm,
    availability: activeDealer?.availability ?? vehicle?.availability,
    deliveryTime: activeDealer?.deliveryTime ?? vehicle?.deliveryTime,
    slug: activeDealer?.dealerSlug ?? vehicle?.dealerSlug,
  }), [activeDealer, vehicle]);

  useEffect(() => {
    if (!manufacturer || !effectiveWishIds.length) return;
    const wr = basePricing?.wishResolution;
    if (!wr) return;
    setDetailSelection((prev) => ({
      ...prev,
      selectedPackages: wr.packageIds ?? [],
      selectedAccessories: wr.accessoryIds ?? [],
    }));
  }, [manufacturer, effectiveWishIds, trimId, basePricing?.wishResolution?.packageIds?.join(',')]);

  const patchSelection = useCallback((patch) => {
    setDetailSelection((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleToggleFeature = useCallback((featureId) => {
    setDetailSelection((prev) => {
      const next = toggleFeature(
        { ...prev, selectedFeatures: prev.selectedFeatures.length ? prev.selectedFeatures : initialWishIds },
        featureId,
      );
      const rec = buildRecommendation(
        { ...next, trim: trimId },
        vehicleCatalog,
        { baselineEnginePricing },
      );
      return { ...next, recommendationResult: rec };
    });
  }, [initialWishIds, trimId, vehicleCatalog, baselineEnginePricing]);

  const handleAcceptPackage = useCallback((packageId) => {
    setDetailSelection((prev) => acceptPackage(prev, packageId));
  }, []);

  const handleAcceptBetterTrim = useCallback((trimIdNext, resolution) => {
    setTrimOverride(trimIdNext);
    setDetailSelection((prev) => acceptBetterTrim(
      prev,
      trimIdNext,
      resolution?.packageIds ?? [],
      resolution?.accessoryIds ?? [],
    ));
  }, []);

  const handlePaymentApply = useCallback((draft) => {
    patchSelection({
      paymentMode: draft.paymentMode,
      termMonths: draft.termMonths,
      mileagePerYear: draft.mileagePerYear,
      downPayment: draft.downPayment,
      financeDown: draft.financeDown,
      financeBalloon: draft.financeBalloon,
    });
    setPriceDrawerOpen(false);
  }, [patchSelection]);

  const dealerInventory = useMemo(() => {
    if (!activeDealer) return [];
    return getDealerInventory(activeDealer.dealerSlug, vehicle?.slug);
  }, [activeDealer, vehicle?.slug]);

  const similarVehicles = useMemo(() => {
    if (!vehicle) return [];
    return getSimilarVehiclesNearby(vehicle, 5);
  }, [vehicle]);

  const bestConfig = useMemo(() => {
    if (!manufacturer || !vehicle) return null;
    return findBestTrimForWish({
      brand: vehicle.brand,
      model: vehicle.model,
      wishFeatureIds: effectiveWishIds,
    });
  }, [manufacturer, vehicle, effectiveWishIds]);

  const cleverQuote = useMemo(() => {
    if (!vehicle || !effectiveWishIds.length) return null;
    const match = scoreVehicleAgainstWish(vehicle, wishes, activeDealer?.monthlyRate ?? vehicle.monthlyRate);
    return computeCleverQuote({
      vehicle,
      wishes,
      match,
      trimId,
      selectedPackages: detailSelection.selectedPackages,
    });
  }, [vehicle, wishes, effectiveWishIds, trimId, detailSelection.selectedPackages, activeDealer?.monthlyRate]);

  const cleverQuoteAfterPackage = useMemo(() => {
    if (!cleverQuote?.upgrade) return null;
    return computeCleverQuoteAfterPackage(cleverQuote, cleverQuote.upgrade.potentialPercentGain);
  }, [cleverQuote]);

  return {
    vehicle,
    manufacturer,
    showCustomize,
    configMode,
    filters,
    detailSelection: { ...detailSelection, trim: trimId, trimName, selectedFeatures: effectiveWishIds, recommendationResult },
    displayPrice,
    displayTitle,
    displaySubtitle,
    dealer,
    activeDealer,
    rankedDealerOffers,
    dealerInventory,
    similarVehicles,
    basePricing,
    baselineEnginePricing,
    bestConfig,
    trimId,
    trimName,
    effectiveColorId,
    discountPercent: basePricing?.discountPercent ?? vehicle?.discountPercent ?? 0,
    priceDrawerOpen,
    setPriceDrawerOpen,
    compareOpen,
    setCompareOpen,
    setSelectedDealerSlug,
    patchSelection,
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
  };
}

export { DEFAULT_TERM, DEFAULT_MILEAGE };
