import { calculatePrice } from './priceCalculator.js';
import { SALES_VEHICLE_CATALOG } from '../data/salesCatalog.js';
import { buildOfferUrl } from './offerService.js';

function formatVehicleLabel(vehicle) {
  return `${vehicle.model} ${vehicle.variant}`;
}

function buildPriceInput(vehicle, customer) {
  return {
    engineId: vehicle.engineId,
    trimId: vehicle.trimId,
    colorId: vehicle.colorId ?? 'carraraweiss',
    selectedPackageIds: [],
    customerGroup: 'standard',
    paymentType: 'leasing',
    termMonths: customer.termMonths,
    mileagePerYear: customer.mileagePerYear,
    downPayment: customer.downPayment,
  };
}

/**
 * Berechnet vollständige Preisdaten für ein Katalog-Fahrzeug.
 */
export function calcVehiclePricing(vehicle, customer, conditions) {
  if (vehicle.mock || (!vehicle.engineId && vehicle.mockRate != null)) {
    const rate = vehicle.mockRate ?? vehicle.staticRate ?? 0;
    return {
      monthlyRate: rate,
      leasingRate: rate,
      financeRate: Math.round(rate * 1.28),
      cashPrice: vehicle.mockHauspreis ?? 0,
      hauspreis: vehicle.mockHauspreis ?? 0,
      deliveryTime: vehicle.mockDeliveryTime ?? conditions.deliveryTime ?? '4–6 Wochen',
      availability: { label: vehicle.mock ? '🟡 Konfigurierbar' : '🟢 Verfügbar', type: 'konfigurierbar' },
    };
  }

  const price = calculatePrice(buildPriceInput(vehicle, customer), conditions);
  const monthlyRate = vehicle.staticRate ?? price.leasingRate;

  return {
    monthlyRate,
    leasingRate: monthlyRate,
    financeRate: price.financeRate,
    cashPrice: price.cashPrice,
    hauspreis: price.hauspreis ?? price.housePrice,
    deliveryTime: price.deliveryTime ?? conditions.deliveryTime,
    availability: price.availability,
  };
}

/** @deprecated – nutze calcVehiclePricing */
export function calcVehicleRate(vehicle, customer, conditions) {
  return calcVehiclePricing(vehicle, customer, conditions).monthlyRate;
}

function matchesVehicleType(type, vehicle) {
  if (!type || type === 'egal') return true;
  if (type === 'suv') return vehicle.bodyType === 'suv';
  if (type === 'kleinwagen') {
    return vehicle.bodyType === 'kleinwagen' || vehicle.bodyType === 'limousine' || vehicle.bodyType === 'kombi';
  }
  if (type === 'elektro') return vehicle.fuelCategory === 'elektro';
  return true;
}

function matchesBrandModel(query, vehicle) {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`.toLowerCase();
  return haystack.includes(q);
}

function buildRecommendReason(vehicle, customer, monthlyRate, diff, pricing) {
  const reasons = [];

  if (monthlyRate <= customer.desiredRate) {
    reasons.push('Unter Wunschrate');
  } else if (diff <= 15) {
    reasons.push('Nahe an Wunschrate');
  } else if (diff <= 30) {
    reasons.push('Gute Alternative');
  }

  if (vehicle.tag) reasons.push(vehicle.tag);
  if (vehicle.fuelCategory === 'elektro') reasons.push('Elektro');
  if (vehicle.familyScore >= 5) reasons.push('Familien-tauglich');
  if (pricing.availability?.label?.includes('Sofort')) reasons.push('Schnelle Lieferung');
  if (vehicle.trimId === 'black-edition') reasons.push('Premium-Ausstattung');

  return reasons.length ? reasons.slice(0, 3).join(' · ') : 'Beste Übereinstimmung';
}

function formatRateDeviation(diff, monthlyRate, desiredRate) {
  if (monthlyRate <= desiredRate) {
    return `${Math.round(desiredRate - monthlyRate)} € unter Wunschrate`;
  }
  return `+${Math.round(diff)} € zur Wunschrate`;
}

/**
 * Verkäufermodus: 3–5 passende Vorschläge als Karten-Daten.
 */
export function matchSalesOffers(customer, conditions, catalog = SALES_VEHICLE_CATALOG) {
  const desiredRate = Number(customer.desiredRate) || 300;
  const vehicleType = customer.vehicleType ?? 'egal';
  const brandModel = customer.brandModel ?? '';

  const filtered = catalog.filter(
    (v) => matchesVehicleType(vehicleType, v) && matchesBrandModel(brandModel, v),
  );

  const pool = filtered.length ? filtered : catalog;

  const suggestions = pool.map((vehicle) => {
    const pricing = calcVehiclePricing(vehicle, customer, conditions);
    const monthlyRate = pricing.monthlyRate;
    const diff = monthlyRate - desiredRate;
    const absDiff = Math.abs(diff);

    return {
      ...vehicle,
      label: formatVehicleLabel(vehicle),
      monthlyRate,
      diff: absDiff,
      signedDiff: diff,
      rateDeviationLabel: formatRateDeviation(absDiff, monthlyRate, desiredRate),
      withinBudget: monthlyRate <= desiredRate + 30,
      hauspreis: pricing.hauspreis,
      deliveryTime: pricing.deliveryTime,
      availabilityLabel: pricing.availability?.label ?? '🟢 Verfügbar',
      recommendReason: buildRecommendReason(vehicle, { desiredRate }, monthlyRate, absDiff, pricing),
      pricing,
      dealerPagePath: vehicle.engineId ? '/haendler/autohaus-trinkle' : null,
    };
  });

  const sorted = suggestions.sort((a, b) => a.diff - b.diff || a.monthlyRate - b.monthlyRate);

  const count = Math.min(5, Math.max(3, sorted.length >= 3 ? 5 : sorted.length));
  return sorted.slice(0, count).map((item, index) => ({ ...item, rank: index + 1 }));
}

export function buildOfferMessage(customer, offer, dealerName = 'Autohaus Trinkle', offerUrl) {
  const link = offerUrl ?? `${window.location.origin}/haendler/autohaus-trinkle`;
  const lines = [
    `Hallo ${customer.name || 'Kunde'},`,
    '',
    `hier Ihr Leasingangebot von ${dealerName}:`,
    '',
    `🚗 ${offer.brand} ${offer.label}`,
    `💶 ${offer.monthlyRate} €/Monat`,
    `📅 ${customer.termMonths} Monate · ${Number(customer.mileagePerYear).toLocaleString('de-DE')} km/Jahr`,
    customer.downPayment > 0 ? `💳 Anzahlung: ${customer.downPayment} €` : null,
    offer.availabilityLabel,
    '',
    'Unverbindliches Beispielangebot. Gern beraten wir Sie persönlich.',
    '',
    `👉 ${link}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function copyOfferLink(offerUrl) {
  await navigator.clipboard.writeText(offerUrl);
  return offerUrl;
}

export { buildOfferUrl };
