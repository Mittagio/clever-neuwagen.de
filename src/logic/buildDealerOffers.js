import { getLowestSportageLeasingRate, getLowestSportageLeasingResult } from './priceCalculator.js';
import { getInventoryForDealer } from '../data/dealerInventory.js';
import { getDealerAvailabilitySummary } from './inventoryService.js';

export { getLowestSportageLeasingRate, getLowestSportageLeasingResult };

export function enrichDealerListing(listing, trinkleConditions) {
  const inventory = getInventoryForDealer(listing.dealerId, trinkleConditions);
  const availabilitySummary = getDealerAvailabilitySummary(inventory);

  if (!listing.useLiveConditions) {
    return {
      ...listing,
      vehicleLabel: `${listing.brand} ${listing.model}`,
      showRate: listing.monthlyRateFrom != null,
      showPriceOnRequest: listing.monthlyRateFrom == null,
      availability: availabilitySummary,
      deliveryTime: availabilitySummary.primary.deliveryTime ?? listing.deliveryTime,
      inventory,
    };
  }

  const pricingResult = getLowestSportageLeasingResult(trinkleConditions);
  const monthlyRateFrom = pricingResult?.leasingRate ?? null;

  return {
    ...listing,
    vehicleLabel: `${listing.brand} ${listing.model}`,
    monthlyRateFrom,
    preparationFeeLine: pricingResult?.preparationFeeLine ?? null,
    priceFootnotes: pricingResult?.priceFootnotes ?? [],
    customerBadges: pricingResult?.customerBadges ?? [],
    deliveryTime: availabilitySummary.primary.deliveryTime,
    showRate: monthlyRateFrom != null,
    showPriceOnRequest: monthlyRateFrom == null,
    availability: availabilitySummary,
    inventory,
  };
}

export function filterDealerListings(listings, { brand, model }) {
  const brandQuery = brand.trim().toLowerCase();
  const modelQuery = model.trim().toLowerCase();

  return listings
    .filter((d) => {
      const matchBrand = !brandQuery || d.brand.toLowerCase().includes(brandQuery);
      const matchModel = !modelQuery || d.model.toLowerCase().includes(modelQuery);
      return matchBrand && matchModel;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function buildDealerOffers(listings, trinkleConditions, search) {
  const enriched = listings.map((l) => enrichDealerListing(l, trinkleConditions));
  return filterDealerListings(enriched, search);
}
