/**
 * Lokaler Händler statt Rabattschlacht – Darstellung & Sortierung
 */

import { getAvailabilityMeta } from './marketplaceService.js';
import { hasLocalizedSearch } from './oneSearchService.js';

const AVAIL_RANK = { sofort: 0, vorlauf: 1, bestell: 2 };

export function getAvailabilityLabel(vehicle) {
  return getAvailabilityMeta(vehicle?.availability)?.label ?? '🟡 Verfügbarkeit auf Anfrage';
}

export function formatDealerDistanceLine(vehicle) {
  const name = vehicle?.dealerName ?? vehicle?.dealer ?? 'Händler';
  const km = vehicle?.distanceKm;
  if (km == null) return `📍 ${name}`;
  return `📍 ${name} · ${km} km`;
}

export function formatDeliveryLine(vehicle) {
  const t = vehicle?.deliveryTime;
  if (!t) return null;
  return `🚚 Lieferzeit ${t}`;
}

export function formatDiscountFootnote(vehicle) {
  const pct = vehicle?.discountPercent;
  if (pct == null || pct <= 0) return null;
  return `${pct} % Rabatt gegenüber Listenpreis`;
}

export function estimateListPrice(cashPrice, discountPercent) {
  if (!cashPrice || !discountPercent) return cashPrice;
  return Math.round(cashPrice / (1 - discountPercent / 100));
}

export function formatSavingsBlock(vehicle) {
  const cashPrice = vehicle?.cashPrice ?? 0;
  const discountPercent = vehicle?.discountPercent ?? 0;
  const listPrice = estimateListPrice(cashPrice, discountPercent);
  const savings = Math.max(0, listPrice - cashPrice);
  return { listPrice, yourPrice: cashPrice, savings, discountPercent };
}

/** Score für „Beste Angebote“: Nähe + Verfügbarkeit + Preis, Rabatt nur minimal */
export function scoreLocalOffer(vehicle) {
  const km = vehicle?.distanceKm ?? 80;
  const dist = Math.max(0, 100 - km * 1.4);
  const avail = vehicle?.availability === 'sofort' ? 100 : vehicle?.availability === 'vorlauf' ? 72 : 45;
  const rate = vehicle?.monthlyRate ?? 400;
  const price = Math.max(0, 100 - rate * 0.12);
  const discount = Math.min(15, (vehicle?.discountPercent ?? 0) * 0.4);
  return dist * 0.45 + avail * 0.35 + price * 0.15 + discount * 0.05;
}

export function sortByLocalRelevance(vehicles) {
  return [...vehicles].sort((a, b) => scoreLocalOffer(b) - scoreLocalOffer(a));
}

export function getTopRecommendationBadge(vehicle, { isTopPick = false } = {}) {
  if (!isTopPick) return null;
  if (vehicle?.availability === 'sofort' && (vehicle?.distanceKm ?? 99) <= 25) {
    return '🟢 Sofort verfügbar';
  }
  if ((vehicle?.distanceKm ?? 99) <= 20) {
    return '⭐ Empfehlung in Ihrer Nähe';
  }
  if (vehicle?.availability === 'sofort') {
    return '🔥 Besonders beliebt';
  }
  return '⭐ Empfehlung in Ihrer Nähe';
}

export function buildResultsPageHeadline(filters, { offerCount = 0, dealerCount = 0 } = {}) {
  const radius = filters?.radius ?? 25;
  if (hasLocalizedSearch(filters)) {
    return {
      title: 'Fahrzeuge in Ihrer Nähe',
      subtitle: `${offerCount} Angebote im Umkreis von ${radius} km`,
    };
  }
  return {
    title: 'Ihre lokalen Angebote',
    subtitle: dealerCount > 0
      ? `${offerCount} Angebote · ${dealerCount} Händler in Ihrer Region`
      : `${offerCount} Angebote in Ihrer Region`,
  };
}

export function countUniqueDealers(vehicles) {
  return new Set(vehicles.map((v) => v.dealerSlug ?? v.dealerName ?? v.dealer).filter(Boolean)).size;
}
